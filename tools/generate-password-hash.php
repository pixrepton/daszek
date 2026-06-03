<?php
/**
 * Generator hashy haseł dla Daszka
 * 
 * Użycie:
 * php generate-password-hash.php [haslo]
 * 
 * Lub uruchom bez argumentu dla interaktywnego trybu.
 */

if (php_sapi_name() !== 'cli') {
    die('Ten skrypt może być uruchomiony tylko z linii poleceń.');
}

function generateHash($password) {
    return password_hash($password, PASSWORD_BCRYPT);
}

// Argument z linii poleceń
if (isset($argv[1]) && !empty($argv[1])) {
    $password = $argv[1];
    $hash = generateHash($password);
    
    echo "Hasło: {$password}\n";
    echo "Hash:  {$hash}\n\n";
    echo "Skopiuj poniższą linię do includes/config.php:\n";
    echo "'uzytkownik' => '{$hash}',\n";
    exit(0);
}

// Tryb interaktywny
echo "=== Generator hashy haseł dla Daszka ===\n\n";

while (true) {
    echo "Podaj hasło (lub 'q' aby zakończyć): ";
    $password = trim(fgets(STDIN));
    
    if ($password === 'q' || $password === 'quit') {
        echo "Do widzenia!\n";
        break;
    }
    
    if (empty($password)) {
        echo "Hasło nie może być puste.\n\n";
        continue;
    }
    
    if (strlen($password) < 6) {
        echo "⚠️  UWAGA: Hasło jest bardzo krótkie (min. 6 znaków zalecane).\n";
    }
    
    $hash = generateHash($password);
    
    echo "\n";
    echo "Hasło: {$password}\n";
    echo "Hash:  {$hash}\n\n";
    echo "Skopiuj poniższą linię do includes/config.php:\n";
    echo "'uzytkownik' => '{$hash}',\n";
    echo str_repeat('-', 70) . "\n\n";
}

