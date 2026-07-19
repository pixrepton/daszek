<?php
if (!defined('ABSPATH')) exit;

/**
 * Zadania cron: backup i legacy mail-agent.
 *
 * Nowy Gmail Intake V1 dziala lokalnie w `tools/gmail_audit/` i generuje
 * preview payloady dla Daszka. Ten plik pozostaje starsza, osobna sciezka IMAP.
 */


/**
 * Cron: Backup dobowy (rotacja 7 dni)
 */
function daszek_cron_backup() {
    $source = daszek_tasks_file();
    $backup_name = 'tasks-' . date('Ymd') . '.json';
    $backup_file = DASZEK_DATA_DIR . $backup_name;

    if (file_exists($source)) {
        copy($source, $backup_file);
    }

    // Rotacja: usuń pliki starsze niż 7 dni
    $files = glob(DASZEK_DATA_DIR . 'tasks-*.json');
    $cutoff = strtotime('-7 days');

    foreach ($files as $file) {
        if (filemtime($file) < $cutoff) {
            unlink($file);
        }
    }
}

function daszek_cron_bridge_queue_gc() {
    if (!function_exists('daszek_v2_bridge_queue_gc')) {
        return;
    }

    $removed = daszek_v2_bridge_queue_gc(90);
    if (is_wp_error($removed)) {
        error_log('Daszek bridge queue GC error: ' . $removed->get_error_message());
    }
}

/**
 * Cron: Mail-Agent (legacy — domyślnie wyłączony).
 *
 * Gmail intake = Node B (`gmail-agent`). Nie włączaj `mail_ingest` w produkcji PRO.
 * Ta ścieżka pozostaje tylko dla historycznych testów IMAP na Node A.
 */
function daszek_cron_mail_ingest() {
    $config = daszek_get_config();

    if (!$config['mail_ingest']) {
        return;
    }

    try {
        daszek_process_mailbox();
    } catch (Exception $e) {
        error_log('Daszek Mail-Agent error: ' . $e->getMessage());
    }
}

/**
 * Proces przetwarzania skrzynki pocztowej
 */
function daszek_process_mailbox() {
    $config = daszek_get_config();

    if (!$config['mail_ingest'] || !$config['imap']['host']) {
        return;
    }

    // Połączenie IMAP
    $mailbox = sprintf(
        '{%s:%d/imap%s}INBOX',
        $config['imap']['host'],
        $config['imap']['port'],
        $config['imap']['ssl'] ? '/ssl' : ''
    );

    $imap = @imap_open(
        $mailbox,
        $config['imap']['user'],
        $config['imap']['pass']
    );

    if (!$imap) {
        error_log('Daszek: Nie można połączyć z IMAP');
        return;
    }

    // Pobierz nieprzeczytane wiadomości
    $emails = imap_search($imap, 'UNSEEN');

    if (!$emails) {
        imap_close($imap);
        return;
    }

    foreach ($emails as $email_number) {
        $overview = imap_fetch_overview($imap, $email_number, 0);
        $message = imap_fetchbody($imap, $email_number, 1);

        if (!$overview) {
            continue;
        }

        $subject = $overview[0]->subject ?? '';
        $from = $overview[0]->from ?? '';

        // Proste reguły rozpoznawania
        $keywords = ['faktura', 'invoice', 'opłata', 'płatność', 'serwis', 'przegląd'];
        $has_keyword = false;

        foreach ($keywords as $keyword) {
            if (stripos($subject, $keyword) !== false || stripos($message, $keyword) !== false) {
                $has_keyword = true;
                break;
            }
        }

        if (!$has_keyword) {
            continue;
        }

        // Ekstrakcja daty (prosta regex dd.mm.yyyy lub dd-mm-yyyy)
        $due_date = null;
        if (preg_match('/(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})/', $message, $matches)) {
            $due_date = sprintf('%s-%s-%s', $matches[3], $matches[2], $matches[1]);
        } else {
            // Domyślnie: +7 dni
            $due_date = date('Y-m-d', strtotime('+7 days'));
        }

        // DeepSeek priority #1 (DEEPSEEK-MIGRATION-1), then Groq, then the regex above.
        $extracted = daszek_extract_task_fields($subject, $message);
        if ($extracted && isset($extracted['due_date'])) {
            $due_date = $extracted['due_date'];
        }

        // Utwórz zadanie
        $task_data = [
            'title' => substr($subject, 0, 200),
            'due_at' => $due_date,
            'source' => 'mail',
            'amount' => null,
        ];

        // Nadpisz użytkownika na 'daszek'
        $_SESSION['daszek_user'] = 'daszek';
        daszek_add_task($task_data);

        // Oznacz jako przeczytane
        imap_setflag_full($imap, $email_number, "\\Seen");
    }

    imap_close($imap);
}

/**
 * Ekstrakcja pól zadania z maila. Priorytet #1: DeepSeek V4 Flash (DEEPSEEK-MIGRATION-1),
 * fallback: Groq. Zwraca null gdy żaden provider nie jest skonfigurowany/dostępny — wtedy
 * caller korzysta z deterministycznej ekstrakcji regex (semantyka best-effort bez zmian).
 */
function daszek_extract_task_fields($subject, $body) {
    $extracted = daszek_extract_with_deepseek($subject, $body);
    if ($extracted !== null) {
        return $extracted;
    }
    return daszek_extract_with_groq($subject, $body);
}

/**
 * Ekstrakcja danych z użyciem DeepSeek V4 Flash (OpenAI-compatible, JSON Output + thinking mode).
 * Czyta wyłącznie choices[0].message.content (finalna odpowiedź) — reasoning_content DeepSeeka
 * nigdy nie jest traktowany jako wynik biznesowy. Zwraca null przy błędach operacyjnych/auth
 * → fallback Groq; request-contract bug jest fail-fast.
 */
function daszek_extract_with_deepseek($subject, $body) {
    $config = daszek_get_config();
    $ds = isset($config['deepseek']) ? $config['deepseek'] : null;

    if (!$ds || empty($ds['enabled']) || empty($ds['api_key'])) {
        return null;
    }

    $prompt = "Jesteś asystentem analizującym maile firmowe. Z poniższego maila wyodrębnij:\n" .
              "- has_task (bool): czy mail zawiera zadanie do wykonania?\n" .
              "- title (string): krótki tytuł zadania\n" .
              "- due_date (string YYYY-MM-DD lub null): termin wykonania\n" .
              "- amount (number lub null): kwota jeśli występuje\n\n" .
              "Zwróć tylko czysty JSON.\n\n" .
              "Temat: {$subject}\n\nTreść: {$body}";

    $data = [
        'model' => $ds['model'],
        'messages' => [
            ['role' => 'system', 'content' => 'Jesteś asystentem ekstrakcji danych z maili. Zwracasz czysty JSON.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'response_format' => ['type' => 'json_object'],
    ];
    if (!empty($ds['thinking_enabled'])) {
        // DeepSeek thinking mode: thinking + reasoning_effort as top-level fields (native API).
        $data['thinking'] = ['type' => 'enabled'];
        $data['reasoning_effort'] = !empty($ds['reasoning_effort']) ? $ds['reasoning_effort'] : 'high';
    } else {
        $data['temperature'] = 0.2;
    }

    $base = rtrim(!empty($ds['base_url']) ? $ds['base_url'] : 'https://api.deepseek.com', '/');
    $endpoint = (substr($base, -14) === '/chat/completions') ? $base : $base . '/chat/completions';

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $ds['api_key'],
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ((int) $http_code === 400) {
        throw new Exception('Daszek DeepSeek request/contract error: HTTP ' . (int) $http_code);
    }
    if (in_array((int) $http_code, [401, 403], true)) {
        error_log('Daszek DeepSeek primary-provider configuration failure; falling back to Groq. HTTP ' . (int) $http_code);
        return null;
    }
    if ($http_code !== 200 || !$response) {
        return null;
    }

    $result = json_decode($response, true);
    $content = $result['choices'][0]['message']['content'] ?? '';
    if ($content === '' || $content === null) {
        // Empty final answer (e.g. thinking budget) — fall through to Groq.
        return null;
    }
    $parsed = json_decode($content, true);
    return is_array($parsed) ? $parsed : null;
}

/**
 * Ekstrakcja danych z użyciem Groq AI (fallback po DeepSeek).
 */
function daszek_extract_with_groq($subject, $body) {
    $config = daszek_get_config();

    if (!$config['groq']['enabled'] || !$config['groq']['api_key']) {
        return null;
    }

    $prompt = "Jesteś asystentem analizującym maile firmowe. Z poniższego maila wyodrębnij:\n" .
              "- has_task (bool): czy mail zawiera zadanie do wykonania?\n" .
              "- title (string): krótki tytuł zadania\n" .
              "- due_date (string YYYY-MM-DD lub null): termin wykonania\n" .
              "- amount (number lub null): kwota jeśli występuje\n\n" .
              "Zwróć tylko czysty JSON.\n\n" .
              "Temat: {$subject}\n\nTreść: {$body}";

    $data = [
        'model' => $config['groq']['model'],
        'messages' => [
            ['role' => 'system', 'content' => 'Jesteś asystentem ekstrakcji danych z maili.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.2,
        'response_format' => ['type' => 'json_object'],
    ];

    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $config['groq']['api_key'],
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200) {
        return null;
    }

    $result = json_decode($response, true);
    $content = $result['choices'][0]['message']['content'] ?? '{}';

    return json_decode($content, true);
}
