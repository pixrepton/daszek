<?php
/**
 * Skrypt dezinstalacji wtyczki Daszek
 * 
 * Wywoływany automatycznie przez WordPress podczas usuwania wtyczki.
 */

// Zabezpieczenie - tylko WordPress może uruchomić ten skrypt
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Usunięcie danych
$data_dir = WP_CONTENT_DIR . '/uploads/daszek/';

if (is_dir($data_dir)) {
    // Usuń wszystkie pliki w katalogu
    $files = glob($data_dir . '*');
    foreach ($files as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    
    // Usuń katalog
    rmdir($data_dir);
}

// Usunięcie zaplanowanych cron jobów
wp_clear_scheduled_hook('daszek_daily_backup');
wp_clear_scheduled_hook('daszek_bridge_queue_gc');
wp_clear_scheduled_hook('daszek_mail_ingest');

// Opcjonalnie: wyczyść sesje
// (Sessions są zarządzane przez PHP, więc wygasną automatycznie)

// Flush rewrite rules
flush_rewrite_rules();

