<?php
if (!defined('ABSPATH')) exit;

function daszek_v2_build_compatibility_task_from_note($note, $cases) {
    $case_id = isset($note['case_id']) ? sanitize_text_field($note['case_id']) : '';
    $case = ($case_id !== '' && isset($cases[$case_id]) && is_array($cases[$case_id])) ? $cases[$case_id] : null;
    $status = (isset($note['lifecycle_state']) && $note['lifecycle_state'] === 'active') ? 'open' : 'done';
    $presence_mode = isset($note['presence_mode']) ? daszek_v2_normalize_presence_mode($note['presence_mode']) : 'silent';
    $priority_map = [
        'alarm' => 'critical',
        'strong' => 'high',
        'advisory' => 'medium',
        'standard' => 'medium',
        'subtle' => 'low',
        'silent' => 'low',
    ];

    $task = [
        'id' => isset($note['note_id']) ? $note['note_id'] : '',
        'title' => isset($note['title']) ? $note['title'] : 'Kartka AI',
        'due_at' => isset($note['due_at']) ? $note['due_at'] : null,
        'status' => $status,
        'user' => 'ai',
        'source' => 'gmail_intake',
        'amount' => null,
        'created_at' => isset($note['created_at']) ? $note['created_at'] : current_time('mysql'),
        'updated_at' => isset($note['updated_at']) ? $note['updated_at'] : null,
        'kind' => 'task',
        'priority' => isset($priority_map[$presence_mode]) ? $priority_map[$presence_mode] : 'medium',
        'note' => trim(
            (isset($note['why_on_desk']) ? $note['why_on_desk'] : '')
            . "\n"
            . (isset($note['recommended_next_step']) ? $note['recommended_next_step'] : '')
        ),
        'tags' => array_values(array_filter([
            'v2',
            isset($note['case_family']) ? $note['case_family'] : '',
            'obecnosc_' . $presence_mode,
        ])),
        'external_ref' => [
            'channel' => 'gmail',
            'message_id' => isset($note['source_message_id']) ? $note['source_message_id'] : '',
            'case_key' => $case && isset($case['case_key']) ? $case['case_key'] : $case_id,
        ],
        'intake' => [
            'decision_action' => 'v2_projection',
            'business_area' => $case && isset($case['family']) ? $case['family'] : 'unknown',
            'case_family' => isset($note['case_family']) ? $note['case_family'] : 'unknown',
            'primary_signal_code' => 'desk_note',
            'primary_signal_name' => 'Desk Note',
            'reason' => isset($note['why_on_desk']) ? $note['why_on_desk'] : '',
            'review_required' => false,
            'state_detected' => $case && isset($case['current_state']) ? $case['current_state'] : 'none',
        ],
    ];

    return function_exists('daszek_normalize_task_record') ? daszek_normalize_task_record($task) : $task;
}

function daszek_v2_legacy_task_signature($task) {
    $external_ref = isset($task['external_ref']) && is_array($task['external_ref']) ? $task['external_ref'] : [];
    return implode('|', [
        isset($external_ref['message_id']) ? $external_ref['message_id'] : '',
        isset($external_ref['case_key']) ? $external_ref['case_key'] : '',
        isset($task['title']) ? $task['title'] : '',
    ]);
}

function daszek_v2_get_compatibility_tasks() {
    $legacy_tasks = function_exists('daszek_load_tasks') ? daszek_load_tasks() : [];
    $cases = daszek_v2_load_map_store('cases');
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $signatures = [];

    foreach ($legacy_tasks as $task) {
        if (!is_array($task)) {
            continue;
        }
        $signatures[daszek_v2_legacy_task_signature($task)] = true;
        if (isset($task['id'])) {
            $signatures['id:' . $task['id']] = true;
        }
    }

    $derived = [];
    foreach ($desk_notes as $note) {
        if (!is_array($note) || empty($note['note_id'])) {
            continue;
        }
        $compat = daszek_v2_build_compatibility_task_from_note($note, $cases);
        $signature = daszek_v2_legacy_task_signature($compat);
        if (isset($signatures[$signature]) || isset($signatures['id:' . $compat['id']])) {
            continue;
        }
        $derived[] = $compat;
    }

    $merged = array_merge($legacy_tasks, $derived);
    if (function_exists('daszek_compare_tasks')) {
        usort($merged, 'daszek_compare_tasks');
    }
    return $merged;
}

function daszek_v2_get_compatibility_task($id) {
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $cases = daszek_v2_load_map_store('cases');
    $id = sanitize_text_field($id);
    if ($id === '' || !isset($desk_notes[$id]) || !is_array($desk_notes[$id])) {
        return null;
    }
    return daszek_v2_build_compatibility_task_from_note($desk_notes[$id], $cases);
}

function daszek_v2_mark_compatibility_task_done($id) {
    $result = daszek_v2_apply_feedback($id, 'to_juz_nieaktualne');
    if (is_wp_error($result)) {
        return $result;
    }
    return daszek_v2_get_compatibility_task($id);
}

function daszek_v2_update_compatibility_task($id, $payload) {
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $cases = daszek_v2_load_map_store('cases');
    $id = sanitize_text_field($id);

    if ($id === '' || !isset($desk_notes[$id]) || !is_array($desk_notes[$id])) {
        return null;
    }

    $note = $desk_notes[$id];
    if (isset($payload['due_at'])) {
        $note['due_at'] = daszek_validate_date($payload['due_at'], true) ? $payload['due_at'] : null;
    }
    if (isset($payload['title']) && is_string($payload['title']) && trim($payload['title']) !== '') {
        $note['title'] = sanitize_text_field($payload['title']);
        $note['title_pl'] = $note['title'];
    }
    if (isset($payload['note']) && is_string($payload['note']) && trim($payload['note']) !== '') {
        $note['summary'] = sanitize_textarea_field($payload['note']);
        $note['summary_pl'] = $note['summary'];
    }

    $note['updated_at'] = daszek_v2_now_iso();
    $desk_notes[$id] = $note;

    if (!daszek_v2_save_map_store('desk_notes', $desk_notes)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    daszek_v2_append_user_trace('desk_note', $id, isset($note['case_id']) ? $note['case_id'] : '', isset($note['source_signal_ids'][0]) ? $note['source_signal_ids'][0] : '', 'compatibility_update', 'Operator zaktualizował kartkę z widoku Zadań.');
    return daszek_v2_build_compatibility_task_from_note($note, $cases);
}
