<?php
if (!defined('ABSPATH')) exit;

function daszek_v2_signal_index() {
    $signals = daszek_v2_load_jsonl_store('signals');
    $index = [];
    foreach ($signals as $signal) {
        if (!is_array($signal) || empty($signal['signal_id'])) {
            continue;
        }
        $index[sanitize_text_field($signal['signal_id'])] = $signal;
    }
    return $index;
}

function daszek_v2_all_traces() {
    return daszek_v2_load_jsonl_store('decision_traces');
}

function daszek_v2_note_compare($left, $right) {
    $rank_compare = daszek_v2_presence_rank(isset($left['presence_mode']) ? $left['presence_mode'] : 'silent') <=> daszek_v2_presence_rank(isset($right['presence_mode']) ? $right['presence_mode'] : 'silent');
    if ($rank_compare !== 0) {
        return $rank_compare;
    }
    $left_score = isset($left['visibility_score']) ? floatval($left['visibility_score']) : 0.0;
    $right_score = isset($right['visibility_score']) ? floatval($right['visibility_score']) : 0.0;
    if ($left_score !== $right_score) {
        return $right_score <=> $left_score;
    }
    $left_updated = isset($left['updated_at']) ? $left['updated_at'] : '';
    $right_updated = isset($right['updated_at']) ? $right['updated_at'] : '';
    return strcmp($right_updated, $left_updated);
}

function daszek_v2_signals_for_ids($signal_ids) {
    $signals = [];
    $index = daszek_v2_signal_index();
    if (!is_array($signal_ids)) {
        return [];
    }
    foreach ($signal_ids as $signal_id) {
        $key = sanitize_text_field($signal_id);
        if ($key !== '' && isset($index[$key])) {
            $signals[] = $index[$key];
        }
    }
    return $signals;
}

function daszek_v2_traces_for_subject($subject_type, $subject_id, $case_id) {
    $result = [];
    foreach (daszek_v2_all_traces() as $trace) {
        if (!is_array($trace)) {
            continue;
        }
        if ($subject_type !== '' && isset($trace['subject_type']) && $trace['subject_type'] === $subject_type && isset($trace['subject_id']) && $trace['subject_id'] === $subject_id) {
            $result[] = $trace;
            continue;
        }
        if ($case_id !== '' && isset($trace['case_id']) && $trace['case_id'] === $case_id) {
            $result[] = $trace;
        }
    }
    usort($result, function ($left, $right) {
        $left_at = isset($left['created_at']) ? $left['created_at'] : '';
        $right_at = isset($right['created_at']) ? $right['created_at'] : '';
        return strcmp($right_at, $left_at);
    });
    return $result;
}

function daszek_v2_build_signal_read_item($signal) {
    if (!is_array($signal)) {
        return [];
    }

    $item = $signal;
    $intake = isset($signal['intake']) && is_array($signal['intake']) ? $signal['intake'] : [];
    $intake['business_area_label'] = daszek_v2_business_area_label_pl(isset($intake['business_area']) ? $intake['business_area'] : '');
    $item['intake'] = $intake;
    return $item;
}

function daszek_v2_build_trace_read_item($trace) {
    if (!is_array($trace)) {
        return [];
    }

    $item = $trace;
    $item['decision_type_label'] = daszek_v2_trace_decision_label_pl(isset($trace['decision_type']) ? $trace['decision_type'] : '');
    $source_meta = daszek_v2_trace_source_meta($trace);
    $item['actor_source'] = $source_meta['source'];
    $item['actor_source_label'] = $source_meta['source_label'];
    $item['maintenance_rule'] = isset($trace['maintenance_rule']) ? sanitize_text_field($trace['maintenance_rule']) : '';
    $item['maintenance_rule_label_pl'] = isset($trace['maintenance_rule_label_pl']) ? sanitize_text_field($trace['maintenance_rule_label_pl']) : '';
    return $item;
}

function daszek_v2_trace_source_meta($trace) {
    if (!is_array($trace)) {
        return ['source' => 'unknown', 'source_label' => 'Nieznane zrodlo'];
    }
    $decision_type = isset($trace['decision_type']) ? sanitize_text_field($trace['decision_type']) : '';
    $actor = isset($trace['actor']) ? sanitize_text_field($trace['actor']) : '';
    if (strpos($decision_type, 'maintenance_') === 0 || $actor === 'system_maintenance') {
        return ['source' => 'maintenance', 'source_label' => 'Maintenance'];
    }
    if (in_array($decision_type, ['trafne', 'za_mocne', 'za_slabe', 'tylko_w_sprawie', 'nie_pokazuj_takich', 'polacz_ze_sprawa', 'to_juz_nieaktualne', 'zla_sprawa'], true)) {
        return ['source' => 'operator', 'source_label' => 'Operator'];
    }
    if ($actor !== '' && !in_array($actor, ['ai', 'system_maintenance'], true)) {
        return ['source' => 'operator', 'source_label' => 'Operator'];
    }
    return ['source' => 'intake', 'source_label' => 'Intake AI'];
}

function daszek_v2_last_trace_meta($subject_type, $subject_id, $case_id) {
    $traces = daszek_v2_traces_for_subject($subject_type, $subject_id, $case_id);
    if (empty($traces)) {
        return [
            'source' => 'intake',
            'source_label' => 'Intake AI',
            'decision_type' => '',
            'decision_type_label' => '',
            'maintenance_rule' => '',
            'maintenance_rule_label_pl' => '',
            'reason_summary_pl' => '',
            'created_at' => '',
        ];
    }
    $latest = $traces[0];
    $source_meta = daszek_v2_trace_source_meta($latest);
    return [
        'source' => $source_meta['source'],
        'source_label' => $source_meta['source_label'],
        'decision_type' => isset($latest['decision_type']) ? sanitize_text_field($latest['decision_type']) : '',
        'decision_type_label' => daszek_v2_trace_decision_label_pl(isset($latest['decision_type']) ? $latest['decision_type'] : ''),
        'maintenance_rule' => isset($latest['maintenance_rule']) ? sanitize_text_field($latest['maintenance_rule']) : '',
        'maintenance_rule_label_pl' => isset($latest['maintenance_rule_label_pl']) ? sanitize_text_field($latest['maintenance_rule_label_pl']) : '',
        'reason_summary_pl' => isset($latest['reason_summary_pl']) ? sanitize_textarea_field($latest['reason_summary_pl']) : '',
        'created_at' => isset($latest['created_at']) ? sanitize_text_field($latest['created_at']) : '',
    ];
}

function daszek_v2_feedback_guard_meta($feedback_state, $days = 7) {
    $empty = [
        'blocked' => false,
        'blocked_until' => '',
        'last_action' => '',
        'last_action_label' => '',
        'reason_pl' => '',
    ];
    if (!is_array($feedback_state)) {
        return $empty;
    }
    $last_action = isset($feedback_state['ostatnia_akcja']) ? sanitize_text_field($feedback_state['ostatnia_akcja']) : '';
    $last_action_at = isset($feedback_state['ostatnia_akcja_at']) ? sanitize_text_field($feedback_state['ostatnia_akcja_at']) : '';
    if ($last_action === '' || $last_action_at === '') {
        return $empty;
    }
    $last_ts = strtotime($last_action_at);
    if (!$last_ts) {
        return $empty;
    }
    $blocked_until_ts = $last_ts + (intval($days) * 24 * 60 * 60);
    $blocked = $blocked_until_ts > time();
    return [
        'blocked' => $blocked,
        'blocked_until' => gmdate('c', $blocked_until_ts),
        'last_action' => $last_action,
        'last_action_label' => daszek_v2_trace_decision_label_pl($last_action),
        'reason_pl' => $blocked ? 'Swiezy manual feedback blokuje maintenance przez 7 dni.' : '',
    ];
}

function daszek_v2_build_case_read_item($case) {
    if (!is_array($case)) {
        return [];
    }

    $family = isset($case['family']) ? $case['family'] : 'unknown';
    $status = isset($case['status']) ? $case['status'] : 'open';
    $current_state = isset($case['current_state']) ? $case['current_state'] : 'none';

    return [
        'case_id' => isset($case['case_id']) ? $case['case_id'] : '',
        'case_key' => isset($case['case_key']) ? $case['case_key'] : '',
        'case_key_source' => isset($case['case_key_source']) ? $case['case_key_source'] : 'none',
        'title' => isset($case['title']) ? $case['title'] : '',
        'summary' => isset($case['summary']) ? $case['summary'] : '',
        'family' => $family,
        'business_area' => isset($case['business_area']) ? $case['business_area'] : '',
        'business_area_label' => daszek_v2_business_area_label_pl(isset($case['business_area']) ? $case['business_area'] : ''),
        'business_priority' => isset($case['business_priority']) ? $case['business_priority'] : 'medium',
        'family_label' => daszek_v2_case_family_label_pl($family),
        'status' => $status,
        'status_label' => daszek_v2_case_status_label_pl($status),
        'current_state' => $current_state,
        'current_state_label' => daszek_v2_case_state_label_pl($current_state),
        'operator_brief_pl' => isset($case['operator_brief_pl']) ? $case['operator_brief_pl'] : '',
        'latest_meaningful_change_pl' => isset($case['latest_meaningful_change_pl']) ? $case['latest_meaningful_change_pl'] : '',
        'attention_reason_pl' => isset($case['attention_reason_pl']) ? $case['attention_reason_pl'] : '',
        'primary_next_action_type' => isset($case['primary_next_action_type']) ? $case['primary_next_action_type'] : '',
        'primary_next_action_title_pl' => isset($case['primary_next_action_title_pl']) ? $case['primary_next_action_title_pl'] : '',
        'primary_next_action_reason_pl' => isset($case['primary_next_action_reason_pl']) ? $case['primary_next_action_reason_pl'] : '',
        'missing_info_summary_pl' => isset($case['missing_info_summary_pl']) ? $case['missing_info_summary_pl'] : '',
        'risk_summary_pl' => isset($case['risk_summary_pl']) ? $case['risk_summary_pl'] : '',
        'blockers' => isset($case['blockers']) ? $case['blockers'] : [],
        'risks' => isset($case['risks']) ? $case['risks'] : [],
        'missing_info' => isset($case['missing_info']) ? $case['missing_info'] : [],
        'merge_candidates' => isset($case['merge_candidates']) ? $case['merge_candidates'] : [],
        'split_suspicions' => isset($case['split_suspicions']) ? $case['split_suspicions'] : [],
        'case_snapshot' => isset($case['case_snapshot']) ? $case['case_snapshot'] : [],
        'key_facts' => isset($case['key_facts']) ? $case['key_facts'] : [],
        'latest_documents' => isset($case['latest_documents']) ? $case['latest_documents'] : [],
        'conflicting_facts' => isset($case['conflicting_facts']) ? $case['conflicting_facts'] : [],
        'drive_documents_summary' => isset($case['drive_documents_summary']) ? $case['drive_documents_summary'] : [],
        'completeness_gaps' => isset($case['completeness_gaps']) ? $case['completeness_gaps'] : [],
        'graph_hints' => isset($case['graph_hints']) ? $case['graph_hints'] : [],
        'reference_documents' => isset($case['reference_documents']) ? $case['reference_documents'] : [],
        'warranty_service_state' => isset($case['warranty_service_state']) ? $case['warranty_service_state'] : [],
        'media_evidence_presence' => isset($case['media_evidence_presence']) ? $case['media_evidence_presence'] : [],
        'related_entities' => isset($case['related_entities']) ? $case['related_entities'] : [],
        'operator_visible_conflicts' => isset($case['operator_visible_conflicts']) ? $case['operator_visible_conflicts'] : [],
        'evidence_cards' => isset($case['evidence_cards']) ? $case['evidence_cards'] : [],
        'service_signals' => isset($case['service_signals']) ? $case['service_signals'] : [],
        'marketing_signals' => isset($case['marketing_signals']) ? $case['marketing_signals'] : [],
        'action_proposals' => isset($case['action_proposals']) ? $case['action_proposals'] : [],
        'execution_results' => isset($case['execution_results']) ? $case['execution_results'] : [],
        'calendar' => isset($case['calendar']) ? $case['calendar'] : [],
        'document_intelligence' => isset($case['document_intelligence']) ? $case['document_intelligence'] : [],
        'source_refs' => isset($case['source_refs']) ? $case['source_refs'] : [],
        'review_required' => !empty($case['review_required']),
        'review_mode' => isset($case['review_mode']) ? $case['review_mode'] : '',
        'review_reason_pl' => isset($case['review_reason_pl']) ? $case['review_reason_pl'] : '',
        'attachment_summary_pl' => isset($case['attachment_summary_pl']) ? $case['attachment_summary_pl'] : '',
        'thread_summary_pl' => isset($case['thread_summary_pl']) ? $case['thread_summary_pl'] : '',
        'unresolved_questions' => isset($case['unresolved_questions']) ? $case['unresolved_questions'] : [],
        'latest_signal_id' => isset($case['latest_signal_id']) ? $case['latest_signal_id'] : '',
        'latest_signal_at' => isset($case['latest_signal_at']) ? $case['latest_signal_at'] : '',
        'active_note_count' => isset($case['active_note_count']) ? intval($case['active_note_count']) : 0,
        'open_desk_note_id' => isset($case['open_desk_note_id']) ? $case['open_desk_note_id'] : '',
        'operational_status' => isset($case['operational_status']) ? $case['operational_status'] : '',
        'operational_status_label' => daszek_v2_guidance_operational_status_label_pl(isset($case['operational_status']) ? $case['operational_status'] : ''),
        'waiting_for' => isset($case['waiting_for']) ? $case['waiting_for'] : '',
        'waiting_for_label' => daszek_v2_guidance_waiting_for_label_pl(isset($case['waiting_for']) ? $case['waiting_for'] : ''),
        'guidance_reason_summary_pl' => isset($case['guidance_reason_summary_pl']) ? $case['guidance_reason_summary_pl'] : '',
        'blocker_summary_pl' => isset($case['blocker_summary_pl']) ? $case['blocker_summary_pl'] : '',
        'momentum' => isset($case['momentum']) ? $case['momentum'] : '',
        'momentum_label' => daszek_v2_guidance_momentum_label_pl(isset($case['momentum']) ? $case['momentum'] : ''),
        'stagnation_flag' => !empty($case['stagnation_flag']),
        'stagnation_reason_pl' => isset($case['stagnation_reason_pl']) ? $case['stagnation_reason_pl'] : '',
        'business_readiness' => isset($case['business_readiness']) ? $case['business_readiness'] : '',
        'business_readiness_label' => daszek_v2_guidance_business_readiness_label_pl(isset($case['business_readiness']) ? $case['business_readiness'] : ''),
        'operator_attention_class' => isset($case['operator_attention_class']) ? $case['operator_attention_class'] : '',
        'operator_attention_label' => daszek_v2_guidance_operator_attention_label_pl(isset($case['operator_attention_class']) ? $case['operator_attention_class'] : ''),
        'next_step_hint_pl' => isset($case['next_step_hint_pl']) ? $case['next_step_hint_pl'] : '',
        'guidance_confidence' => isset($case['guidance_confidence']) ? floatval($case['guidance_confidence']) : 0.0,
        'understanding_quality' => isset($case['understanding_quality']) && is_array($case['understanding_quality']) ? $case['understanding_quality'] : [],
        'readiness_facets' => isset($case['readiness_facets']) && is_array($case['readiness_facets']) ? $case['readiness_facets'] : [],
    ];
}

function daszek_v2_resolve_thread_memory($signals, $case = null) {
    $thread_map = daszek_v2_load_map_store('thread_memory');
    if (!is_array($thread_map) || empty($thread_map)) {
        return [];
    }

    $preferred_signal_id = is_array($case) && isset($case['latest_signal_id']) ? sanitize_text_field($case['latest_signal_id']) : '';
    $preferred_thread_id = '';
    $fallback_thread_id = '';

    foreach ($signals as $signal) {
        if (!is_array($signal)) {
            continue;
        }
        $source_ref = isset($signal['source_ref']) && is_array($signal['source_ref']) ? $signal['source_ref'] : [];
        $thread_id = isset($source_ref['thread_id']) ? sanitize_text_field($source_ref['thread_id']) : '';
        if ($thread_id === '') {
            continue;
        }
        if ($fallback_thread_id === '') {
            $fallback_thread_id = $thread_id;
        }
        $signal_id = isset($signal['signal_id']) ? sanitize_text_field($signal['signal_id']) : '';
        if ($preferred_signal_id !== '' && $signal_id === $preferred_signal_id) {
            $preferred_thread_id = $thread_id;
            break;
        }
    }

    $thread_id = $preferred_thread_id !== '' ? $preferred_thread_id : $fallback_thread_id;
    if ($thread_id === '' || !isset($thread_map[$thread_id]) || !is_array($thread_map[$thread_id])) {
        return [];
    }
    return $thread_map[$thread_id];
}

function daszek_v2_build_note_card($note, $cases) {
    $case_id = isset($note['case_id']) ? sanitize_text_field($note['case_id']) : '';
    $case = ($case_id !== '' && isset($cases[$case_id]) && is_array($cases[$case_id])) ? $cases[$case_id] : null;
    $last_change = daszek_v2_last_trace_meta('desk_note', isset($note['note_id']) ? $note['note_id'] : '', $case_id);
    $maintenance_guard = daszek_v2_feedback_guard_meta(isset($note['feedback_state']) ? $note['feedback_state'] : []);

    return [
        'note_id' => isset($note['note_id']) ? $note['note_id'] : '',
        'case_id' => $case_id,
        'title' => isset($note['title']) ? $note['title'] : '',
        'summary' => isset($note['summary']) ? $note['summary'] : '',
        'why_on_desk' => isset($note['why_on_desk']) ? $note['why_on_desk'] : '',
        'recommended_next_step' => isset($note['recommended_next_step']) ? $note['recommended_next_step'] : '',
        'assistant_suggestion_pl' => isset($note['assistant_suggestion_pl']) ? $note['assistant_suggestion_pl'] : '',
        'operator_brief_pl' => isset($note['operator_brief_pl']) ? $note['operator_brief_pl'] : '',
        'missing_info_summary_pl' => isset($note['missing_info_summary_pl']) ? $note['missing_info_summary_pl'] : '',
        'risk_summary_pl' => isset($note['risk_summary_pl']) ? $note['risk_summary_pl'] : '',
        'surface_zone' => isset($note['surface_zone']) ? $note['surface_zone'] : 'silent',
        'day_bucket' => isset($note['day_bucket']) ? $note['day_bucket'] : 'dzisiaj',
        'presence_mode' => isset($note['presence_mode']) ? daszek_v2_normalize_presence_mode($note['presence_mode']) : 'silent',
        'presence_label' => daszek_v2_presence_label_pl(isset($note['presence_mode']) ? $note['presence_mode'] : 'silent'),
        'lifecycle_state' => isset($note['lifecycle_state']) ? $note['lifecycle_state'] : 'active',
        'lifecycle_label' => daszek_v2_lifecycle_label_pl(isset($note['lifecycle_state']) ? $note['lifecycle_state'] : 'active'),
        'updated_at' => isset($note['updated_at']) ? $note['updated_at'] : '',
        'due_at' => isset($note['due_at']) ? $note['due_at'] : null,
        'visibility_score' => isset($note['visibility_score']) ? floatval($note['visibility_score']) : 0.0,
        'case_title' => $case && isset($case['title']) ? $case['title'] : '',
        'case_state' => $case && isset($case['current_state']) ? $case['current_state'] : '',
        'case_state_label' => $case ? daszek_v2_case_state_label_pl(isset($case['current_state']) ? $case['current_state'] : 'none') : '',
        'source_count' => isset($note['source_signal_ids']) && is_array($note['source_signal_ids']) ? count($note['source_signal_ids']) : 0,
        'feedback_state' => isset($note['feedback_state']) ? $note['feedback_state'] : daszek_v2_default_feedback_state(),
        'maintenance_guard' => $maintenance_guard,
        'latest_change_source' => $last_change['source'],
        'latest_change_source_label' => $last_change['source_label'],
        'latest_change_decision_type' => $last_change['decision_type'],
        'latest_change_decision_label' => $last_change['decision_type_label'],
        'latest_change_rule' => $last_change['maintenance_rule'],
        'latest_change_rule_label' => $last_change['maintenance_rule_label_pl'],
        'latest_change_reason_pl' => $last_change['reason_summary_pl'],
        'latest_change_at' => $last_change['created_at'],
        'attachment_summary_pl' => isset($note['attachment_summary_pl']) ? $note['attachment_summary_pl'] : '',
        'thread_summary_pl' => isset($note['thread_summary_pl']) ? $note['thread_summary_pl'] : '',
        'unresolved_questions' => isset($note['unresolved_questions']) ? $note['unresolved_questions'] : [],
        'case_snapshot' => isset($note['case_snapshot']) ? $note['case_snapshot'] : [],
        'key_facts' => isset($note['key_facts']) ? $note['key_facts'] : [],
        'latest_documents' => isset($note['latest_documents']) ? $note['latest_documents'] : [],
        'conflicting_facts' => isset($note['conflicting_facts']) ? $note['conflicting_facts'] : [],
        'drive_documents_summary' => isset($note['drive_documents_summary']) ? $note['drive_documents_summary'] : [],
        'completeness_gaps' => isset($note['completeness_gaps']) ? $note['completeness_gaps'] : [],
        'graph_hints' => isset($note['graph_hints']) ? $note['graph_hints'] : [],
        'reference_documents' => isset($note['reference_documents']) ? $note['reference_documents'] : [],
        'warranty_service_state' => isset($note['warranty_service_state']) ? $note['warranty_service_state'] : [],
        'media_evidence_presence' => isset($note['media_evidence_presence']) ? $note['media_evidence_presence'] : [],
        'related_entities' => isset($note['related_entities']) ? $note['related_entities'] : [],
        'operator_visible_conflicts' => isset($note['operator_visible_conflicts']) ? $note['operator_visible_conflicts'] : [],
        'evidence_cards' => isset($note['evidence_cards']) ? $note['evidence_cards'] : [],
        'service_signals' => isset($note['service_signals']) ? $note['service_signals'] : [],
        'marketing_signals' => isset($note['marketing_signals']) ? $note['marketing_signals'] : [],
        'action_proposals' => isset($note['action_proposals']) ? $note['action_proposals'] : [],
        'execution_results' => isset($note['execution_results']) ? $note['execution_results'] : [],
        'calendar' => isset($note['calendar']) ? $note['calendar'] : [],
        'document_intelligence' => isset($note['document_intelligence']) ? $note['document_intelligence'] : [],
        'source_refs' => isset($note['source_refs']) ? $note['source_refs'] : [],
        'review_mode' => isset($note['review_mode']) ? $note['review_mode'] : '',
        'review_reason_pl' => isset($note['review_reason_pl']) ? $note['review_reason_pl'] : '',
        'operational_status' => isset($note['operational_status']) ? $note['operational_status'] : '',
        'operational_status_label' => daszek_v2_guidance_operational_status_label_pl(isset($note['operational_status']) ? $note['operational_status'] : ''),
        'waiting_for' => isset($note['waiting_for']) ? $note['waiting_for'] : '',
        'waiting_for_label' => daszek_v2_guidance_waiting_for_label_pl(isset($note['waiting_for']) ? $note['waiting_for'] : ''),
        'guidance_reason_summary_pl' => isset($note['guidance_reason_summary_pl']) ? $note['guidance_reason_summary_pl'] : '',
        'blocker_summary_pl' => isset($note['blocker_summary_pl']) ? $note['blocker_summary_pl'] : '',
        'stagnation_flag' => !empty($note['stagnation_flag']),
        'operator_attention_class' => isset($note['operator_attention_class']) ? $note['operator_attention_class'] : '',
        'operator_attention_label' => daszek_v2_guidance_operator_attention_label_pl(isset($note['operator_attention_class']) ? $note['operator_attention_class'] : ''),
        'next_step_hint_pl' => isset($note['next_step_hint_pl']) ? $note['next_step_hint_pl'] : '',
        'guidance_confidence' => isset($note['guidance_confidence']) ? floatval($note['guidance_confidence']) : 0.0,
        'understanding_quality' => isset($note['understanding_quality']) && is_array($note['understanding_quality']) ? $note['understanding_quality'] : [],
        'readiness_facets' => isset($note['readiness_facets']) && is_array($note['readiness_facets']) ? $note['readiness_facets'] : [],
    ];
}

function daszek_v2_get_desk_items($include_subtle = false, $surface_scope = 'desk') {
    $notes = array_values(daszek_v2_load_map_store('desk_notes'));
    $cases = daszek_v2_load_map_store('cases');
    $filtered = [];

    foreach ($notes as $note) {
        if (!is_array($note)) {
            continue;
        }
        $lifecycle_state = isset($note['lifecycle_state']) ? $note['lifecycle_state'] : 'active';
        $presence_mode = isset($note['presence_mode']) ? daszek_v2_normalize_presence_mode($note['presence_mode']) : 'silent';
        $surface_zone = isset($note['surface_zone']) ? sanitize_text_field($note['surface_zone']) : ($presence_mode === 'silent' ? 'silent' : 'desk');
        if ($lifecycle_state !== 'active') {
            continue;
        }
        if ($presence_mode === 'silent') {
            continue;
        }
        if ($surface_scope === 'desk' && $surface_zone !== 'desk') {
            continue;
        }
        if ($surface_scope === 'day' && !in_array($surface_zone, ['desk', 'day'], true)) {
            continue;
        }
        if (!$include_subtle && $presence_mode === 'subtle') {
            continue;
        }
        $filtered[] = daszek_v2_build_note_card($note, $cases);
    }

    usort($filtered, 'daszek_v2_note_compare');
    return $filtered;
}

function daszek_v2_build_desk_read_model($include_subtle = false) {
    $items = daszek_v2_get_desk_items(!empty($include_subtle), 'desk');
    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'view' => 'desk',
        'items' => $items,
        'counts' => [
            'visible' => count($items),
            'strong_or_alarm' => count(array_filter($items, function ($item) {
                return in_array($item['presence_mode'], ['strong', 'alarm'], true);
            })),
        ],
    ];
}

function daszek_v2_build_day_read_model($include_subtle = true) {
    $items = daszek_v2_get_desk_items(!empty($include_subtle), 'day');
    $sections = [
        'teraz' => ['key' => 'teraz', 'title' => 'Teraz', 'items' => []],
        'dzisiaj' => ['key' => 'dzisiaj', 'title' => 'Dzisiaj', 'items' => []],
        'w_najblizszym_czasie' => ['key' => 'w_najblizszym_czasie', 'title' => 'W najbliższym czasie', 'items' => []],
    ];

    foreach ($items as $item) {
        $bucket = isset($item['day_bucket']) ? $item['day_bucket'] : '';
        if ($bucket !== '' && isset($sections[$bucket])) {
            $sections[$bucket]['items'][] = $item;
        } elseif (in_array($item['presence_mode'], ['alarm', 'strong'], true)) {
            $sections['teraz']['items'][] = $item;
        } elseif (in_array($item['presence_mode'], ['advisory', 'standard'], true)) {
            $sections['dzisiaj']['items'][] = $item;
        } else {
            $sections['w_najblizszym_czasie']['items'][] = $item;
        }
    }

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'view' => 'day',
        'sections' => array_values($sections),
    ];
}

function daszek_v2_build_cases_read_model() {
    $cases = array_values(daszek_v2_load_map_store('cases'));
    usort($cases, 'daszek_v2_compare_case_activity_desc');

    $items = [];
    foreach ($cases as $case) {
        if (!is_array($case)) {
            continue;
        }
        $case_id = isset($case['case_id']) ? sanitize_text_field($case['case_id']) : '';
        if ($case_id !== '' && daszek_v2_is_case_archived($case_id)) {
            continue;
        }
        $items[] = daszek_v2_build_case_read_item($case);
    }

    return ['ok' => true, 'generated_at' => daszek_v2_now_iso(), 'view' => 'cases', 'items' => $items];
}

function daszek_v2_get_case_detail($case_id) {
    $cases = daszek_v2_load_map_store('cases');
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $case_id = sanitize_text_field($case_id);

    if ($case_id === '' || !isset($cases[$case_id]) || !is_array($cases[$case_id])) {
        return null;
    }

    $case = $cases[$case_id];
    $notes = [];
    $signal_ids = [];
    foreach ($desk_notes as $note) {
        if (!is_array($note) || !isset($note['case_id']) || $note['case_id'] !== $case_id) {
            continue;
        }
        $notes[] = $note;
        $signal_ids = daszek_v2_merge_signal_ids($signal_ids, isset($note['source_signal_ids']) ? $note['source_signal_ids'] : []);
    }
    if (isset($case['latest_signal_id'])) {
        $signal_ids = daszek_v2_merge_signal_ids($signal_ids, [isset($case['latest_signal_id']) ? $case['latest_signal_id'] : '']);
    }

    usort($notes, 'daszek_v2_note_compare');
    $signals = daszek_v2_signals_for_ids($signal_ids);
    $last_change = daszek_v2_last_trace_meta('', '', $case_id);
    $action_proposals = daszek_v2_action_proposals_for_case($case_id);
    $execution_results = daszek_v2_execution_results_for_case($case_id);
    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'case' => daszek_v2_build_case_read_item($case),
        'desk_notes' => $notes,
        'signals' => array_values(array_map('daszek_v2_build_signal_read_item', $signals)),
        'decision_traces' => array_values(array_map('daszek_v2_build_trace_read_item', daszek_v2_traces_for_subject('', '', $case_id))),
        'last_change' => $last_change,
        'thread_memory' => daszek_v2_resolve_thread_memory($signals, $case),
        'operational_timeline' => daszek_v2_build_operational_timeline($case_id),
        'action_proposals' => $action_proposals,
        'execution_results' => $execution_results,
    ];
}

function daszek_v2_action_proposals_for_case($case_id) {
    $case_id = sanitize_text_field($case_id);
    $rows = daszek_v2_load_jsonl_store('action_proposals');
    $out = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        if ($case_id !== '' && isset($row['case_id']) && sanitize_text_field($row['case_id']) === $case_id) {
            $out[] = $row;
        }
    }
    usort($out, function ($a, $b) {
        return strcmp(isset($b['created_at']) ? $b['created_at'] : '', isset($a['created_at']) ? $a['created_at'] : '');
    });
    return $out;
}

function daszek_v2_execution_results_for_case($case_id) {
    $case_id = sanitize_text_field($case_id);
    $rows = daszek_v2_load_jsonl_store('execution_results');
    $out = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        if ($case_id !== '' && isset($row['case_id']) && sanitize_text_field($row['case_id']) === $case_id) {
            $out[] = $row;
        }
    }
    usort($out, function ($a, $b) {
        return strcmp(isset($b['executed_at']) ? $b['executed_at'] : '', isset($a['executed_at']) ? $a['executed_at'] : '');
    });
    return $out;
}

function daszek_v2_build_ai_quality_read_model() {
    $summary = daszek_v2_load_map_store('ai_quality_summary');
    if (!is_array($summary) || empty($summary)) {
        $summary = [
            'window' => 'all_time',
            'total_ai_suggestions' => 0,
            'accepted_suggestions' => 0,
            'rejected_suggestions' => 0,
            'feedback_count' => 0,
            'accurate_rate' => 0.0,
            'partially_accurate_rate' => 0.0,
            'inaccurate_rate' => 0.0,
            'top_problem_tags' => [],
            'recent_feedback' => [],
            'projection_only' => true,
        ];
    }
    return ['ok' => true, 'generated_at' => daszek_v2_now_iso(), 'view' => 'ai_quality', 'summary' => $summary];
}

function daszek_v2_get_desk_note_detail($note_id) {
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $cases = daszek_v2_load_map_store('cases');
    $note_id = sanitize_text_field($note_id);

    if ($note_id === '' || !isset($desk_notes[$note_id]) || !is_array($desk_notes[$note_id])) {
        return null;
    }

    $note = $desk_notes[$note_id];
    $case_id = isset($note['case_id']) ? sanitize_text_field($note['case_id']) : '';
    $case = ($case_id !== '' && isset($cases[$case_id]) && is_array($cases[$case_id])) ? daszek_v2_build_case_read_item($cases[$case_id]) : null;
    $signals = daszek_v2_signals_for_ids(isset($note['source_signal_ids']) ? $note['source_signal_ids'] : []);
    $last_change = daszek_v2_last_trace_meta('desk_note', $note_id, $case_id);
    $maintenance_guard = daszek_v2_feedback_guard_meta(isset($note['feedback_state']) ? $note['feedback_state'] : []);

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'note' => $note,
        'case' => $case,
        'signals' => array_values(array_map('daszek_v2_build_signal_read_item', $signals)),
        'decision_traces' => array_values(array_map('daszek_v2_build_trace_read_item', daszek_v2_traces_for_subject('desk_note', $note_id, $case_id))),
        'last_change' => $last_change,
        'maintenance_guard' => $maintenance_guard,
        'why_you_see_it' => isset($note['why_on_desk']) ? $note['why_on_desk'] : '',
        'thread_memory' => daszek_v2_resolve_thread_memory($signals, $case),
        'operational_timeline' => isset($note['case_id']) ? daszek_v2_build_operational_timeline($note['case_id']) : [],
    ];
}

function daszek_v2_event_type_label_pl($event_type) {
    $map = [
        'signal_received' => 'Sygnał z maila',
        'case_intelligence_generated' => 'Analiza AI',
        'desk_note_created' => 'Kartka biurka',
        'desk_note_revised' => 'Zmiana kartki',
        'desk_note_moved_to_case_only' => 'Kartka tylko w sprawie',
        'feedback_recorded' => 'Informacja zwrotna',
        'thread_memory_updated' => 'Pamięć wątku',
        'attachment_processed' => 'Załącznik',
    ];
    $t = sanitize_text_field($event_type);
    return isset($map[$t]) ? $map[$t] : daszek_v2_humanize_code_pl($t);
}

function daszek_v2_build_operational_timeline($case_id, $limit = 60) {
    $case_id = sanitize_text_field($case_id);
    if ($case_id === '') {
        return [];
    }
    $rows = daszek_v2_load_jsonl_store('event_log');
    $out = [];
    foreach ($rows as $ev) {
        if (!is_array($ev)) {
            continue;
        }
        $cid = isset($ev['case_id']) ? sanitize_text_field($ev['case_id']) : '';
        if ($cid === '' || $cid !== $case_id) {
            continue;
        }
        $etype = isset($ev['event_type']) ? sanitize_text_field($ev['event_type']) : '';
        $out[] = [
            'event_id' => isset($ev['event_id']) ? sanitize_text_field($ev['event_id']) : '',
            'event_type' => $etype,
            'event_type_label' => daszek_v2_event_type_label_pl($etype),
            'occurred_at' => isset($ev['occurred_at']) ? sanitize_text_field($ev['occurred_at']) : '',
            'actor_type' => isset($ev['actor_type']) ? sanitize_text_field($ev['actor_type']) : '',
            'review_state' => isset($ev['review_state']) ? sanitize_text_field($ev['review_state']) : '',
            'summary_pl' => daszek_v2_summarize_event_pl($ev),
        ];
    }
    usort($out, function ($a, $b) {
        $ta = isset($a['occurred_at']) ? $a['occurred_at'] : '';
        $tb = isset($b['occurred_at']) ? $b['occurred_at'] : '';
        return strcmp($tb, $ta);
    });
    return array_slice($out, 0, intval($limit));
}

function daszek_v2_summarize_event_pl($ev) {
    if (!is_array($ev)) {
        return '';
    }
    $t = isset($ev['event_type']) ? $ev['event_type'] : '';
    $payload = isset($ev['payload']) && is_array($ev['payload']) ? $ev['payload'] : [];
    if ($t === 'case_intelligence_generated') {
        $p = isset($payload['presence_mode']) ? $payload['presence_mode'] : '';
        $l = isset($payload['lifecycle_intent']) ? $payload['lifecycle_intent'] : '';
        return trim('Inteligencja: ' . $p . ($l ? ' / ' . $l : ''));
    }
    if ($t === 'signal_received') {
        $sub = isset($payload['subject']) ? $payload['subject'] : '';
        return $sub ? ('Wiadomość: ' . sanitize_text_field($sub)) : 'Nowy sygnał z kanału mailowego.';
    }
    if (in_array($t, ['desk_note_revised', 'desk_note_moved_to_case_only'], true)) {
        $decision_type = isset($payload['decision_type']) ? sanitize_text_field($payload['decision_type']) : '';
        if ($decision_type !== '') {
            return daszek_v2_trace_decision_label_pl($decision_type);
        }
    }
    return daszek_v2_event_type_label_pl($t);
}

function daszek_v2_build_feedback_calibration_profile() {
    $events = daszek_v2_load_jsonl_store('feedback_events');
    $tr = 0;
    $weak = 0;
    $strong = 0;
    foreach ($events as $ev) {
        if (!is_array($ev)) {
            continue;
        }
        $ft = isset($ev['feedback_type']) ? sanitize_text_field($ev['feedback_type']) : '';
        if ($ft === 'trafne') {
            $tr++;
        } elseif ($ft === 'za_slabe') {
            $weak++;
        } elseif ($ft === 'za_mocne') {
            $strong++;
        }
    }
    $total = $tr + $weak + $strong;
    $ratio = $total > 0 ? ($tr / $total) : 0.5;
    $delta = 0.0;
    if ($ratio < 0.55 && $total >= 3) {
        $delta = 0.04;
    } elseif ($ratio > 0.85 && $total >= 5) {
        $delta = -0.02;
    }
    return [
        'feedback_sample_size' => $total,
        'quality_ratio' => round($ratio, 4),
        'source' => 'feedback_events',
        'domain_threshold_deltas' => [
            'confidence_attachment_extraction' => $delta,
            'confidence_surface_decision' => $delta,
            'confidence_next_action' => round($delta * 0.75, 4),
            'confidence_case_link' => round($delta * 0.5, 4),
        ],
    ];
}

function daszek_v2_build_calibration_read_model() {
    return array_merge(
        ['ok' => true, 'generated_at' => daszek_v2_now_iso()],
        daszek_v2_build_feedback_calibration_profile()
    );
}
