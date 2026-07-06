<?php
if (!defined('ABSPATH')) exit;

/**
 * Daszek v2 canonical storage bootstrap.
 *
 * Gmail Intake remains the semantic owner. This layer persists canonical
 * objects and delegates read models / compatibility helpers to dedicated
 * include files.
 */

function daszek_v2_data_dir() {
    return rtrim(DASZEK_DATA_DIR, '/\\') . '/v2/';
}

function daszek_v2_storage_error_message() {
    return 'Nie mozna zapisac danych Daszek v2 w wp-content/uploads/daszek/v2/. Sprawdz katalog i uprawnienia.';
}

function daszek_v2_store_paths() {
    $base = daszek_v2_data_dir();
    return [
        'signals' => $base . 'signals.jsonl',
        'cases' => $base . 'cases.json',
        'desk_notes' => $base . 'desk_notes.json',
        'thread_memory' => $base . 'thread_memory.json',
        'decision_traces' => $base . 'decision_traces.jsonl',
        'feedback_events' => $base . 'feedback_events.jsonl',
        'action_proposals' => $base . 'action_proposals.jsonl',
        'execution_results' => $base . 'execution_results.jsonl',
        'ai_quality_summary' => $base . 'ai_quality_summary.json',
        'bridge_queue' => $base . 'bridge_queue.jsonl',
        'event_log' => $base . 'event_log.jsonl',
        'cohort_runs' => $base . 'cohort_runs.jsonl',
        'operator_case_archive' => $base . 'operator_case_archive.json',
    ];
}

function daszek_v2_bootstrap_storage() {
    $dir = daszek_v2_data_dir();
    if (!file_exists($dir) && !wp_mkdir_p($dir)) {
        return false;
    }

    $htaccess_file = $dir . '.htaccess';
    if (!file_exists($htaccess_file)) {
        file_put_contents($htaccess_file, "Deny from all\nOptions -Indexes\n");
    }

    foreach (daszek_v2_store_paths() as $store => $path) {
        if (file_exists($path)) {
            continue;
        }

        $initial = in_array($store, ['cases', 'desk_notes', 'thread_memory', 'ai_quality_summary', 'operator_case_archive'], true) ? "{}\n" : '';
        if (file_put_contents($path, $initial) === false) {
            return false;
        }
    }

    return true;
}

function daszek_v2_load_map_store($store) {
    $paths = daszek_v2_store_paths();
    if (!isset($paths[$store])) {
        return [];
    }

    $path = $paths[$store];
    if (!file_exists($path)) {
        return [];
    }

    $content = file_get_contents($path);
    if ($content === false || trim($content) === '') {
        return [];
    }

    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : [];
}

function daszek_v2_save_map_store($store, $data) {
    $paths = daszek_v2_store_paths();
    if (!isset($paths[$store])) {
        return false;
    }

    $path = $paths[$store];
    $tmp_path = $path . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }

    $lock_path = $path . '.lock';
    $lock_fp = fopen($lock_path, 'c+');
    if (!$lock_fp) {
        return false;
    }

    flock($lock_fp, LOCK_EX);
    $tmp_written = file_put_contents($tmp_path, $json);
    $renamed = false;
    if ($tmp_written !== false) {
        if (!file_exists($path) || @unlink($path)) {
            $renamed = rename($tmp_path, $path);
        }
    }
    flock($lock_fp, LOCK_UN);
    fclose($lock_fp);

    if ($tmp_written === false || !$renamed) {
        if (file_exists($tmp_path)) {
            @unlink($tmp_path);
        }
        return false;
    }

    return true;
}

function daszek_v2_append_jsonl_store($store, $entry) {
    $paths = daszek_v2_store_paths();
    if (!isset($paths[$store])) {
        return false;
    }

    $path = $paths[$store];
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE);
    if ($line === false) {
        return false;
    }

    $fp = fopen($path, 'ab');
    if (!$fp) {
        return false;
    }

    flock($fp, LOCK_EX);
    $written = fwrite($fp, $line . "\n");
    flock($fp, LOCK_UN);
    fclose($fp);

    return $written !== false;
}

function daszek_v2_append_jsonl_store_unique($store, $entry, $id_field) {
    $paths = daszek_v2_store_paths();
    if (!isset($paths[$store]) || !is_array($entry)) {
        return 'error';
    }

    $entry_id = isset($entry[$id_field]) ? sanitize_text_field($entry[$id_field]) : '';
    if ($entry_id === '') {
        return daszek_v2_append_jsonl_store($store, $entry) ? 'written' : 'error';
    }

    $path = $paths[$store];
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE);
    if ($line === false) {
        return 'error';
    }

    $fp = fopen($path, 'c+b');
    if (!$fp) {
        return 'error';
    }

    flock($fp, LOCK_EX);
    rewind($fp);
    while (($existing_line = fgets($fp)) !== false) {
        $decoded = json_decode(trim($existing_line), true);
        if (!is_array($decoded)) {
            continue;
        }
        $existing_id = isset($decoded[$id_field]) ? sanitize_text_field($decoded[$id_field]) : '';
        if ($existing_id !== '' && $existing_id === $entry_id) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return 'duplicate';
        }
    }

    fseek($fp, 0, SEEK_END);
    $written = fwrite($fp, $line . "\n");
    flock($fp, LOCK_UN);
    fclose($fp);

    return $written !== false ? 'written' : 'error';
}

function daszek_v2_load_jsonl_store($store) {
    $paths = daszek_v2_store_paths();
    if (!isset($paths[$store])) {
        return [];
    }

    $path = $paths[$store];
    if (!file_exists($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return [];
    }

    $items = [];
    foreach ($lines as $line) {
        $decoded = json_decode($line, true);
        if (is_array($decoded)) {
            $items[] = $decoded;
        }
    }

    return $items;
}

function daszek_v2_save_jsonl_store($store, $rows) {
    $paths = daszek_v2_store_paths();
    if (!isset($paths[$store]) || !is_array($rows)) {
        return false;
    }

    $path = $paths[$store];
    $tmp_path = $path . '.tmp.' . uniqid('', true);
    $fp = fopen($tmp_path, 'wb');
    if (!$fp) {
        return false;
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        @unlink($tmp_path);
        return false;
    }

    $ok = true;
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $line = json_encode($row, JSON_UNESCAPED_UNICODE);
        if ($line === false || fwrite($fp, $line . "\n") === false) {
            $ok = false;
            break;
        }
    }

    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if (!$ok || !rename($tmp_path, $path)) {
        @unlink($tmp_path);
        return false;
    }

    return true;
}

function daszek_v2_bridge_queue_gc($max_age_days = 90) {
    $rows = daszek_v2_load_jsonl_store('bridge_queue');
    $cutoff = strtotime('-' . max(1, (int) $max_age_days) . ' days');
    $kept = [];
    $removed = 0;

    foreach ($rows as $row) {
        $raw_ts = $row['created_at'] ?? $row['ingested_at'] ?? $row['updated_at'] ?? null;
        $ts = $raw_ts ? strtotime((string) $raw_ts) : false;
        if ($ts === false || $ts >= $cutoff) {
            $kept[] = $row;
        } else {
            $removed++;
        }
    }

    if ($removed > 0 && !daszek_v2_save_jsonl_store('bridge_queue', $kept)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    return $removed;
}

function daszek_v2_pick_projection_entry($payload, $keys) {
    foreach ($keys as $key) {
        if (isset($payload[$key]) && is_array($payload[$key])) {
            return $payload[$key];
        }
    }
    return null;
}

require_once __DIR__ . '/store-v2-domain.php';
require_once __DIR__ . '/store-v2-operator.php';
require_once __DIR__ . '/store-v2-read.php';
