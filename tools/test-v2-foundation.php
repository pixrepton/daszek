<?php
declare(strict_types=1);

error_reporting(E_ALL);

$tempRoot = sys_get_temp_dir() . '/daszek-v2-foundation-' . bin2hex(random_bytes(4));
if (!is_dir($tempRoot) && !mkdir($tempRoot, 0777, true) && !is_dir($tempRoot)) {
    fwrite(STDERR, "Nie udało się utworzyć katalogu tymczasowego.\n");
    exit(1);
}

define('ABSPATH', __DIR__ . '/');
define('DASZEK_DATA_DIR', $tempRoot . '/');

class WP_Error {
    public $code;
    public $message;
    public $data;

    public function __construct($code = '', $message = '', $data = null) {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }

    public function get_error_message() {
        return $this->message;
    }
}

function is_wp_error($value) {
    return $value instanceof WP_Error;
}

function sanitize_text_field($value) {
    return trim((string) $value);
}

function sanitize_textarea_field($value) {
    return trim((string) $value);
}

function sanitize_key($value) {
    return preg_replace('/[^a-z0-9_]/', '_', strtolower((string) $value));
}

function current_time($type) {
    if ($type === 'mysql') {
        return gmdate('Y-m-d H:i:s');
    }
    return gmdate('c');
}

function wp_mkdir_p($dir) {
    return is_dir($dir) || mkdir($dir, 0777, true);
}

function daszek_current_user() {
    return 'tester';
}

function assert_true($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

require_once dirname(__DIR__) . '/includes/store-v2.php';

assert_true(daszek_v2_bootstrap_storage(), 'Bootstrap storage powinien zadziałać.');

$cases = [
    'case_1' => [
        'case_id' => 'case_1',
        'case_key' => 'gmail:procurement_delivery:thread-1',
        'family' => 'procurement_delivery',
        'status' => 'open',
        'current_state' => 'delivery_at_risk',
        'title' => 'Dostawa narzędzi do śledzenia',
        'title_pl' => 'Dostawa narzędzi do śledzenia',
        'summary' => 'Sprawa dostawy zakupionych narzędzi.',
        'summary_pl' => 'Sprawa dostawy zakupionych narzędzi.',
        'operator_brief_pl' => 'Dostawa narzędzi wymaga spokojnego nadzoru, ale nie wygląda na kryzys.',
        'primary_next_action_title_pl' => 'Sprawdź status dostawy',
        'risk_summary_pl' => 'Najważniejsze ryzyko: opóźnienie logistyczne.',
        'missing_info_summary_pl' => 'Warto uzupełnić nowy termin dostawy.',
        'latest_signal_id' => 'sig_1',
        'latest_signal_at' => '2026-04-07T02:15:16+02:00',
        'case_link_decision' => 'no_link',
        'case_key_source' => 'thread',
        'open_desk_note_id' => 'note_1',
        'active_note_count' => 1,
        'updated_at' => '2026-04-07T02:15:16+02:00',
        'last_command' => 'upsert_case',
    ],
];

$deskNotes = [
    'note_1' => [
        'note_id' => 'note_1',
        'case_id' => 'case_1',
        'title' => 'Śledź dostawę wiertła',
        'title_pl' => 'Śledź dostawę wiertła',
        'summary' => 'Przesyłka jest w drodze i wymaga obserwacji.',
        'summary_pl' => 'Przesyłka jest w drodze i wymaga obserwacji.',
        'why_on_desk' => 'To świeży sygnał zakupowy wymagający uwagi.',
        'recommended_next_step' => 'Sprawdź dostawę jutro rano.',
        'assistant_suggestion_pl' => 'Sprawdź dostawę jutro rano.',
        'operator_brief_pl' => 'To świeży temat dostawowy, który warto sprawdzić przed rozpoczęciem dnia.',
        'primary_next_action_title_pl' => 'Skontaktuj się z dostawcą',
        'primary_next_action_reason_pl' => 'Brak nowego terminu dostawy może opóźnić plan prac.',
        'missing_info_summary_pl' => 'Brakuje potwierdzonego terminu dostawy.',
        'risk_summary_pl' => 'Najważniejsze ryzyko: opóźnienie operacyjne.',
        'surface_zone' => 'desk',
        'day_bucket' => 'teraz',
        'presence_mode' => 'strong',
        'presence_label_pl' => 'Stanowczo',
        'lifecycle' => 'active',
        'lifecycle_state' => 'active',
        'lifecycle_label_pl' => 'Aktywna',
        'source_signal_ids' => ['sig_1'],
        'source_message_id' => '19d52b9ee78be87a',
        'case_family' => 'procurement_delivery',
        'feedback_state' => daszek_v2_default_feedback_state(),
        'created_at' => '2026-04-07T02:15:16+02:00',
        'updated_at' => '2026-04-07T02:15:16+02:00',
    ],
];

assert_true(daszek_v2_save_map_store('cases', $cases), 'Zapis cases powinien się udać.');
assert_true(daszek_v2_save_map_store('desk_notes', $deskNotes), 'Zapis desk_notes powinien się udać.');

$feedbackResult = daszek_v2_apply_feedback('note_1', 'tylko_w_sprawie');
assert_true(!is_wp_error($feedbackResult), 'Akcja tylko_w_sprawie powinna być obsługiwana.');
assert_true(($feedbackResult['note']['presence_mode'] ?? '') === 'silent', 'Akcja tylko_w_sprawie powinna ukrywać kartkę z Biurka.');
assert_true(($feedbackResult['note']['lifecycle_state'] ?? '') === 'active', 'Akcja tylko_w_sprawie nie powinna zamykać lifecycle kartki.');
assert_true((int) (($feedbackResult['note']['feedback_state']['tylko_w_sprawie'] ?? 0)) === 1, 'Akcja tylko_w_sprawie powinna być zapisana w feedback_state.');

$casesReadModel = daszek_v2_build_cases_read_model();
assert_true(($casesReadModel['items'][0]['family_label'] ?? '') !== '', 'Case read model powinien zwracać etykietę rodziny sprawy.');
assert_true(($casesReadModel['items'][0]['status_label'] ?? '') !== '', 'Case read model powinien zwracać etykietę statusu.');
assert_true(($casesReadModel['items'][0]['current_state_label'] ?? '') !== '', 'Case read model powinien zwracać etykietę bieżącego stanu.');
assert_true(($casesReadModel['items'][0]['operator_brief_pl'] ?? '') !== '', 'Case read model powinien zwracać brief operatora.');

$noteDetail = daszek_v2_get_desk_note_detail('note_1');
assert_true(($noteDetail['note']['operator_brief_pl'] ?? '') !== '', 'Detail kartki powinien zwracać brief operatora.');
assert_true(($noteDetail['note']['risk_summary_pl'] ?? '') !== '', 'Detail kartki powinien zwracać podsumowanie ryzyka.');
assert_true(($noteDetail['note']['missing_info_summary_pl'] ?? '') !== '', 'Detail kartki powinien zwracać podsumowanie braków.');

echo "OK\n";
