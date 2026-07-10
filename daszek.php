<?php
/**
 * Plugin Name: Daszek
 * Description: System zarzadzania zadaniami i itemami intake dla TOP-INSTAL
 * Version: 1.3.4
 * Author: TOP-INSTAL
 * Text Domain: daszek
 */

if (!defined('ABSPATH')) exit;

define('DASZEK_VERSION', '1.3.4');
define('DASZEK_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DASZEK_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DASZEK_DATA_DIR', WP_CONTENT_DIR . '/uploads/daszek/');

require_once DASZEK_PLUGIN_DIR . 'includes/config.php';
require_once DASZEK_PLUGIN_DIR . 'includes/auth.php';
require_once DASZEK_PLUGIN_DIR . 'includes/store.php';
require_once DASZEK_PLUGIN_DIR . 'includes/store-v2.php';
require_once DASZEK_PLUGIN_DIR . 'includes/store-v3.php';
require_once DASZEK_PLUGIN_DIR . 'includes/cycles.php';
require_once DASZEK_PLUGIN_DIR . 'includes/api.php';
require_once DASZEK_PLUGIN_DIR . 'includes/api-v2.php';
require_once DASZEK_PLUGIN_DIR . 'includes/api-v3.php';
require_once DASZEK_PLUGIN_DIR . 'includes/cron.php';
require_once DASZEK_PLUGIN_DIR . 'includes/proxy-agent-chat.php';

/**
 * Aktywacja wtyczki
 */
function daszek_activate() {
    if (!file_exists(DASZEK_DATA_DIR)) {
        wp_mkdir_p(DASZEK_DATA_DIR);
    }

    $tasks_file = DASZEK_DATA_DIR . 'tasks.json';
    if (!file_exists($tasks_file)) {
        file_put_contents($tasks_file, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    daszek_v2_bootstrap_storage();
    daszek_v3_bootstrap_storage();

    $htaccess_file = DASZEK_DATA_DIR . '.htaccess';
    if (!file_exists($htaccess_file)) {
        file_put_contents($htaccess_file, "Deny from all\nOptions -Indexes\n");
    }

    if (!wp_next_scheduled('daszek_daily_backup')) {
        wp_schedule_event(time(), 'daily', 'daszek_daily_backup');
    }

    if (!wp_next_scheduled('daszek_bridge_queue_gc')) {
        wp_schedule_event(time(), 'daily', 'daszek_bridge_queue_gc');
    }

    $config = daszek_get_config();
    if (!empty($config['mail_ingest'])) {
        if (!wp_next_scheduled('daszek_mail_ingest')) {
            wp_schedule_event(time(), 'daszek_5min', 'daszek_mail_ingest');
        }
    } else {
        wp_clear_scheduled_hook('daszek_mail_ingest');
    }
}

register_activation_hook(__FILE__, function() {
    daszek_activate();
    daszek_register_rewrite();
    flush_rewrite_rules();
});

/**
 * Deaktywacja wtyczki
 */
function daszek_deactivate() {
    wp_clear_scheduled_hook('daszek_daily_backup');
    wp_clear_scheduled_hook('daszek_bridge_queue_gc');
    wp_clear_scheduled_hook('daszek_mail_ingest');
    flush_rewrite_rules();
}

register_deactivation_hook(__FILE__, 'daszek_deactivate');

/**
 * Dodanie wlasnego interwalu cron (5 minut)
 */
function daszek_cron_schedules($schedules) {
    $schedules['daszek_5min'] = array(
        'interval' => 300,
        'display'  => __('Co 5 minut (Daszek)', 'daszek')
    );
    return $schedules;
}

add_filter('cron_schedules', 'daszek_cron_schedules');

/**
 * Rejestracja REST API endpoints
 */
function daszek_register_rest_routes() {
    if (function_exists('register_rest_route')) {
        daszek_api_register_routes();
        if (function_exists('daszek_api_register_v2_routes')) {
            daszek_api_register_v2_routes();
        }
        if (function_exists('daszek_api_register_v3_routes')) {
            daszek_api_register_v3_routes();
        }
        if (function_exists('daszek_proxy_agent_chat_register_routes')) {
            daszek_proxy_agent_chat_register_routes();
        }
    }
}

add_action('rest_api_init', 'daszek_register_rest_routes');

/**
 * Rewrite rule dla /daszek
 */
function daszek_register_rewrite() {
    add_rewrite_rule('^daszek/?$', 'index.php?daszek=1', 'top');
}

add_action('init', 'daszek_register_rewrite');

/**
 * PHP built-in server and some permalink setups skip rewrite tables — map /daszek explicitly.
 */
function daszek_parse_request_path_fallback($wp) {
    if (!is_object($wp) || get_query_var('daszek')) {
        return;
    }
    $path = isset($_SERVER['REQUEST_URI']) ? (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
    $trimmed = trim($path, '/');
    if ($trimmed === 'daszek') {
        $wp->query_vars['daszek'] = '1';
    }
}

add_action('parse_request', 'daszek_parse_request_path_fallback', 1);

/**
 * Query vars
 */
function daszek_query_vars($query_vars) {
    $query_vars[] = 'daszek';
    return $query_vars;
}

add_filter('query_vars', 'daszek_query_vars');

/**
 * Template redirect dla /daszek
 */
function daszek_template_redirect() {
    if (get_query_var('daszek')) {
        require_once DASZEK_PLUGIN_DIR . 'public/index.php';
        exit;
    }
}

add_action('template_redirect', 'daszek_template_redirect');

/**
 * Cron hooks
 */
add_action('daszek_daily_backup', 'daszek_cron_backup');
add_action('daszek_bridge_queue_gc', 'daszek_cron_bridge_queue_gc');
add_action('daszek_mail_ingest', 'daszek_cron_mail_ingest');
