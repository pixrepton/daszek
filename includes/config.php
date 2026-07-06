<?php
if (!defined('ABSPATH')) exit;

/**
 * Daszek configuration.
 */

function daszek_get_config() {
    $config = [
        'users' => [
            'konrad' => '$2y$10$/tvQV1r1c.OhtHU8RLnPlu4fEuL1BJktFCq1ybq7ZR3HfhF2c/HZW',
            'darek'  => '$2y$10$PJSnti7IZckFW6xuwVw6yuooiNc7J3/caXTqT.1XBsJOdZznXmbfC',
            'daszek' => '$2y$10$Qb0VbMhLCurIpiEdr11rrueKkKRc/me3vXb/PhN2ha6YM/L54eoB2',
        ],
        'session' => [
            'cookie_name' => 'daszek_session',
            // Brak interakcji z Daszkiem dłużej niż tyle sekund → wylogowanie (sesja PHP gc Maxlifetime ustawiane w auth.php).
            'lifetime' => 7 * 24 * 60 * 60,
        ],
        'mail_ingest' => false,
        'imap' => [
            'host' => '',
            'port' => 993,
            'user' => '',
            'pass' => '',
            'ssl'  => true,
        ],
        'groq' => [
            'enabled' => false,
            'api_key' => '',
            'model'   => 'llama-3.1-8b-instant',
        ],
        // When true, POST operational feed snapshot fails if feed.desk references unknown note_id in v2 desk_notes.
        'operational_feed' => [
            'strict_desk_note_refs' => false,
        ],
        // Optional thin proxy target for read-only Skrzat requests. Keep Node B
        // as semantic owner; WordPress only forwards authenticated operator asks.
        'node_b_api' => [
            'base_url' => defined('DASZEK_NODE_B_API_BASE') ? DASZEK_NODE_B_API_BASE : (getenv('DASZEK_NODE_B_API_BASE') ?: ''),
            'api_token' => defined('DASZEK_NODE_B_API_TOKEN') ? DASZEK_NODE_B_API_TOKEN : (getenv('DASZEK_NODE_B_API_TOKEN') ?: ''),
            'service_token' => defined('DASZEK_NODE_B_SERVICE_TOKEN') ? DASZEK_NODE_B_SERVICE_TOKEN : (getenv('DASZEK_NODE_B_SERVICE_TOKEN') ?: ''),
            'timeout' => 150,
        ],
    ];

    $local_path = DASZEK_PLUGIN_DIR . 'includes/config.local.php';
    if (is_readable($local_path)) {
        $override = include $local_path;
        if (is_array($override)) {
            $config = array_replace_recursive($config, $override);
        }
    }

    return $config;
}

function daszek_validate_date($date, $allow_null = false) {
    if ($date === null || $date === '') {
        return $allow_null;
    }

    if (!is_string($date)) {
        return false;
    }

    $d = DateTime::createFromFormat('Y-m-d', $date);
    if (!$d || $d->format('Y-m-d') !== $date) {
        return false;
    }

    $yesterday = new DateTime('yesterday');
    if ($d < $yesterday) {
        return false;
    }

    return true;
}

function daszek_add_interval($base_date, $interval, $multiplier = 1) {
    $date = new DateTime($base_date);

    if ($interval === 'yearly') {
        $date->modify("+{$multiplier} year");
    } elseif ($interval === 'monthly') {
        $date->modify("+{$multiplier} month");
    }

    return $date->format('Y-m-d');
}
