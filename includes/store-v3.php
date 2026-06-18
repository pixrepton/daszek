<?php
if (!defined('ABSPATH')) exit;

/**
 * Daszek v3 storage — read-only snapshot stores (ingress quality, operational feed).
 * Separate from desk/cases/cohort_runs v2 projection truth on Node A.
 */

function daszek_v3_data_dir() {
    return rtrim(DASZEK_DATA_DIR, '/\\') . '/v3/';
}

function daszek_v3_ingress_snapshots_path() {
    return daszek_v3_data_dir() . 'ingress_quality_snapshots.jsonl';
}

function daszek_v3_operational_feed_snapshots_path() {
    return daszek_v3_data_dir() . 'operational_feed_snapshots.jsonl';
}

function daszek_v3_system_health_snapshots_path() {
    return daszek_v3_data_dir() . 'system_health_snapshots.jsonl';
}

function daszek_v3_storage_error_message() {
    return 'Nie mozna zapisac danych Daszek v3 w wp-content/uploads/daszek/v3/. Sprawdz katalog i uprawnienia.';
}

function daszek_v3_bootstrap_storage() {
    $dir = daszek_v3_data_dir();
    if (!file_exists($dir) && !wp_mkdir_p($dir)) {
        return false;
    }

    $htaccess_file = $dir . '.htaccess';
    if (!file_exists($htaccess_file)) {
        file_put_contents($htaccess_file, "Deny from all\nOptions -Indexes\n");
    }

    $path = daszek_v3_ingress_snapshots_path();
    if (!file_exists($path)) {
        if (file_put_contents($path, '') === false) {
            return false;
        }
    }

    $feed_path = daszek_v3_operational_feed_snapshots_path();
    if (!file_exists($feed_path)) {
        if (file_put_contents($feed_path, '') === false) {
            return false;
        }
    }

    $health_path = daszek_v3_system_health_snapshots_path();
    if (!file_exists($health_path)) {
        if (file_put_contents($health_path, '') === false) {
            return false;
        }
    }

    return true;
}

function daszek_v3_load_ingress_quality_snapshots() {
    $path = daszek_v3_ingress_snapshots_path();
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

function daszek_v3_snapshot_sort_key($row) {
    if (!is_array($row)) {
        return '';
    }
    foreach (['ingested_at', 'generated_at', 'created_at'] as $key) {
        if (!empty($row[$key])) {
            return (string) $row[$key];
        }
    }
    return '';
}

function daszek_v3_rewrite_ingress_snapshots($rows) {
    $path = daszek_v3_ingress_snapshots_path();
    $tmp_path = $path . '.tmp';
    $fp = fopen($tmp_path, 'wb');
    if (!$fp) {
        return false;
    }

    flock($fp, LOCK_EX);
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $line = json_encode($row, JSON_UNESCAPED_UNICODE);
        if ($line === false) {
            flock($fp, LOCK_UN);
            fclose($fp);
            @unlink($tmp_path);
            return false;
        }
        fwrite($fp, $line . "\n");
    }
    flock($fp, LOCK_UN);
    fclose($fp);

    if (!rename($tmp_path, $path)) {
        @unlink($tmp_path);
        return false;
    }

    return true;
}

/**
 * Replace any existing row with the same run_id, then append the new snapshot (dedupe by run_id).
 */
function daszek_v3_upsert_ingress_quality_snapshot($snapshot) {
    if (!is_array($snapshot)) {
        return false;
    }

    $run_id = isset($snapshot['run_id']) ? sanitize_text_field($snapshot['run_id']) : '';
    if ($run_id === '') {
        return false;
    }

    $existing = daszek_v3_load_ingress_quality_snapshots();
    $filtered = [];
    foreach ($existing as $row) {
        if (!is_array($row)) {
            continue;
        }
        $rid = isset($row['run_id']) ? sanitize_text_field($row['run_id']) : '';
        if ($rid !== '' && $rid === $run_id) {
            continue;
        }
        $filtered[] = $row;
    }

    $filtered[] = $snapshot;

    return daszek_v3_rewrite_ingress_snapshots($filtered);
}

function daszek_v3_sorted_ingress_snapshots_desc() {
    $rows = daszek_v3_load_ingress_quality_snapshots();
    usort($rows, function ($left, $right) {
        return strcmp(daszek_v3_snapshot_sort_key($right), daszek_v3_snapshot_sort_key($left));
    });
    return $rows;
}

function daszek_v3_latest_ingress_quality_snapshot() {
    $sorted = daszek_v3_sorted_ingress_snapshots_desc();
    if (empty($sorted)) {
        return null;
    }
    return $sorted[0];
}

function daszek_v3_get_ingress_quality_snapshot_by_run_id($run_id) {
    $needle = sanitize_text_field($run_id);
    if ($needle === '') {
        return null;
    }
    foreach (daszek_v3_sorted_ingress_snapshots_desc() as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (isset($row['run_id']) && sanitize_text_field($row['run_id']) === $needle) {
            return $row;
        }
    }
    return null;
}

/* --- Operational feed snapshots (Daszek V3 operator cockpit read model) --- */

function daszek_v3_load_operational_feed_snapshots() {
    $path = daszek_v3_operational_feed_snapshots_path();
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

function daszek_v3_rewrite_operational_feed_snapshots($rows) {
    $path = daszek_v3_operational_feed_snapshots_path();
    $tmp_path = $path . '.tmp';
    $fp = fopen($tmp_path, 'wb');
    if (!$fp) {
        return false;
    }

    flock($fp, LOCK_EX);
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $line = json_encode($row, JSON_UNESCAPED_UNICODE);
        if ($line === false) {
            flock($fp, LOCK_UN);
            fclose($fp);
            @unlink($tmp_path);
            return false;
        }
        fwrite($fp, $line . "\n");
    }
    flock($fp, LOCK_UN);
    fclose($fp);

    if (!rename($tmp_path, $path)) {
        @unlink($tmp_path);
        return false;
    }

    return true;
}

/**
 * Replace any existing row with the same snapshot_id, then append the new snapshot.
 */
function daszek_v3_upsert_operational_feed_snapshot($snapshot) {
    if (!is_array($snapshot)) {
        return false;
    }

    $snapshot_id = isset($snapshot['snapshot_id']) ? sanitize_text_field($snapshot['snapshot_id']) : '';
    if ($snapshot_id === '') {
        return false;
    }

    $existing = daszek_v3_load_operational_feed_snapshots();
    $filtered = [];
    foreach ($existing as $row) {
        if (!is_array($row)) {
            continue;
        }
        $sid = isset($row['snapshot_id']) ? sanitize_text_field($row['snapshot_id']) : '';
        if ($sid !== '' && $sid === $snapshot_id) {
            continue;
        }
        $filtered[] = $row;
    }

    $filtered[] = $snapshot;

    return daszek_v3_rewrite_operational_feed_snapshots($filtered);
}

function daszek_v3_sorted_operational_feed_snapshots_desc() {
    $rows = daszek_v3_load_operational_feed_snapshots();
    usort($rows, function ($left, $right) {
        return strcmp(daszek_v3_snapshot_sort_key($right), daszek_v3_snapshot_sort_key($left));
    });
    return $rows;
}

function daszek_v3_latest_operational_feed_snapshot() {
    $sorted = daszek_v3_sorted_operational_feed_snapshots_desc();
    if (empty($sorted)) {
        return null;
    }
    return $sorted[0];
}

function daszek_v3_get_operational_feed_snapshot_by_id($snapshot_id) {
    $needle = sanitize_text_field($snapshot_id);
    if ($needle === '') {
        return null;
    }
    foreach (daszek_v3_sorted_operational_feed_snapshots_desc() as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (isset($row['snapshot_id']) && sanitize_text_field($row['snapshot_id']) === $needle) {
            return $row;
        }
    }
    return null;
}

/* --- System health snapshots (Daszek V3 — W3 observability health strip) --- */

function daszek_v3_load_system_health_snapshots() {
    $path = daszek_v3_system_health_snapshots_path();
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

function daszek_v3_rewrite_system_health_snapshots($rows) {
    $path = daszek_v3_system_health_snapshots_path();
    $tmp_path = $path . '.tmp';
    $fp = fopen($tmp_path, 'wb');
    if (!$fp) {
        return false;
    }

    flock($fp, LOCK_EX);
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $line = json_encode($row, JSON_UNESCAPED_UNICODE);
        if ($line === false) {
            flock($fp, LOCK_UN);
            fclose($fp);
            @unlink($tmp_path);
            return false;
        }
        fwrite($fp, $line . "\n");
    }
    flock($fp, LOCK_UN);
    fclose($fp);

    if (!rename($tmp_path, $path)) {
        @unlink($tmp_path);
        return false;
    }

    return true;
}

function daszek_v3_upsert_system_health_snapshot($snapshot) {
    if (!is_array($snapshot)) {
        return false;
    }

    $snapshot_id = isset($snapshot['snapshot_id']) ? sanitize_text_field($snapshot['snapshot_id']) : '';
    if ($snapshot_id === '') {
        return false;
    }

    $existing = daszek_v3_load_system_health_snapshots();
    $filtered = [];
    foreach ($existing as $row) {
        if (!is_array($row)) {
            continue;
        }
        $sid = isset($row['snapshot_id']) ? sanitize_text_field($row['snapshot_id']) : '';
        if ($sid !== '' && $sid === $snapshot_id) {
            continue;
        }
        $filtered[] = $row;
    }

    $filtered[] = $snapshot;

    return daszek_v3_rewrite_system_health_snapshots($filtered);
}

function daszek_v3_sorted_system_health_snapshots_desc() {
    $rows = daszek_v3_load_system_health_snapshots();
    usort($rows, function ($left, $right) {
        return strcmp(daszek_v3_snapshot_sort_key($right), daszek_v3_snapshot_sort_key($left));
    });
    return $rows;
}

function daszek_v3_latest_system_health_snapshot() {
    $sorted = daszek_v3_sorted_system_health_snapshots_desc();
    if (empty($sorted)) {
        return null;
    }
    return $sorted[0];
}

function daszek_v3_get_system_health_snapshot_by_id($snapshot_id) {
    $needle = sanitize_text_field($snapshot_id);
    if ($needle === '') {
        return null;
    }
    foreach (daszek_v3_sorted_system_health_snapshots_desc() as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (isset($row['snapshot_id']) && sanitize_text_field($row['snapshot_id']) === $needle) {
            return $row;
        }
    }
    return null;
}
