<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Operator-only overlays on Daszek read models (Node A).
 * Archiving does not delete Node B truth; it hides cases from active operator lists.
 */

function daszek_v2_operator_archive_store_key() {
    return 'operator_case_archive';
}

function daszek_v2_operator_archive_map() {
    if (!daszek_v2_bootstrap_storage()) {
        return [];
    }
    $map = daszek_v2_load_map_store(daszek_v2_operator_archive_store_key());
    return is_array($map) ? $map : [];
}

function daszek_v2_is_case_archived($case_id) {
    $case_id = sanitize_text_field($case_id);
    if ($case_id === '') {
        return false;
    }
    $map = daszek_v2_operator_archive_map();
    return isset($map[$case_id]) && is_array($map[$case_id]);
}

function daszek_v2_case_activity_timestamp($case) {
    if (!is_array($case)) {
        return '';
    }
    foreach (['latest_signal_at', 'updated_at', 'created_at'] as $key) {
        if (!empty($case[$key]) && is_string($case[$key])) {
            return sanitize_text_field($case[$key]);
        }
    }
    return '';
}

function daszek_v2_compare_case_activity_desc($left, $right) {
    $left_ts = daszek_v2_case_activity_timestamp($left);
    $right_ts = daszek_v2_case_activity_timestamp($right);
    if ($left_ts === $right_ts) {
        $left_id = isset($left['case_id']) ? (string) $left['case_id'] : '';
        $right_id = isset($right['case_id']) ? (string) $right['case_id'] : '';
        return strcmp($left_id, $right_id);
    }
    return strcmp($right_ts, $left_ts);
}

function daszek_v2_archive_case($case_id, $meta = []) {
    $case_id = sanitize_text_field($case_id);
    if ($case_id === '') {
        return new WP_Error('invalid_case', 'Brak identyfikatora sprawy.', ['status' => 400]);
    }
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $map = daszek_v2_operator_archive_map();
    $user = function_exists('daszek_current_user') ? (daszek_current_user() ?: 'operator') : 'operator';
    $entry = [
        'case_id' => $case_id,
        'archived_at' => daszek_v2_now_iso(),
        'archived_by' => sanitize_text_field($user),
        'title' => isset($meta['title']) ? sanitize_text_field($meta['title']) : '',
        'summary' => isset($meta['summary']) ? sanitize_textarea_field($meta['summary']) : '',
        'latest_signal_at' => isset($meta['latest_signal_at']) ? sanitize_text_field($meta['latest_signal_at']) : '',
    ];
    $map[$case_id] = $entry;

    if (!daszek_v2_save_map_store(daszek_v2_operator_archive_store_key(), $map)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    daszek_v2_append_user_trace('', '', $case_id, '', 'archive_case', 'Operator przeniósł sprawę do archiwum Daszek.');

    return [
        'ok' => true,
        'archived' => true,
        'entry' => $entry,
    ];
}

function daszek_v2_unarchive_case($case_id) {
    $case_id = sanitize_text_field($case_id);
    if ($case_id === '') {
        return new WP_Error('invalid_case', 'Brak identyfikatora sprawy.', ['status' => 400]);
    }
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $map = daszek_v2_operator_archive_map();
    if (!isset($map[$case_id])) {
        return new WP_Error('not_found', 'Sprawa nie jest w archiwum.', ['status' => 404]);
    }

    unset($map[$case_id]);
    if (!daszek_v2_save_map_store(daszek_v2_operator_archive_store_key(), $map)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    daszek_v2_append_user_trace('', '', $case_id, '', 'unarchive_case', 'Operator przywrócił sprawę z archiwum Daszek.');

    return [
        'ok' => true,
        'archived' => false,
        'case_id' => $case_id,
    ];
}

function daszek_v2_build_case_archive_read_model() {
    $map = daszek_v2_operator_archive_map();
    $items = array_values($map);
    usort($items, function ($left, $right) {
        $left_at = isset($left['archived_at']) ? (string) $left['archived_at'] : '';
        $right_at = isset($right['archived_at']) ? (string) $right['archived_at'] : '';
        if ($left_at === $right_at) {
            return strcmp(isset($left['case_id']) ? (string) $left['case_id'] : '', isset($right['case_id']) ? (string) $right['case_id'] : '');
        }
        return strcmp($right_at, $left_at);
    });

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'view' => 'archive',
        'items' => $items,
        'ids' => array_values(array_map(function ($row) {
            return isset($row['case_id']) ? sanitize_text_field($row['case_id']) : '';
        }, $items)),
    ];
}
