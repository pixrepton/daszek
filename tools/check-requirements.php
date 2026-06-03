<?php
/**
 * Sprawdzenie wymagań systemowych dla Daszka
 * 
 * Użycie:
 * php check-requirements.php
 */

if (php_sapi_name() !== 'cli') {
    die('Ten skrypt może być uruchomiony tylko z linii poleceń.');
}

echo "=== Sprawdzanie wymagań systemowych dla Daszek ===\n\n";

$requirements = [
    'PHP Version >= 7.4' => version_compare(PHP_VERSION, '7.4.0', '>='),
    'Extension: json' => extension_loaded('json'),
    'Extension: fileinfo' => extension_loaded('fileinfo'),
    'Extension: session' => extension_loaded('session'),
    'Extension: curl' => extension_loaded('curl'),
];

$optional = [
    'Extension: imap (dla Mail-Agent)' => extension_loaded('imap'),
    'Extension: mbstring' => extension_loaded('mbstring'),
];

echo "Wymagania podstawowe:\n";
echo str_repeat('-', 70) . "\n";

$all_ok = true;
foreach ($requirements as $name => $ok) {
    $status = $ok ? '✅' : '❌';
    echo "{$status} {$name}\n";
    if (!$ok) {
        $all_ok = false;
    }
}

echo "\nWymagania opcjonalne:\n";
echo str_repeat('-', 70) . "\n";

foreach ($optional as $name => $ok) {
    $status = $ok ? '✅' : '⚠️ ';
    echo "{$status} {$name}\n";
}

echo "\n" . str_repeat('=', 70) . "\n";

if (!$all_ok) {
    echo "❌ Nie wszystkie wymagania są spełnione!\n";
    echo "Zainstaluj brakujące rozszerzenia przed kontynuacją.\n";
    exit(1);
}

echo "✅ Wszystkie podstawowe wymagania są spełnione!\n";

// Sprawdź katalog uploads
echo "\nSprawdzanie katalogu WordPress...\n";
echo str_repeat('-', 70) . "\n";

$wp_content = dirname(__DIR__, 3);
$uploads_dir = $wp_content . '/uploads/daszek';

if (!is_dir($wp_content . '/uploads')) {
    echo "⚠️  Katalog wp-content/uploads nie istnieje\n";
    echo "   Zostanie utworzony automatycznie podczas aktywacji wtyczki.\n";
} else {
    echo "✅ Katalog wp-content/uploads istnieje\n";
    
    if (is_writable($wp_content . '/uploads')) {
        echo "✅ Katalog jest zapisywalny\n";
    } else {
        echo "❌ Katalog nie jest zapisywalny!\n";
        echo "   Wykonaj: chmod 755 {$wp_content}/uploads\n";
    }
}

if (is_dir($uploads_dir)) {
    echo "✅ Katalog daszek istnieje: {$uploads_dir}\n";
    
    if (is_writable($uploads_dir)) {
        echo "✅ Katalog daszek jest zapisywalny\n";
    } else {
        echo "❌ Katalog daszek nie jest zapisywalny!\n";
        echo "   Wykonaj: chmod 755 {$uploads_dir}\n";
    }
    
    $tasks_file = $uploads_dir . '/tasks.json';
    if (file_exists($tasks_file)) {
        echo "✅ Plik tasks.json istnieje\n";
        
        if (is_writable($tasks_file)) {
            echo "✅ Plik tasks.json jest zapisywalny\n";
        } else {
            echo "❌ Plik tasks.json nie jest zapisywalny!\n";
            echo "   Wykonaj: chmod 644 {$tasks_file}\n";
        }
    }
} else {
    echo "⚠️  Katalog daszek nie istnieje\n";
    echo "   Zostanie utworzony automatycznie podczas aktywacji wtyczki.\n";
}

echo "\n" . str_repeat('=', 70) . "\n";
echo "✅ Sprawdzanie zakończone!\n";

