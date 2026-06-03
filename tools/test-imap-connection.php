<?php
/**
 * Test połączenia IMAP dla Mail-Agent
 * 
 * Użycie:
 * php test-imap-connection.php
 */

if (php_sapi_name() !== 'cli') {
    die('Ten skrypt może być uruchomiony tylko z linii poleceń.');
}

// Sprawdź czy rozszerzenie IMAP jest zainstalowane
if (!extension_loaded('imap')) {
    echo "❌ Rozszerzenie PHP IMAP nie jest zainstalowane!\n\n";
    echo "Instalacja:\n";
    echo "  Ubuntu/Debian: sudo apt install php-imap && sudo systemctl restart apache2\n";
    echo "  CentOS/RHEL:   sudo yum install php-imap && sudo systemctl restart httpd\n";
    exit(1);
}

echo "=== Test połączenia IMAP dla Daszek Mail-Agent ===\n\n";

// Pobierz dane
echo "Host IMAP (np. imap.gmail.com): ";
$host = trim(fgets(STDIN));

echo "Port (domyślnie 993): ";
$port = trim(fgets(STDIN));
$port = $port ?: 993;

echo "SSL/TLS? (y/n, domyślnie y): ";
$ssl = trim(fgets(STDIN));
$ssl = ($ssl === 'n' || $ssl === 'N') ? false : true;

echo "Login: ";
$user = trim(fgets(STDIN));

echo "Hasło: ";
system('stty -echo');
$pass = trim(fgets(STDIN));
system('stty echo');
echo "\n\n";

// Buduj mailbox string
$mailbox = sprintf(
    '{%s:%d/imap%s}INBOX',
    $host,
    $port,
    $ssl ? '/ssl' : ''
);

echo "Łączenie z: {$mailbox}\n";
echo "Użytkownik: {$user}\n";
echo str_repeat('-', 70) . "\n\n";

// Próba połączenia
$imap = @imap_open($mailbox, $user, $pass);

if (!$imap) {
    echo "❌ Błąd połączenia!\n\n";
    echo "Komunikat błędu:\n";
    echo imap_last_error() . "\n\n";
    
    echo "Możliwe przyczyny:\n";
    echo "1. Nieprawidłowy host, port lub SSL\n";
    echo "2. Błędny login lub hasło\n";
    echo "3. Dla Gmaila: potrzebujesz 'hasła aplikacji' (nie zwykłego hasła)\n";
    echo "   - Włącz weryfikację dwuetapową\n";
    echo "   - Wygeneruj hasło aplikacji na: https://myaccount.google.com/apppasswords\n";
    echo "4. IMAP może być wyłączony w ustawieniach konta\n";
    exit(1);
}

echo "✅ Połączenie udane!\n\n";

// Sprawdź skrzynkę
$check = imap_check($imap);
echo "Informacje o skrzynce:\n";
echo "  Liczba wiadomości: {$check->Nmsgs}\n";
echo "  Ostatnia aktualizacja: {$check->Date}\n\n";

// Pobierz kilka ostatnich wiadomości
if ($check->Nmsgs > 0) {
    echo "Ostatnie 3 wiadomości:\n";
    echo str_repeat('-', 70) . "\n";
    
    $start = max(1, $check->Nmsgs - 2);
    $emails = imap_fetch_overview($imap, "{$start}:{$check->Nmsgs}", 0);
    
    foreach (array_reverse($emails) as $email) {
        $subject = isset($email->subject) ? imap_utf8($email->subject) : '(brak tematu)';
        $from = isset($email->from) ? $email->from : '(nieznany)';
        $date = isset($email->date) ? $email->date : '(brak daty)';
        $seen = $email->seen ? '✓' : ' ';
        
        echo "[{$seen}] {$date}\n";
        echo "    Od: {$from}\n";
        echo "    Temat: {$subject}\n\n";
    }
}

imap_close($imap);

echo str_repeat('=', 70) . "\n";
echo "✅ Test zakończony pomyślnie!\n\n";
echo "Możesz teraz użyć tych danych w includes/config.php:\n\n";
echo "'imap' => [\n";
echo "    'host' => '{$host}',\n";
echo "    'port' => {$port},\n";
echo "    'user' => '{$user}',\n";
echo "    'pass' => '***',  // wklej swoje hasło\n";
echo "    'ssl'  => " . ($ssl ? 'true' : 'false') . ",\n";
echo "],\n";

