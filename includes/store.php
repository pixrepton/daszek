<?php
if (!defined('ABSPATH')) exit;

/**
 * JSON-backed storage for Daszek work items.
 *
 * Backward compatibility:
 * - existing task-only records remain readable
 * - new intake-aware fields are optional and normalized on load/save
 */

function daszek_tasks_file() {
    return DASZEK_DATA_DIR . 'tasks.json';
}

function daszek_storage_error_message() {
    return 'Nie mozna zapisac danych Daszka w wp-content/uploads/daszek/tasks.json. Sprawdz istnienie katalogu i uprawnienia zapisu.';
}

function daszek_generate_id($tasks = null) {
    if (!is_array($tasks)) {
        $tasks = daszek_load_tasks();
    }

    $date = date('Ymd');
    $max_sequence = 0;

    foreach ($tasks as $task) {
        $id = isset($task['id']) ? strval($task['id']) : '';
        if (preg_match('/^tsk_' . preg_quote($date, '/') . '_(\d{4,})$/', $id, $matches)) {
            $max_sequence = max($max_sequence, intval($matches[1]));
        }
    }

    $next = str_pad(strval($max_sequence + 1), 4, '0', STR_PAD_LEFT);
    return "tsk_{$date}_{$next}";
}

function daszek_load_tasks() {
    $file = daszek_tasks_file();

    if (!file_exists($file)) {
        return [];
    }

    $fp = fopen($file, 'r');
    if (!$fp) {
        return [];
    }

    flock($fp, LOCK_SH);

    $content = '';
    while (!feof($fp)) {
        $content .= fread($fp, 8192);
    }

    flock($fp, LOCK_UN);
    fclose($fp);

    $tasks = json_decode($content, true);
    if (!is_array($tasks)) {
        return [];
    }

    $normalized = [];
    foreach ($tasks as $task) {
        if (is_array($task)) {
            $normalized[] = daszek_normalize_task_record($task);
        }
    }

    return $normalized;
}

function daszek_save_tasks($tasks) {
    if (!file_exists(DASZEK_DATA_DIR) && !wp_mkdir_p(DASZEK_DATA_DIR)) {
        return false;
    }

    $file = daszek_tasks_file();
    $tmp_file = $file . '.tmp';

    $normalized = [];
    foreach ($tasks as $task) {
        if (is_array($task)) {
            $normalized[] = daszek_normalize_task_record($task);
        }
    }

    usort($normalized, 'daszek_compare_tasks');
    $json = json_encode($normalized, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    $fp = fopen($file, 'c+');
    if (!$fp) {
        return false;
    }

    flock($fp, LOCK_EX);
    $tmp_written = file_put_contents($tmp_file, $json);
    $renamed = $tmp_written !== false ? rename($tmp_file, $file) : false;
    flock($fp, LOCK_UN);
    fclose($fp);

    if ($tmp_written === false || !$renamed) {
        if (file_exists($tmp_file)) {
            @unlink($tmp_file);
        }
        return false;
    }

    return true;
}

function daszek_add_task($data) {
    $tasks = daszek_load_tasks();
    $task = daszek_build_new_task($data, $tasks);
    $tasks[] = $task;
    if (!daszek_save_tasks($tasks)) {
        return [
            'error' => daszek_storage_error_message(),
            'task' => $task,
        ];
    }
    return $task;
}

function daszek_update_task($id, $data) {
    $tasks = daszek_load_tasks();
    $found = false;
    $updated = null;

    foreach ($tasks as &$task) {
        if (($task['id'] ?? null) !== $id) {
            continue;
        }

        $task = daszek_apply_task_update($task, $data);
        $found = true;
        $updated = $task;
        break;
    }

    if (!$found) {
        return null;
    }

    if (!daszek_save_tasks($tasks)) {
        return [
            'error' => daszek_storage_error_message(),
            'task' => $updated,
        ];
    }
    return $updated;
}

function daszek_mark_done($id) {
    return daszek_update_task($id, ['status' => 'done']);
}

function daszek_get_task($id) {
    $tasks = daszek_load_tasks();
    foreach ($tasks as $task) {
        if (($task['id'] ?? null) === $id) {
            return $task;
        }
    }
    return null;
}

function daszek_get_all_tasks() {
    $tasks = daszek_load_tasks();
    usort($tasks, 'daszek_compare_tasks');
    return $tasks;
}

function daszek_build_new_task($data, $existing_tasks = []) {
    $now = current_time('mysql');

    $task = [
        'id' => daszek_generate_id($existing_tasks),
        'title' => isset($data['title']) ? sanitize_text_field($data['title']) : '',
        'due_at' => daszek_normalize_due_at($data['due_at'] ?? null),
        'status' => daszek_normalize_status($data['status'] ?? 'open'),
        'user' => daszek_current_user() ?? 'system',
        'source' => daszek_normalize_source($data['source'] ?? 'manual'),
        'amount' => daszek_normalize_amount($data['amount'] ?? null),
        'created_at' => $now,
        'updated_at' => null,
        'kind' => daszek_normalize_kind($data['kind'] ?? 'task'),
        'priority' => daszek_normalize_priority($data['priority'] ?? 'medium'),
        'note' => daszek_normalize_note($data['note'] ?? null),
        'tags' => daszek_normalize_tags($data['tags'] ?? []),
        'external_ref' => daszek_normalize_external_ref($data['external_ref'] ?? null),
        'intake' => daszek_normalize_intake($data['intake'] ?? null),
    ];

    return daszek_normalize_task_record($task);
}

function daszek_apply_task_update($task, $data) {
    $merged = is_array($task) ? $task : [];
    $fields = [
        'title',
        'due_at',
        'status',
        'source',
        'amount',
        'kind',
        'priority',
        'note',
        'tags',
        'external_ref',
        'intake',
    ];

    foreach ($fields as $field) {
        if (array_key_exists($field, $data)) {
            $merged[$field] = $data[$field];
        }
    }

    $merged['user'] = daszek_current_user() ?? 'system';
    $merged['updated_at'] = current_time('mysql');

    return daszek_normalize_task_record($merged);
}

function daszek_normalize_task_record($task) {
    $created_at = isset($task['created_at']) && is_string($task['created_at']) && $task['created_at']
        ? $task['created_at']
        : current_time('mysql');

    $updated_at = null;
    if (isset($task['updated_at']) && is_string($task['updated_at']) && $task['updated_at']) {
        $updated_at = $task['updated_at'];
    }

    return [
        'id' => isset($task['id']) && is_string($task['id']) && $task['id'] ? sanitize_text_field($task['id']) : daszek_generate_id([]),
        'title' => isset($task['title']) ? sanitize_text_field($task['title']) : '',
        'due_at' => daszek_normalize_due_at($task['due_at'] ?? null),
        'status' => daszek_normalize_status($task['status'] ?? 'open'),
        'user' => isset($task['user']) && is_string($task['user']) && $task['user'] ? sanitize_text_field($task['user']) : 'system',
        'source' => daszek_normalize_source($task['source'] ?? 'manual'),
        'amount' => daszek_normalize_amount($task['amount'] ?? null),
        'created_at' => $created_at,
        'updated_at' => $updated_at,
        'kind' => daszek_normalize_kind($task['kind'] ?? 'task'),
        'priority' => daszek_normalize_priority($task['priority'] ?? 'medium'),
        'note' => daszek_normalize_note($task['note'] ?? null),
        'tags' => daszek_normalize_tags($task['tags'] ?? []),
        'external_ref' => daszek_normalize_external_ref($task['external_ref'] ?? null),
        'intake' => daszek_normalize_intake($task['intake'] ?? null),
    ];
}

function daszek_compare_tasks($a, $b) {
    $status_cmp = daszek_status_rank($a['status']) <=> daszek_status_rank($b['status']);
    if ($status_cmp !== 0) {
        return $status_cmp;
    }

    $due_a = $a['due_at'] ?: '9999-12-31';
    $due_b = $b['due_at'] ?: '9999-12-31';
    $due_cmp = strcmp($due_a, $due_b);
    if ($due_cmp !== 0) {
        return $due_cmp;
    }

    $priority_cmp = daszek_priority_rank($a['priority']) <=> daszek_priority_rank($b['priority']);
    if ($priority_cmp !== 0) {
        return $priority_cmp;
    }

    return strcmp($b['created_at'], $a['created_at']);
}

function daszek_status_rank($status) {
    return $status === 'done' ? 1 : 0;
}

function daszek_priority_rank($priority) {
    $map = [
        'critical' => 0,
        'high' => 1,
        'medium' => 2,
        'low' => 3,
    ];

    return isset($map[$priority]) ? $map[$priority] : 2;
}

function daszek_normalize_status($status) {
    $value = is_string($status) ? sanitize_text_field($status) : 'open';
    return in_array($value, ['open', 'done'], true) ? $value : 'open';
}

function daszek_normalize_source($source) {
    $value = is_string($source) ? sanitize_text_field($source) : 'manual';
    $allowed = ['manual', 'mail', 'auto', 'gmail_intake'];
    return in_array($value, $allowed, true) ? $value : 'manual';
}

function daszek_normalize_kind($kind) {
    $value = is_string($kind) ? sanitize_text_field($kind) : 'task';
    $allowed = ['task', 'review', 'reference', 'watchlist', 'case', 'case_update'];
    return in_array($value, $allowed, true) ? $value : 'task';
}

function daszek_normalize_priority($priority) {
    $value = is_string($priority) ? sanitize_text_field($priority) : 'medium';
    $allowed = ['critical', 'high', 'medium', 'low'];
    return in_array($value, $allowed, true) ? $value : 'medium';
}

function daszek_normalize_due_at($date) {
    if ($date === null || $date === '') {
        return null;
    }

    if (!is_string($date)) {
        return null;
    }

    return daszek_validate_date($date, true) ? $date : null;
}

function daszek_normalize_amount($amount) {
    if ($amount === null || $amount === '') {
        return null;
    }

    return is_numeric($amount) ? floatval($amount) : null;
}

function daszek_normalize_note($note) {
    if ($note === null || $note === '') {
        return null;
    }

    if (!is_string($note)) {
        return null;
    }

    $value = trim(sanitize_textarea_field($note));
    return $value !== '' ? $value : null;
}

function daszek_normalize_tags($tags) {
    $items = [];

    if (is_string($tags)) {
        $tags = preg_split('/[,;]/', $tags);
    }

    if (!is_array($tags)) {
        return [];
    }

    foreach ($tags as $tag) {
        if (!is_string($tag)) {
            continue;
        }
        $value = trim(sanitize_text_field($tag));
        if ($value !== '') {
            $items[] = $value;
        }
    }

    return array_values(array_unique($items));
}

function daszek_normalize_external_ref($external_ref) {
    if (!is_array($external_ref)) {
        return null;
    }

    $result = [];
    $allowed = ['channel', 'mailbox', 'message_id', 'thread_id', 'case_key', 'received_at'];

    foreach ($allowed as $key) {
        if (!isset($external_ref[$key]) || !is_string($external_ref[$key])) {
            continue;
        }
        $value = trim(sanitize_text_field($external_ref[$key]));
        if ($value !== '') {
            $result[$key] = $value;
        }
    }

    return !empty($result) ? $result : null;
}

function daszek_normalize_intake($intake) {
    if (!is_array($intake)) {
        return null;
    }

    $result = [];

    $string_fields = [
        'decision_action',
        'business_area',
        'case_family',
        'primary_signal_code',
        'primary_signal_name',
        'reason',
        'action_rationale',
        'state_detected',
    ];

    foreach ($string_fields as $field) {
        if (!isset($intake[$field]) || !is_string($intake[$field])) {
            continue;
        }
        $value = trim(sanitize_textarea_field($intake[$field]));
        if ($value !== '') {
            $result[$field] = $value;
        }
    }

    $result['review_required'] = !empty($intake['review_required']);
    $result['review_flags'] = daszek_normalize_tags($intake['review_flags'] ?? []);

    if (isset($intake['confidence']) && is_array($intake['confidence'])) {
        $confidence = [];
        foreach (['signal_confidence', 'case_link_confidence', 'decision_confidence', 'extraction_confidence'] as $field) {
            if (isset($intake['confidence'][$field]) && is_numeric($intake['confidence'][$field])) {
                $value = floatval($intake['confidence'][$field]);
                if ($value < 0) $value = 0;
                if ($value > 1) $value = 1;
                $confidence[$field] = $value;
            }
        }
        if (!empty($confidence)) {
            $result['confidence'] = $confidence;
        }
    }

    if (isset($intake['state_change']) && is_array($intake['state_change'])) {
        $state_change = [
            'detected' => !empty($intake['state_change']['detected']),
        ];
        foreach (['from_state', 'to_state'] as $field) {
            if (isset($intake['state_change'][$field]) && is_string($intake['state_change'][$field])) {
                $value = trim(sanitize_text_field($intake['state_change'][$field]));
                if ($value !== '') {
                    $state_change[$field] = $value;
                }
            }
        }
        $result['state_change'] = $state_change;
    }

    if (isset($intake['extracted_data']) && is_array($intake['extracted_data'])) {
        $result['extracted_data'] = json_decode(wp_json_encode($intake['extracted_data']), true);
    }

    return !empty($result) ? $result : null;
}
