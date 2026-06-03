<?php
if (!defined('ABSPATH')) exit;

function daszek_v2_normalize_presence_mode($mode) {
    $value = sanitize_text_field($mode);
    $aliases = [
        'hidden' => 'silent',
        'supportive' => 'advisory',
        'firm' => 'strong',
    ];
    if (isset($aliases[$value])) {
        return $aliases[$value];
    }
    return in_array($value, ['silent', 'subtle', 'standard', 'advisory', 'strong', 'alarm'], true) ? $value : 'silent';
}

function daszek_v2_presence_rank($mode) {
    $mode = daszek_v2_normalize_presence_mode($mode);
    $map = ['alarm' => 0, 'strong' => 1, 'advisory' => 2, 'standard' => 3, 'subtle' => 4, 'silent' => 5];
    return isset($map[$mode]) ? $map[$mode] : 5;
}

function daszek_v2_presence_label_pl($mode) {
    $mode = daszek_v2_normalize_presence_mode($mode);
    $map = [
        'alarm' => 'Alarmowo',
        'strong' => 'Stanowczo',
        'advisory' => 'Doradczo',
        'standard' => 'Standardowo',
        'subtle' => 'Dyskretnie',
        'silent' => 'Cicho',
    ];
    return isset($map[$mode]) ? $map[$mode] : 'Standardowo';
}

function daszek_v2_lifecycle_label_pl($state) {
    $map = [
        'active' => 'Aktywna',
        'suppressed' => 'Wyciszona',
        'resolved' => 'Załatwiona',
        'archived' => 'Archiwalna',
    ];
    return isset($map[$state]) ? $map[$state] : 'Aktywna';
}

function daszek_v2_humanize_code_pl($value) {
    $text = trim((string) $value);
    if ($text === '') {
        return '';
    }
    $text = preg_replace('/\s+/', ' ', str_replace(['_', '-'], ' ', $text));
    return ucfirst($text);
}

function daszek_v2_business_area_label_pl($area) {
    $map = [
        'sales' => 'Sprzedaż',
        'finance' => 'Finanse',
        'procurement' => 'Zakupy',
        'logistics' => 'Logistyka',
        'operations' => 'Operacje',
        'service' => 'Serwis',
        'security' => 'Bezpieczeństwo',
        'supplier_commercial' => 'Relacje z dostawcami',
        'marketing_growth' => 'Marketing',
        'compliance_legal' => 'Prawo i zgodność',
        'internal_coordination' => 'Koordynacja wewnętrzna',
        'general_admin' => 'Administracja',
    ];
    return isset($map[$area]) ? $map[$area] : daszek_v2_humanize_code_pl($area ?: 'operacje');
}

function daszek_v2_case_family_label_pl($family) {
    $map = [
        'lead_opportunity' => 'Szansa sprzedażowa',
        'finance_settlement' => 'Rozliczenie finansowe',
        'procurement_delivery' => 'Dostawa zakupowa',
        'supplier_commercial_review' => 'Ustalenia z dostawcą',
        'platform_service_security' => 'Incydent platformy lub bezpieczeństwa',
        'compliance_legal_review' => 'Sprawa prawna lub zgodność',
        'marketing_performance_review' => 'Wyniki marketingu',
        'internal_coordination' => 'Koordynacja wewnętrzna',
        'unknown' => 'Sprawa ogólna',
    ];
    return isset($map[$family]) ? $map[$family] : daszek_v2_humanize_code_pl($family ?: 'sprawa');
}

function daszek_v2_case_status_label_pl($status) {
    $map = [
        'open' => 'Otwarta',
        'closed' => 'Zamknięta',
        'merged' => 'Połączona',
    ];
    return isset($map[$status]) ? $map[$status] : daszek_v2_humanize_code_pl($status ?: 'otwarta');
}

function daszek_v2_guidance_operational_status_label_pl($status) {
    $map = [
        'active_review' => 'W recenzji',
        'waiting' => 'Oczekiwanie',
        'blocked' => 'Zablokowane',
        'follow_up_needed' => 'Wymaga kontaktu',
        'ready' => 'Gotowe do ruchu',
        'stagnating' => 'Stoi',
        'watching' => 'Obserwacja',
    ];
    $value = sanitize_text_field($status);
    return isset($map[$value]) ? $map[$value] : daszek_v2_humanize_code_pl($value ?: 'obserwacja');
}

function daszek_v2_guidance_waiting_for_label_pl($code) {
    $map = [
        'none' => 'Brak',
        'client' => 'Klient',
        'operator' => 'Operator',
        'supplier' => 'Dostawca',
        'document' => 'Dokument',
        'quote' => 'Oferta',
        'schedule' => 'Termin',
        'payment' => 'Płatność',
        'unknown' => 'Nieznane',
    ];
    $value = sanitize_text_field($code);
    return isset($map[$value]) ? $map[$value] : daszek_v2_humanize_code_pl($value ?: 'nieznane');
}

function daszek_v2_guidance_momentum_label_pl($code) {
    $map = [
        'growing' => 'Przyspiesza',
        'steady' => 'Stabilnie',
        'slowing' => 'Zwalnia',
        'stalled' => 'Zatrzymane',
    ];
    $value = sanitize_text_field($code);
    return isset($map[$value]) ? $map[$value] : daszek_v2_humanize_code_pl($value ?: 'stabilnie');
}

function daszek_v2_guidance_business_readiness_label_pl($code) {
    $map = [
        'not_ready' => 'Niegotowe',
        'needs_data' => 'Brakuje danych',
        'ready_for_offer' => 'Gotowe na ofertę',
        'ready_for_followup' => 'Gotowe na follow-up',
        'ready_for_close' => 'Gotowe do zamknięcia',
    ];
    $value = sanitize_text_field($code);
    return isset($map[$value]) ? $map[$value] : daszek_v2_humanize_code_pl($value ?: 'niegotowe');
}

function daszek_v2_guidance_operator_attention_label_pl($code) {
    $map = [
        'watch' => 'Obserwacja',
        'keep_visible' => 'Utrzymaj widoczne',
        'act_soon' => 'Działaj wkrótce',
        'act_now' => 'Działaj teraz',
        'case_only_ok' => 'Wystarczy w sprawie',
    ];
    $value = sanitize_text_field($code);
    return isset($map[$value]) ? $map[$value] : daszek_v2_humanize_code_pl($value ?: 'obserwacja');
}

function daszek_v2_case_state_label_pl($state) {
    $map = [
        'none' => 'Bez stanu',
        'new' => 'Nowa',
        'active' => 'Aktywna',
        'received' => 'Odebrane',
        'delivered' => 'Dostarczone',
        'delivery_at_risk' => 'Dostawa zagrożona',
        'ordered' => 'Zamówione',
        'delayed' => 'Opóźnione',
        'waiting_for_reply' => 'Czeka na odpowiedź',
        'resolved' => 'Rozwiązana',
    ];
    return isset($map[$state]) ? $map[$state] : daszek_v2_humanize_code_pl($state ?: 'bez stanu');
}

function daszek_v2_trace_decision_label_pl($decision_type) {
    $map = [
        'upsert_case' => 'Aktualizacja sprawy',
        'create_note' => 'Utworzenie kartki',
        'update_note' => 'Aktualizacja kartki',
        'escalate_presence_note' => 'Wzmocnienie kartki',
        'deescalate_presence_note' => 'Osłabienie kartki',
        'move_to_case_only' => 'Tylko w sprawie',
        'resolve_note' => 'Oznaczenie jako załatwione',
        'suppress_note' => 'Wyciszenie kartki',
        'merge_note' => 'Scalenie',
        'withdraw_note' => 'Wycofanie kartki',
        'compatibility_update' => 'Aktualizacja z widoku Zadań',
        'trafne' => 'Ocena: trafne',
        'za_mocne' => 'Ocena: za mocne',
        'za_slabe' => 'Ocena: za słabe',
        'tylko_w_sprawie' => 'Tylko w sprawie',
        'nie_pokazuj_takich' => 'Nie pokazuj takich',
        'polacz_ze_sprawa' => 'Połącz ze sprawą',
        'to_juz_nieaktualne' => 'Już nieaktualne',
        'zla_sprawa' => 'Błędne powiązanie ze sprawą',
    ];
    if (strpos((string) $decision_type, 'maintenance_') === 0) {
        $base = substr((string) $decision_type, strlen('maintenance_'));
        return 'Maintenance: ' . daszek_v2_trace_decision_label_pl($base);
    }
    return isset($map[$decision_type]) ? $map[$decision_type] : daszek_v2_humanize_code_pl($decision_type ?: 'zmiana');
}

function daszek_v2_now_iso() {
    return current_time('c');
}

function daszek_v2_iso_from_signal($signal) {
    if (!is_array($signal)) {
        return daszek_v2_now_iso();
    }
    if (isset($signal['observed_at']) && is_string($signal['observed_at']) && $signal['observed_at'] !== '') {
        return $signal['observed_at'];
    }
    $source_ref = isset($signal['source_ref']) && is_array($signal['source_ref']) ? $signal['source_ref'] : [];
    if (isset($source_ref['received_at']) && is_string($source_ref['received_at']) && $source_ref['received_at'] !== '') {
        return $source_ref['received_at'];
    }
    return daszek_v2_now_iso();
}

function daszek_v2_is_maintenance_signal($signal) {
    if (!is_array($signal)) {
        return false;
    }
    $source_kind = isset($signal['source_kind']) ? sanitize_text_field($signal['source_kind']) : '';
    if ($source_kind === 'system_maintenance') {
        return true;
    }
    $intake = isset($signal['intake']) && is_array($signal['intake']) ? $signal['intake'] : [];
    return isset($intake['preclassification_lane']) && sanitize_text_field($intake['preclassification_lane']) === 'desk_maintenance';
}

function daszek_v2_generate_event_id($prefix) {
    try {
        $suffix = bin2hex(random_bytes(4));
    } catch (Exception $exception) {
        $suffix = substr(md5(uniqid('', true)), 0, 8);
    }
    return sanitize_key($prefix . '_' . gmdate('YmdHis') . '_' . $suffix);
}

function daszek_v2_sanitize_json_value($value, $depth = 4) {
    if ($depth <= 0) {
        if (is_scalar($value) || $value === null) {
            return is_string($value) ? sanitize_textarea_field($value) : $value;
        }
        return null;
    }

    if (is_array($value)) {
        $is_list = empty($value) || array_keys($value) === range(0, count($value) - 1);
        $result = [];
        foreach ($value as $key => $item) {
            $sanitized = daszek_v2_sanitize_json_value($item, $depth - 1);
            if ($is_list) {
                if ($sanitized !== null && $sanitized !== '') {
                    $result[] = $sanitized;
                }
                continue;
            }
            $sanitized_key = sanitize_key((string) $key);
            if ($sanitized_key === '') {
                continue;
            }
            $result[$sanitized_key] = $sanitized;
        }
        return $result;
    }

    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value)) {
        return $value;
    }
    if (is_float($value)) {
        return round($value, 4);
    }
    if ($value === null) {
        return null;
    }

    return sanitize_textarea_field((string) $value);
}

function daszek_v2_has_meaningful_value($value) {
    if (is_array($value)) {
        return !empty($value);
    }
    if (is_string($value)) {
        return trim($value) !== '';
    }
    return $value !== null;
}

function daszek_v2_pick_text_value($incoming, $existing = '', $default = '', $textarea = false) {
    $sanitizer = $textarea ? 'sanitize_textarea_field' : 'sanitize_text_field';
    $incoming_value = $sanitizer(is_scalar($incoming) || $incoming === null ? (string) $incoming : '');
    if ($incoming_value !== '') {
        return $incoming_value;
    }
    $existing_value = $sanitizer(is_scalar($existing) || $existing === null ? (string) $existing : '');
    if ($existing_value !== '') {
        return $existing_value;
    }
    return $default;
}

function daszek_v2_pick_json_value($incoming, $existing = [], $default = []) {
    $incoming_value = daszek_v2_sanitize_json_value($incoming);
    if (daszek_v2_has_meaningful_value($incoming_value)) {
        return $incoming_value;
    }
    if (daszek_v2_has_meaningful_value($existing)) {
        return $existing;
    }
    return $default;
}

function daszek_v2_default_feedback_state() {
    return [
        'trafne' => 0,
        'za_mocne' => 0,
        'za_slabe' => 0,
        'tylko_w_sprawie' => 0,
        'nie_pokazuj_takich' => 0,
        'polacz_ze_sprawa' => 0,
        'to_juz_nieaktualne' => 0,
        'zla_sprawa' => 0,
        'ostatnia_akcja' => '',
        'ostatnia_akcja_at' => '',
    ];
}

function daszek_v2_merge_signal_ids($existing_ids, $new_ids) {
    $values = [];
    foreach ([$existing_ids, $new_ids] as $group) {
        if (!is_array($group)) {
            continue;
        }
        foreach ($group as $item) {
            $value = sanitize_text_field($item);
            if ($value !== '') {
                $values[] = $value;
            }
        }
    }
    return array_values(array_unique($values));
}

function daszek_v2_lifecycle_state_from_patch($desk_note_patch, $existing_note = []) {
    $command = isset($desk_note_patch['command']) ? sanitize_text_field($desk_note_patch['command']) : '';
    $lifecycle = isset($desk_note_patch['lifecycle']) ? sanitize_text_field($desk_note_patch['lifecycle']) : '';

    if (in_array($command, ['suppress', 'withdraw'], true) || $lifecycle === 'withdrawn') {
        return 'suppressed';
    }
    if ($command === 'resolve' || in_array($lifecycle, ['resolved_by_user', 'resolved_by_ai'], true)) {
        return 'resolved';
    }
    if ($command === 'merge' || in_array($lifecycle, ['merged', 'expired'], true)) {
        return 'archived';
    }
    if (!empty($existing_note['lifecycle_state']) && empty($command) && empty($lifecycle)) {
        return $existing_note['lifecycle_state'];
    }
    return 'active';
}

function daszek_v2_build_case_record($case_patch, $existing_case = [], $signal = null) {
    $updated_at = daszek_v2_now_iso();
    $incoming_latest_signal_id = isset($case_patch['latest_signal_id']) ? sanitize_text_field($case_patch['latest_signal_id']) : '';
    $latest_signal_at = daszek_v2_iso_from_signal($signal);
    if (($incoming_latest_signal_id === '' || daszek_v2_is_maintenance_signal($signal)) && isset($existing_case['latest_signal_at'])) {
        $latest_signal_at = sanitize_text_field($existing_case['latest_signal_at']);
    }
    return [
        'case_id' => isset($case_patch['case_id']) ? sanitize_text_field($case_patch['case_id']) : (isset($existing_case['case_id']) ? $existing_case['case_id'] : ''),
        'case_key' => daszek_v2_pick_text_value(isset($case_patch['case_key']) ? $case_patch['case_key'] : '', isset($existing_case['case_key']) ? $existing_case['case_key'] : ''),
        'family' => isset($case_patch['family']) ? sanitize_text_field($case_patch['family']) : (isset($existing_case['family']) ? $existing_case['family'] : 'unknown'),
        'business_area' => daszek_v2_pick_text_value(isset($case_patch['business_area']) ? $case_patch['business_area'] : '', isset($existing_case['business_area']) ? $existing_case['business_area'] : ''),
        'business_priority' => daszek_v2_pick_text_value(isset($case_patch['business_priority']) ? $case_patch['business_priority'] : '', isset($existing_case['business_priority']) ? $existing_case['business_priority'] : 'medium', 'medium'),
        'status' => isset($case_patch['status']) ? sanitize_text_field($case_patch['status']) : (isset($existing_case['status']) ? $existing_case['status'] : 'open'),
        'current_state' => isset($case_patch['current_state']) ? sanitize_text_field($case_patch['current_state']) : (isset($existing_case['current_state']) ? $existing_case['current_state'] : 'none'),
        'state_confidence' => isset($case_patch['state_confidence']) ? floatval($case_patch['state_confidence']) : (isset($existing_case['state_confidence']) ? floatval($existing_case['state_confidence']) : 0.0),
        'state_change_to' => isset($case_patch['state_change_to']) ? sanitize_text_field($case_patch['state_change_to']) : (isset($existing_case['state_change_to']) ? $existing_case['state_change_to'] : ''),
        'title' => isset($case_patch['title_pl']) ? sanitize_text_field($case_patch['title_pl']) : (isset($existing_case['title']) ? $existing_case['title'] : ''),
        'title_pl' => isset($case_patch['title_pl']) ? sanitize_text_field($case_patch['title_pl']) : (isset($existing_case['title_pl']) ? $existing_case['title_pl'] : ''),
        'summary' => isset($case_patch['summary_pl']) ? sanitize_textarea_field($case_patch['summary_pl']) : (isset($existing_case['summary']) ? $existing_case['summary'] : ''),
        'summary_pl' => isset($case_patch['summary_pl']) ? sanitize_textarea_field($case_patch['summary_pl']) : (isset($existing_case['summary_pl']) ? $existing_case['summary_pl'] : ''),
        'operator_brief_pl' => isset($case_patch['operator_brief_pl']) ? sanitize_textarea_field($case_patch['operator_brief_pl']) : (isset($existing_case['operator_brief_pl']) ? $existing_case['operator_brief_pl'] : ''),
        'latest_meaningful_change_pl' => isset($case_patch['latest_meaningful_change_pl']) ? sanitize_textarea_field($case_patch['latest_meaningful_change_pl']) : (isset($existing_case['latest_meaningful_change_pl']) ? $existing_case['latest_meaningful_change_pl'] : ''),
        'attention_reason_pl' => isset($case_patch['attention_reason_pl']) ? sanitize_textarea_field($case_patch['attention_reason_pl']) : (isset($existing_case['attention_reason_pl']) ? $existing_case['attention_reason_pl'] : ''),
        'primary_next_action_type' => isset($case_patch['primary_next_action_type']) ? sanitize_text_field($case_patch['primary_next_action_type']) : (isset($existing_case['primary_next_action_type']) ? $existing_case['primary_next_action_type'] : ''),
        'primary_next_action_title_pl' => isset($case_patch['primary_next_action_title_pl']) ? sanitize_textarea_field($case_patch['primary_next_action_title_pl']) : (isset($existing_case['primary_next_action_title_pl']) ? $existing_case['primary_next_action_title_pl'] : ''),
        'primary_next_action_reason_pl' => isset($case_patch['primary_next_action_reason_pl']) ? sanitize_textarea_field($case_patch['primary_next_action_reason_pl']) : (isset($existing_case['primary_next_action_reason_pl']) ? $existing_case['primary_next_action_reason_pl'] : ''),
        'missing_info_summary_pl' => daszek_v2_pick_text_value(isset($case_patch['missing_info_summary_pl']) ? $case_patch['missing_info_summary_pl'] : '', isset($existing_case['missing_info_summary_pl']) ? $existing_case['missing_info_summary_pl'] : '', '', true),
        'risk_summary_pl' => daszek_v2_pick_text_value(isset($case_patch['risk_summary_pl']) ? $case_patch['risk_summary_pl'] : '', isset($existing_case['risk_summary_pl']) ? $existing_case['risk_summary_pl'] : '', '', true),
        'blockers' => isset($case_patch['blockers']) ? daszek_v2_sanitize_json_value($case_patch['blockers']) : (isset($existing_case['blockers']) ? $existing_case['blockers'] : []),
        'risks' => daszek_v2_pick_json_value(isset($case_patch['risks']) ? $case_patch['risks'] : [], isset($existing_case['risks']) ? $existing_case['risks'] : [], []),
        'missing_info' => daszek_v2_pick_json_value(isset($case_patch['missing_info']) ? $case_patch['missing_info'] : [], isset($existing_case['missing_info']) ? $existing_case['missing_info'] : [], []),
        'merge_candidates' => daszek_v2_pick_json_value(isset($case_patch['merge_candidates']) ? $case_patch['merge_candidates'] : [], isset($existing_case['merge_candidates']) ? $existing_case['merge_candidates'] : [], []),
        'split_suspicions' => daszek_v2_pick_json_value(isset($case_patch['split_suspicions']) ? $case_patch['split_suspicions'] : [], isset($existing_case['split_suspicions']) ? $existing_case['split_suspicions'] : [], []),
        'case_snapshot' => daszek_v2_pick_json_value(isset($case_patch['case_snapshot']) ? $case_patch['case_snapshot'] : [], isset($existing_case['case_snapshot']) ? $existing_case['case_snapshot'] : [], []),
        'key_facts' => daszek_v2_pick_json_value(isset($case_patch['key_facts']) ? $case_patch['key_facts'] : [], isset($existing_case['key_facts']) ? $existing_case['key_facts'] : [], []),
        'latest_documents' => daszek_v2_pick_json_value(isset($case_patch['latest_documents']) ? $case_patch['latest_documents'] : [], isset($existing_case['latest_documents']) ? $existing_case['latest_documents'] : [], []),
        'conflicting_facts' => daszek_v2_pick_json_value(isset($case_patch['conflicting_facts']) ? $case_patch['conflicting_facts'] : [], isset($existing_case['conflicting_facts']) ? $existing_case['conflicting_facts'] : [], []),
        'drive_documents_summary' => daszek_v2_pick_json_value(isset($case_patch['drive_documents_summary']) ? $case_patch['drive_documents_summary'] : [], isset($existing_case['drive_documents_summary']) ? $existing_case['drive_documents_summary'] : [], []),
        'completeness_gaps' => daszek_v2_pick_json_value(isset($case_patch['completeness_gaps']) ? $case_patch['completeness_gaps'] : [], isset($existing_case['completeness_gaps']) ? $existing_case['completeness_gaps'] : [], []),
        'graph_hints' => daszek_v2_pick_json_value(isset($case_patch['graph_hints']) ? $case_patch['graph_hints'] : [], isset($existing_case['graph_hints']) ? $existing_case['graph_hints'] : [], []),
        'reference_documents' => daszek_v2_pick_json_value(isset($case_patch['reference_documents']) ? $case_patch['reference_documents'] : [], isset($existing_case['reference_documents']) ? $existing_case['reference_documents'] : [], []),
        'warranty_service_state' => daszek_v2_pick_json_value(isset($case_patch['warranty_service_state']) ? $case_patch['warranty_service_state'] : [], isset($existing_case['warranty_service_state']) ? $existing_case['warranty_service_state'] : [], []),
        'media_evidence_presence' => daszek_v2_pick_json_value(isset($case_patch['media_evidence_presence']) ? $case_patch['media_evidence_presence'] : [], isset($existing_case['media_evidence_presence']) ? $existing_case['media_evidence_presence'] : [], []),
        'related_entities' => daszek_v2_pick_json_value(isset($case_patch['related_entities']) ? $case_patch['related_entities'] : [], isset($existing_case['related_entities']) ? $existing_case['related_entities'] : [], []),
        'operator_visible_conflicts' => daszek_v2_pick_json_value(isset($case_patch['operator_visible_conflicts']) ? $case_patch['operator_visible_conflicts'] : [], isset($existing_case['operator_visible_conflicts']) ? $existing_case['operator_visible_conflicts'] : [], []),
        'evidence_cards' => daszek_v2_pick_json_value(isset($case_patch['evidence_cards']) ? $case_patch['evidence_cards'] : [], isset($existing_case['evidence_cards']) ? $existing_case['evidence_cards'] : [], []),
        'service_signals' => daszek_v2_pick_json_value(isset($case_patch['service_signals']) ? $case_patch['service_signals'] : [], isset($existing_case['service_signals']) ? $existing_case['service_signals'] : [], []),
        'marketing_signals' => daszek_v2_pick_json_value(isset($case_patch['marketing_signals']) ? $case_patch['marketing_signals'] : [], isset($existing_case['marketing_signals']) ? $existing_case['marketing_signals'] : [], []),
        'action_proposals' => daszek_v2_pick_json_value(isset($case_patch['action_proposals']) ? $case_patch['action_proposals'] : [], isset($existing_case['action_proposals']) ? $existing_case['action_proposals'] : [], []),
        'execution_results' => daszek_v2_pick_json_value(isset($case_patch['execution_results']) ? $case_patch['execution_results'] : [], isset($existing_case['execution_results']) ? $existing_case['execution_results'] : [], []),
        'calendar' => daszek_v2_pick_json_value(isset($case_patch['calendar']) ? $case_patch['calendar'] : [], isset($existing_case['calendar']) ? $existing_case['calendar'] : [], []),
        'document_intelligence' => daszek_v2_pick_json_value(isset($case_patch['document_intelligence']) ? $case_patch['document_intelligence'] : [], isset($existing_case['document_intelligence']) ? $existing_case['document_intelligence'] : [], []),
        'source_refs' => daszek_v2_pick_json_value(isset($case_patch['source_refs']) ? $case_patch['source_refs'] : [], isset($existing_case['source_refs']) ? $existing_case['source_refs'] : [], []),
        'review_required' => isset($case_patch['review_required']) ? !empty($case_patch['review_required']) : (!empty($existing_case['review_required'])),
        'review_flags' => isset($case_patch['review_flags']) ? daszek_v2_sanitize_json_value($case_patch['review_flags']) : (isset($existing_case['review_flags']) ? $existing_case['review_flags'] : []),
        'operational_status' => isset($case_patch['operational_status']) ? sanitize_text_field($case_patch['operational_status']) : (isset($existing_case['operational_status']) ? $existing_case['operational_status'] : ''),
        'waiting_for' => isset($case_patch['waiting_for']) ? sanitize_text_field($case_patch['waiting_for']) : (isset($existing_case['waiting_for']) ? $existing_case['waiting_for'] : ''),
        'guidance_reason_summary_pl' => isset($case_patch['guidance_reason_summary_pl']) ? sanitize_textarea_field($case_patch['guidance_reason_summary_pl']) : (isset($existing_case['guidance_reason_summary_pl']) ? $existing_case['guidance_reason_summary_pl'] : ''),
        'blocker_summary_pl' => isset($case_patch['blocker_summary_pl']) ? sanitize_textarea_field($case_patch['blocker_summary_pl']) : (isset($existing_case['blocker_summary_pl']) ? $existing_case['blocker_summary_pl'] : ''),
        'momentum' => isset($case_patch['momentum']) ? sanitize_text_field($case_patch['momentum']) : (isset($existing_case['momentum']) ? $existing_case['momentum'] : ''),
        'stagnation_flag' => isset($case_patch['stagnation_flag']) ? !empty($case_patch['stagnation_flag']) : (!empty($existing_case['stagnation_flag'])),
        'stagnation_reason_pl' => isset($case_patch['stagnation_reason_pl']) ? sanitize_textarea_field($case_patch['stagnation_reason_pl']) : (isset($existing_case['stagnation_reason_pl']) ? $existing_case['stagnation_reason_pl'] : ''),
        'business_readiness' => isset($case_patch['business_readiness']) ? sanitize_text_field($case_patch['business_readiness']) : (isset($existing_case['business_readiness']) ? $existing_case['business_readiness'] : ''),
        'operator_attention_class' => isset($case_patch['operator_attention_class']) ? sanitize_text_field($case_patch['operator_attention_class']) : (isset($existing_case['operator_attention_class']) ? $existing_case['operator_attention_class'] : ''),
        'next_step_hint_pl' => isset($case_patch['next_step_hint_pl']) ? sanitize_textarea_field($case_patch['next_step_hint_pl']) : (isset($existing_case['next_step_hint_pl']) ? $existing_case['next_step_hint_pl'] : ''),
        'guidance_confidence' => isset($case_patch['guidance_confidence']) ? floatval($case_patch['guidance_confidence']) : (isset($existing_case['guidance_confidence']) ? floatval($existing_case['guidance_confidence']) : 0.0),
        'latest_signal_id' => daszek_v2_pick_text_value($incoming_latest_signal_id, isset($existing_case['latest_signal_id']) ? $existing_case['latest_signal_id'] : ''),
        'latest_signal_at' => $latest_signal_at,
        'case_link_decision' => isset($case_patch['case_link_decision']) ? sanitize_text_field($case_patch['case_link_decision']) : (isset($existing_case['case_link_decision']) ? $existing_case['case_link_decision'] : 'no_link'),
        'case_key_source' => daszek_v2_pick_text_value(isset($case_patch['case_key_source']) ? $case_patch['case_key_source'] : '', isset($existing_case['case_key_source']) ? $existing_case['case_key_source'] : 'none', 'none'),
        'open_desk_note_id' => isset($existing_case['open_desk_note_id']) ? sanitize_text_field($existing_case['open_desk_note_id']) : '',
        'active_note_count' => isset($existing_case['active_note_count']) ? intval($existing_case['active_note_count']) : 0,
        'updated_at' => $updated_at,
        'last_command' => isset($case_patch['command']) ? sanitize_text_field($case_patch['command']) : (isset($existing_case['last_command']) ? $existing_case['last_command'] : 'upsert_case'),
    ];
}

function daszek_v2_build_desk_note_record($desk_note_patch, $existing_note = [], $signal = null) {
    $command = isset($desk_note_patch['command']) ? sanitize_text_field($desk_note_patch['command']) : (isset($existing_note['last_command']) ? $existing_note['last_command'] : 'create');
    $lifecycle_state = daszek_v2_lifecycle_state_from_patch($desk_note_patch, $existing_note);
    $presence_mode = isset($desk_note_patch['presence_mode']) ? daszek_v2_normalize_presence_mode($desk_note_patch['presence_mode']) : (isset($existing_note['presence_mode']) ? daszek_v2_normalize_presence_mode($existing_note['presence_mode']) : 'silent');
    if ($lifecycle_state !== 'active') {
        $presence_mode = 'silent';
    }

    $source_signal_ids = daszek_v2_merge_signal_ids(
        isset($existing_note['source_signal_ids']) ? $existing_note['source_signal_ids'] : [],
        daszek_v2_is_maintenance_signal($signal) ? [] : (isset($desk_note_patch['source_signal_ids']) ? $desk_note_patch['source_signal_ids'] : [])
    );

    $feedback_state = isset($existing_note['feedback_state']) && is_array($existing_note['feedback_state'])
        ? $existing_note['feedback_state']
        : daszek_v2_default_feedback_state();

    $updated_at = daszek_v2_now_iso();
    $title = isset($desk_note_patch['title_pl']) ? sanitize_text_field($desk_note_patch['title_pl']) : (isset($existing_note['title']) ? $existing_note['title'] : '');
    $summary = isset($desk_note_patch['summary_pl']) ? sanitize_textarea_field($desk_note_patch['summary_pl']) : (isset($existing_note['summary']) ? $existing_note['summary'] : '');
    $why_on_desk = isset($desk_note_patch['why_now_pl']) ? sanitize_textarea_field($desk_note_patch['why_now_pl']) : (isset($existing_note['why_on_desk']) ? $existing_note['why_on_desk'] : '');
    $recommended_next_step = isset($desk_note_patch['recommended_next_step_pl']) ? sanitize_textarea_field($desk_note_patch['recommended_next_step_pl']) : (isset($existing_note['recommended_next_step']) ? $existing_note['recommended_next_step'] : '');
    $surface_zone = isset($desk_note_patch['surface_zone']) ? sanitize_text_field($desk_note_patch['surface_zone']) : (isset($existing_note['surface_zone']) ? $existing_note['surface_zone'] : ($presence_mode === 'silent' ? 'silent' : 'desk'));
    $day_bucket = isset($desk_note_patch['day_bucket']) ? sanitize_text_field($desk_note_patch['day_bucket']) : (isset($existing_note['day_bucket']) ? $existing_note['day_bucket'] : 'dzisiaj');
    if ($lifecycle_state !== 'active') {
        $surface_zone = 'silent';
    }
    $latest_signal_at = daszek_v2_iso_from_signal($signal);
    if (daszek_v2_is_maintenance_signal($signal) && isset($existing_note['latest_signal_at'])) {
        $latest_signal_at = sanitize_text_field($existing_note['latest_signal_at']);
    }

    return [
        'note_id' => isset($desk_note_patch['desk_note_id']) ? sanitize_text_field($desk_note_patch['desk_note_id']) : (isset($existing_note['note_id']) ? $existing_note['note_id'] : ''),
        'desk_note_id' => isset($desk_note_patch['desk_note_id']) ? sanitize_text_field($desk_note_patch['desk_note_id']) : (isset($existing_note['desk_note_id']) ? $existing_note['desk_note_id'] : ''),
        'case_id' => daszek_v2_pick_text_value(isset($desk_note_patch['case_id']) ? $desk_note_patch['case_id'] : '', isset($existing_note['case_id']) ? $existing_note['case_id'] : ''),
        'title' => $title,
        'title_pl' => $title,
        'summary' => $summary,
        'summary_pl' => $summary,
        'why_on_desk' => $why_on_desk,
        'why_now_pl' => $why_on_desk,
        'recommended_next_step' => $recommended_next_step,
        'recommended_next_step_pl' => $recommended_next_step,
        'assistant_suggestion_pl' => isset($desk_note_patch['assistant_suggestion_pl']) ? sanitize_textarea_field($desk_note_patch['assistant_suggestion_pl']) : (isset($existing_note['assistant_suggestion_pl']) ? $existing_note['assistant_suggestion_pl'] : $recommended_next_step),
        'operator_brief_pl' => isset($desk_note_patch['operator_brief_pl']) ? sanitize_textarea_field($desk_note_patch['operator_brief_pl']) : (isset($existing_note['operator_brief_pl']) ? $existing_note['operator_brief_pl'] : ''),
        'primary_next_action_type' => isset($desk_note_patch['primary_next_action_type']) ? sanitize_text_field($desk_note_patch['primary_next_action_type']) : (isset($existing_note['primary_next_action_type']) ? $existing_note['primary_next_action_type'] : ''),
        'primary_next_action_title_pl' => isset($desk_note_patch['primary_next_action_title_pl']) ? sanitize_textarea_field($desk_note_patch['primary_next_action_title_pl']) : (isset($existing_note['primary_next_action_title_pl']) ? $existing_note['primary_next_action_title_pl'] : ''),
        'primary_next_action_reason_pl' => isset($desk_note_patch['primary_next_action_reason_pl']) ? sanitize_textarea_field($desk_note_patch['primary_next_action_reason_pl']) : (isset($existing_note['primary_next_action_reason_pl']) ? $existing_note['primary_next_action_reason_pl'] : ''),
        'missing_info_summary_pl' => daszek_v2_pick_text_value(isset($desk_note_patch['missing_info_summary_pl']) ? $desk_note_patch['missing_info_summary_pl'] : '', isset($existing_note['missing_info_summary_pl']) ? $existing_note['missing_info_summary_pl'] : '', '', true),
        'customer_question_draft_pl' => isset($desk_note_patch['customer_question_draft_pl']) ? sanitize_textarea_field($desk_note_patch['customer_question_draft_pl']) : (isset($existing_note['customer_question_draft_pl']) ? $existing_note['customer_question_draft_pl'] : ''),
        'operator_checklist_pl' => daszek_v2_pick_json_value(isset($desk_note_patch['operator_checklist_pl']) ? $desk_note_patch['operator_checklist_pl'] : [], isset($existing_note['operator_checklist_pl']) ? $existing_note['operator_checklist_pl'] : [], []),
        'risk_summary_pl' => daszek_v2_pick_text_value(isset($desk_note_patch['risk_summary_pl']) ? $desk_note_patch['risk_summary_pl'] : '', isset($existing_note['risk_summary_pl']) ? $existing_note['risk_summary_pl'] : '', '', true),
        'risks' => daszek_v2_pick_json_value(isset($desk_note_patch['risks']) ? $desk_note_patch['risks'] : [], isset($existing_note['risks']) ? $existing_note['risks'] : [], []),
        'blockers' => isset($desk_note_patch['blockers']) ? daszek_v2_sanitize_json_value($desk_note_patch['blockers']) : (isset($existing_note['blockers']) ? $existing_note['blockers'] : []),
        'missing_info' => daszek_v2_pick_json_value(isset($desk_note_patch['missing_info']) ? $desk_note_patch['missing_info'] : [], isset($existing_note['missing_info']) ? $existing_note['missing_info'] : [], []),
        'merge_candidates' => daszek_v2_pick_json_value(isset($desk_note_patch['merge_candidates']) ? $desk_note_patch['merge_candidates'] : [], isset($existing_note['merge_candidates']) ? $existing_note['merge_candidates'] : [], []),
        'split_suspicions' => daszek_v2_pick_json_value(isset($desk_note_patch['split_suspicions']) ? $desk_note_patch['split_suspicions'] : [], isset($existing_note['split_suspicions']) ? $existing_note['split_suspicions'] : [], []),
        'feedback_learning_memory' => daszek_v2_pick_json_value(isset($desk_note_patch['feedback_learning_memory']) ? $desk_note_patch['feedback_learning_memory'] : [], isset($existing_note['feedback_learning_memory']) ? $existing_note['feedback_learning_memory'] : [], []),
        'surface_zone' => $surface_zone,
        'day_bucket' => $day_bucket,
        'presence_mode' => $presence_mode,
        'presence_label_pl' => daszek_v2_presence_label_pl($presence_mode),
        'lifecycle_state' => $lifecycle_state,
        'lifecycle_label_pl' => daszek_v2_lifecycle_label_pl($lifecycle_state),
        'lifecycle' => isset($desk_note_patch['lifecycle']) ? sanitize_text_field($desk_note_patch['lifecycle']) : (isset($existing_note['lifecycle']) ? $existing_note['lifecycle'] : 'active'),
        'source_signal_ids' => $source_signal_ids,
        'source_message_id' => isset($desk_note_patch['source_message_id']) ? sanitize_text_field($desk_note_patch['source_message_id']) : (isset($existing_note['source_message_id']) ? $existing_note['source_message_id'] : ''),
        'case_family' => isset($desk_note_patch['case_family']) ? sanitize_text_field($desk_note_patch['case_family']) : (isset($existing_note['case_family']) ? $existing_note['case_family'] : 'unknown'),
        'business_priority' => daszek_v2_pick_text_value(isset($desk_note_patch['business_priority']) ? $desk_note_patch['business_priority'] : '', isset($existing_note['business_priority']) ? $existing_note['business_priority'] : 'medium', 'medium'),
        'safe_for_live_push' => isset($desk_note_patch['safe_for_live_push']) ? !empty($desk_note_patch['safe_for_live_push']) : (!empty($existing_note['safe_for_live_push'])),
        'priority' => isset($desk_note_patch['priority']) ? sanitize_text_field($desk_note_patch['priority']) : (isset($existing_note['priority']) ? $existing_note['priority'] : 'low'),
        'due_at' => isset($desk_note_patch['due_at']) ? sanitize_text_field($desk_note_patch['due_at']) : (isset($existing_note['due_at']) ? $existing_note['due_at'] : null),
        'visibility_score' => isset($desk_note_patch['visibility_score']) ? floatval($desk_note_patch['visibility_score']) : (isset($existing_note['visibility_score']) ? floatval($existing_note['visibility_score']) : 0.0),
        'trace_summary_pl' => isset($desk_note_patch['trace_summary_pl']) ? sanitize_textarea_field($desk_note_patch['trace_summary_pl']) : (isset($existing_note['trace_summary_pl']) ? $existing_note['trace_summary_pl'] : ''),
        'attachment_summary_pl' => daszek_v2_pick_text_value(isset($desk_note_patch['attachment_summary_pl']) ? $desk_note_patch['attachment_summary_pl'] : '', isset($existing_note['attachment_summary_pl']) ? $existing_note['attachment_summary_pl'] : '', '', true),
        'thread_summary_pl' => daszek_v2_pick_text_value(isset($desk_note_patch['thread_summary_pl']) ? $desk_note_patch['thread_summary_pl'] : '', isset($existing_note['thread_summary_pl']) ? $existing_note['thread_summary_pl'] : '', '', true),
        'unresolved_questions' => daszek_v2_pick_json_value(isset($desk_note_patch['unresolved_questions']) ? $desk_note_patch['unresolved_questions'] : [], isset($existing_note['unresolved_questions']) ? $existing_note['unresolved_questions'] : [], []),
        'case_snapshot' => daszek_v2_pick_json_value(isset($desk_note_patch['case_snapshot']) ? $desk_note_patch['case_snapshot'] : [], isset($existing_note['case_snapshot']) ? $existing_note['case_snapshot'] : [], []),
        'key_facts' => daszek_v2_pick_json_value(isset($desk_note_patch['key_facts']) ? $desk_note_patch['key_facts'] : [], isset($existing_note['key_facts']) ? $existing_note['key_facts'] : [], []),
        'latest_documents' => daszek_v2_pick_json_value(isset($desk_note_patch['latest_documents']) ? $desk_note_patch['latest_documents'] : [], isset($existing_note['latest_documents']) ? $existing_note['latest_documents'] : [], []),
        'conflicting_facts' => daszek_v2_pick_json_value(isset($desk_note_patch['conflicting_facts']) ? $desk_note_patch['conflicting_facts'] : [], isset($existing_note['conflicting_facts']) ? $existing_note['conflicting_facts'] : [], []),
        'drive_documents_summary' => daszek_v2_pick_json_value(isset($desk_note_patch['drive_documents_summary']) ? $desk_note_patch['drive_documents_summary'] : [], isset($existing_note['drive_documents_summary']) ? $existing_note['drive_documents_summary'] : [], []),
        'completeness_gaps' => daszek_v2_pick_json_value(isset($desk_note_patch['completeness_gaps']) ? $desk_note_patch['completeness_gaps'] : [], isset($existing_note['completeness_gaps']) ? $existing_note['completeness_gaps'] : [], []),
        'graph_hints' => daszek_v2_pick_json_value(isset($desk_note_patch['graph_hints']) ? $desk_note_patch['graph_hints'] : [], isset($existing_note['graph_hints']) ? $existing_note['graph_hints'] : [], []),
        'reference_documents' => daszek_v2_pick_json_value(isset($desk_note_patch['reference_documents']) ? $desk_note_patch['reference_documents'] : [], isset($existing_note['reference_documents']) ? $existing_note['reference_documents'] : [], []),
        'warranty_service_state' => daszek_v2_pick_json_value(isset($desk_note_patch['warranty_service_state']) ? $desk_note_patch['warranty_service_state'] : [], isset($existing_note['warranty_service_state']) ? $existing_note['warranty_service_state'] : [], []),
        'media_evidence_presence' => daszek_v2_pick_json_value(isset($desk_note_patch['media_evidence_presence']) ? $desk_note_patch['media_evidence_presence'] : [], isset($existing_note['media_evidence_presence']) ? $existing_note['media_evidence_presence'] : [], []),
        'related_entities' => daszek_v2_pick_json_value(isset($desk_note_patch['related_entities']) ? $desk_note_patch['related_entities'] : [], isset($existing_note['related_entities']) ? $existing_note['related_entities'] : [], []),
        'operator_visible_conflicts' => daszek_v2_pick_json_value(isset($desk_note_patch['operator_visible_conflicts']) ? $desk_note_patch['operator_visible_conflicts'] : [], isset($existing_note['operator_visible_conflicts']) ? $existing_note['operator_visible_conflicts'] : [], []),
        'evidence_cards' => daszek_v2_pick_json_value(isset($desk_note_patch['evidence_cards']) ? $desk_note_patch['evidence_cards'] : [], isset($existing_note['evidence_cards']) ? $existing_note['evidence_cards'] : [], []),
        'service_signals' => daszek_v2_pick_json_value(isset($desk_note_patch['service_signals']) ? $desk_note_patch['service_signals'] : [], isset($existing_note['service_signals']) ? $existing_note['service_signals'] : [], []),
        'marketing_signals' => daszek_v2_pick_json_value(isset($desk_note_patch['marketing_signals']) ? $desk_note_patch['marketing_signals'] : [], isset($existing_note['marketing_signals']) ? $existing_note['marketing_signals'] : [], []),
        'action_proposals' => daszek_v2_pick_json_value(isset($desk_note_patch['action_proposals']) ? $desk_note_patch['action_proposals'] : [], isset($existing_note['action_proposals']) ? $existing_note['action_proposals'] : [], []),
        'execution_results' => daszek_v2_pick_json_value(isset($desk_note_patch['execution_results']) ? $desk_note_patch['execution_results'] : [], isset($existing_note['execution_results']) ? $existing_note['execution_results'] : [], []),
        'calendar' => daszek_v2_pick_json_value(isset($desk_note_patch['calendar']) ? $desk_note_patch['calendar'] : [], isset($existing_note['calendar']) ? $existing_note['calendar'] : [], []),
        'document_intelligence' => daszek_v2_pick_json_value(isset($desk_note_patch['document_intelligence']) ? $desk_note_patch['document_intelligence'] : [], isset($existing_note['document_intelligence']) ? $existing_note['document_intelligence'] : [], []),
        'source_refs' => daszek_v2_pick_json_value(isset($desk_note_patch['source_refs']) ? $desk_note_patch['source_refs'] : [], isset($existing_note['source_refs']) ? $existing_note['source_refs'] : [], []),
        'review_mode' => isset($desk_note_patch['review_mode']) ? sanitize_text_field($desk_note_patch['review_mode']) : (isset($existing_note['review_mode']) ? $existing_note['review_mode'] : ''),
        'review_reason_pl' => isset($desk_note_patch['review_reason_pl']) ? sanitize_textarea_field($desk_note_patch['review_reason_pl']) : (isset($existing_note['review_reason_pl']) ? $existing_note['review_reason_pl'] : ''),
        'automation_policy' => daszek_v2_pick_json_value(isset($desk_note_patch['automation_policy']) ? $desk_note_patch['automation_policy'] : [], isset($existing_note['automation_policy']) ? $existing_note['automation_policy'] : [], []),
        'operational_status' => isset($desk_note_patch['operational_status']) ? sanitize_text_field($desk_note_patch['operational_status']) : (isset($existing_note['operational_status']) ? $existing_note['operational_status'] : ''),
        'waiting_for' => isset($desk_note_patch['waiting_for']) ? sanitize_text_field($desk_note_patch['waiting_for']) : (isset($existing_note['waiting_for']) ? $existing_note['waiting_for'] : ''),
        'guidance_reason_summary_pl' => isset($desk_note_patch['guidance_reason_summary_pl']) ? sanitize_textarea_field($desk_note_patch['guidance_reason_summary_pl']) : (isset($existing_note['guidance_reason_summary_pl']) ? $existing_note['guidance_reason_summary_pl'] : ''),
        'blocker_summary_pl' => isset($desk_note_patch['blocker_summary_pl']) ? sanitize_textarea_field($desk_note_patch['blocker_summary_pl']) : (isset($existing_note['blocker_summary_pl']) ? $existing_note['blocker_summary_pl'] : ''),
        'stagnation_flag' => isset($desk_note_patch['stagnation_flag']) ? !empty($desk_note_patch['stagnation_flag']) : (!empty($existing_note['stagnation_flag'])),
        'operator_attention_class' => isset($desk_note_patch['operator_attention_class']) ? sanitize_text_field($desk_note_patch['operator_attention_class']) : (isset($existing_note['operator_attention_class']) ? $existing_note['operator_attention_class'] : ''),
        'next_step_hint_pl' => isset($desk_note_patch['next_step_hint_pl']) ? sanitize_textarea_field($desk_note_patch['next_step_hint_pl']) : (isset($existing_note['next_step_hint_pl']) ? $existing_note['next_step_hint_pl'] : ''),
        'guidance_confidence' => isset($desk_note_patch['guidance_confidence']) ? floatval($desk_note_patch['guidance_confidence']) : (isset($existing_note['guidance_confidence']) ? floatval($existing_note['guidance_confidence']) : 0.0),
        'feedback_state' => $feedback_state,
        'created_at' => isset($existing_note['created_at']) ? $existing_note['created_at'] : $updated_at,
        'updated_at' => $updated_at,
        'last_command' => $command,
        'latest_signal_at' => $latest_signal_at,
    ];
}

function daszek_v2_apply_case_patch(&$cases, $case_patch, $signal = null) {
    if (!is_array($case_patch) || empty($case_patch['case_id'])) {
        return false;
    }

    $case_id = sanitize_text_field($case_patch['case_id']);
    $command = isset($case_patch['command']) ? sanitize_text_field($case_patch['command']) : 'upsert_case';
    $existing = isset($cases[$case_id]) && is_array($cases[$case_id]) ? $cases[$case_id] : [];
    $record = daszek_v2_build_case_record($case_patch, $existing, $signal);

    if ($command === 'close_case') {
        $record['status'] = 'closed';
    } elseif ($command === 'reopen_case') {
        $record['status'] = 'open';
    } elseif ($command === 'merge_case') {
        $record['status'] = 'merged';
    }

    $cases[$case_id] = $record;
    return true;
}

function daszek_v2_apply_desk_note_patch(&$desk_notes, $desk_note_patch, $signal = null) {
    if (!is_array($desk_note_patch) || empty($desk_note_patch['desk_note_id'])) {
        return false;
    }

    $note_id = sanitize_text_field($desk_note_patch['desk_note_id']);
    $existing = isset($desk_notes[$note_id]) && is_array($desk_notes[$note_id]) ? $desk_notes[$note_id] : [];
    $desk_notes[$note_id] = daszek_v2_build_desk_note_record($desk_note_patch, $existing, $signal);
    return true;
}

function daszek_v2_rebuild_case_rollups(&$cases, $desk_notes) {
    foreach ($cases as $case_id => $case) {
        if (!is_array($case)) {
            continue;
        }
        $cases[$case_id]['open_desk_note_id'] = '';
        $cases[$case_id]['active_note_count'] = 0;
    }

    foreach ($desk_notes as $note) {
        if (!is_array($note)) {
            continue;
        }
        $case_id = isset($note['case_id']) ? sanitize_text_field($note['case_id']) : '';
        if ($case_id === '' || !isset($cases[$case_id]) || !is_array($cases[$case_id])) {
            continue;
        }
        if (!isset($note['lifecycle_state']) || $note['lifecycle_state'] !== 'active') {
            continue;
        }

        $cases[$case_id]['active_note_count'] = intval($cases[$case_id]['active_note_count']) + 1;
        $current_note_id = isset($cases[$case_id]['open_desk_note_id']) ? $cases[$case_id]['open_desk_note_id'] : '';
        if ($current_note_id === '') {
            $cases[$case_id]['open_desk_note_id'] = $note['note_id'];
            continue;
        }

        $current_note = isset($desk_notes[$current_note_id]) && is_array($desk_notes[$current_note_id]) ? $desk_notes[$current_note_id] : null;
        if (!$current_note) {
            $cases[$case_id]['open_desk_note_id'] = $note['note_id'];
            continue;
        }

        $current_rank = daszek_v2_presence_rank(isset($current_note['presence_mode']) ? $current_note['presence_mode'] : 'silent');
        $candidate_rank = daszek_v2_presence_rank(isset($note['presence_mode']) ? $note['presence_mode'] : 'silent');
        $current_updated = isset($current_note['updated_at']) ? $current_note['updated_at'] : '';
        $candidate_updated = isset($note['updated_at']) ? $note['updated_at'] : '';

        if ($candidate_rank < $current_rank || ($candidate_rank === $current_rank && strcmp($candidate_updated, $current_updated) > 0)) {
            $cases[$case_id]['open_desk_note_id'] = $note['note_id'];
        }
    }
}

function daszek_v2_append_user_trace($subject_type, $subject_id, $case_id, $trigger_signal_id, $decision_type, $reason_summary_pl) {
    $trace = [
        'trace_id' => daszek_v2_generate_event_id('trace'),
        'subject_type' => sanitize_text_field($subject_type),
        'subject_id' => sanitize_text_field($subject_id),
        'case_id' => sanitize_text_field($case_id),
        'trigger_signal_id' => sanitize_text_field($trigger_signal_id),
        'decision_type' => sanitize_text_field($decision_type),
        'actor' => sanitize_text_field(daszek_current_user() ? daszek_current_user() : 'operator'),
        'reason_summary_pl' => sanitize_textarea_field($reason_summary_pl),
        'presence_mode' => '',
        'created_at' => daszek_v2_now_iso(),
    ];

    return daszek_v2_append_jsonl_store('decision_traces', $trace);
}

function daszek_v2_persist_projection($payload) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $signal = daszek_v2_pick_projection_entry($payload, ['signal', 'signal_projection']);
    $case_patch = daszek_v2_pick_projection_entry($payload, ['case_patch']);
    $desk_note_patch = daszek_v2_pick_projection_entry($payload, ['desk_note_patch']);
    $decision_trace = daszek_v2_pick_projection_entry($payload, ['decision_trace']);

    if (!$signal || !$decision_trace) {
        return new WP_Error('invalid_v2_payload', 'Payload Daszek v2 musi zawierac signal/signal_projection oraz decision_trace.', ['status' => 400]);
    }

    $signal_write = daszek_v2_append_jsonl_store_unique('signals', $signal, 'signal_id');
    if ($signal_write === 'error') {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $cases = daszek_v2_load_map_store('cases');
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $case_saved = false;
    $desk_note_saved = false;

    if ($case_patch && isset($case_patch['command']) && $case_patch['command'] !== 'noop' && !empty($case_patch['case_id'])) {
        $case_saved = daszek_v2_apply_case_patch($cases, $case_patch, $signal);
    }
    if ($desk_note_patch && !empty($desk_note_patch['desk_note_id'])) {
        $desk_note_saved = daszek_v2_apply_desk_note_patch($desk_notes, $desk_note_patch, $signal);
    }

    daszek_v2_rebuild_case_rollups($cases, $desk_notes);

    if (!daszek_v2_save_map_store('cases', $cases) || !daszek_v2_save_map_store('desk_notes', $desk_notes)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    $trace_write = daszek_v2_append_jsonl_store_unique('decision_traces', $decision_trace, 'trace_id');
    if ($trace_write === 'error') {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $thread_saved = false;
    if (isset($payload['thread_memory']) && is_array($payload['thread_memory'])) {
        $thread_saved = daszek_v2_persist_thread_memory($payload['thread_memory']);
        if (!$thread_saved) {
            return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
        }
    }

    $event_log_results = [
        'written' => 0,
        'duplicate' => 0,
        'error' => 0,
    ];
    if (isset($payload['operational_events']) && is_array($payload['operational_events'])) {
        foreach ($payload['operational_events'] as $raw_event) {
            if (!is_array($raw_event)) {
                continue;
            }
            $clean = daszek_v2_sanitize_json_value($raw_event);
            if (!is_array($clean) || empty($clean)) {
                continue;
            }
            $event_write = daszek_v2_append_jsonl_store_unique('event_log', $clean, 'event_id');
            if ($event_write === 'error') {
                $event_log_results['error']++;
                return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
            }
            $event_log_results[$event_write] = intval($event_log_results[$event_write]) + 1;
        }
    }

    return [
        'signal_id' => isset($signal['signal_id']) ? sanitize_text_field($signal['signal_id']) : '',
        'signal_status' => $signal_write,
        'case_saved' => $case_saved,
        'desk_note_saved' => $desk_note_saved,
        'trace_id' => isset($decision_trace['trace_id']) ? sanitize_text_field($decision_trace['trace_id']) : '',
        'trace_status' => $trace_write,
        'thread_memory_saved' => $thread_saved,
        'event_log_results' => $event_log_results,
    ];
}

function daszek_v2_merge_thread_memory($previous, $incoming) {
    if (!is_array($incoming)) {
        return is_array($previous) ? $previous : [];
    }
    $out = is_array($previous) ? $previous : [];
    $out['thread_id'] = isset($incoming['thread_id']) ? sanitize_text_field($incoming['thread_id']) : (isset($out['thread_id']) ? $out['thread_id'] : '');
    $inc_sum = isset($incoming['canonical_thread_summary']) ? sanitize_textarea_field($incoming['canonical_thread_summary']) : '';
    $prev_sum = isset($out['canonical_thread_summary']) ? sanitize_textarea_field($out['canonical_thread_summary']) : '';
    if ($inc_sum !== '' && (strlen($inc_sum) >= strlen($prev_sum))) {
        $out['canonical_thread_summary'] = $inc_sum;
    } elseif ($prev_sum !== '') {
        $out['canonical_thread_summary'] = $prev_sum;
    } else {
        $out['canonical_thread_summary'] = $inc_sum;
    }
    $merge_list = function ($a, $b) {
        $acc = [];
        foreach (is_array($a) ? $a : [] as $item) {
            $t = sanitize_text_field(is_scalar($item) ? (string) $item : '');
            if ($t !== '' && !in_array($t, $acc, true)) {
                $acc[] = $t;
            }
        }
        foreach (is_array($b) ? $b : [] as $item) {
            $t = sanitize_text_field(is_scalar($item) ? (string) $item : '');
            if ($t !== '' && !in_array($t, $acc, true)) {
                $acc[] = $t;
            }
        }
        return array_slice($acc, 0, 20);
    };
    $out['unresolved_questions'] = $merge_list(isset($out['unresolved_questions']) ? $out['unresolved_questions'] : [], isset($incoming['unresolved_questions']) ? $incoming['unresolved_questions'] : []);
    $out['commitments_made'] = $merge_list(isset($out['commitments_made']) ? $out['commitments_made'] : [], isset($incoming['commitments_made']) ? $incoming['commitments_made'] : []);
    $out['key_facts_so_far'] = $merge_list(isset($out['key_facts_so_far']) ? $out['key_facts_so_far'] : [], isset($incoming['key_facts_so_far']) ? $incoming['key_facts_so_far'] : []);
    if (isset($incoming['last_decision'])) {
        $out['last_decision'] = sanitize_text_field($incoming['last_decision']);
    }
    if (isset($incoming['thread_state'])) {
        $out['thread_state'] = sanitize_text_field($incoming['thread_state']);
    }
    if (isset($incoming['case_id'])) {
        $out['case_id'] = sanitize_text_field($incoming['case_id']);
    }
    $out['updated_at'] = daszek_v2_now_iso();
    return $out;
}

function daszek_v2_persist_thread_memory($incoming) {
    if (!is_array($incoming) || empty($incoming['thread_id'])) {
        return false;
    }
    $tid = sanitize_text_field($incoming['thread_id']);
    if ($tid === '') {
        return false;
    }
    $map = daszek_v2_load_map_store('thread_memory');
    $prev = isset($map[$tid]) && is_array($map[$tid]) ? $map[$tid] : [];
    $map[$tid] = daszek_v2_merge_thread_memory($prev, $incoming);
    return daszek_v2_save_map_store('thread_memory', $map);
}

function daszek_v2_build_feedback_event($note, $action, $target_case_id = '') {
    return [
        'feedback_id' => daszek_v2_generate_event_id('fb'),
        'desk_note_id' => isset($note['note_id']) ? sanitize_text_field($note['note_id']) : '',
        'source_signal_id' => isset($note['source_signal_ids'][0]) ? sanitize_text_field($note['source_signal_ids'][0]) : '',
        'feedback_type' => sanitize_text_field($action),
        'actor' => sanitize_text_field(daszek_current_user() ? daszek_current_user() : 'operator'),
        'target_case_id' => sanitize_text_field($target_case_id),
        'created_at' => daszek_v2_now_iso(),
    ];
}

function daszek_v2_apply_feedback($note_id, $action, $target_case_id = '') {
    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $cases = daszek_v2_load_map_store('cases');
    $note_id = sanitize_text_field($note_id);
    $action = sanitize_text_field($action);
    $target_case_id = sanitize_text_field($target_case_id);

    if ($note_id === '' || !isset($desk_notes[$note_id]) || !is_array($desk_notes[$note_id])) {
        return new WP_Error('not_found', 'Kartka nie istnieje.', ['status' => 404]);
    }

    $allowed_actions = ['trafne', 'za_mocne', 'za_slabe', 'tylko_w_sprawie', 'nie_pokazuj_takich', 'polacz_ze_sprawa', 'to_juz_nieaktualne', 'zla_sprawa'];
    if (!in_array($action, $allowed_actions, true)) {
        return new WP_Error('invalid_feedback', 'Nieobslugiwana akcja informacji zwrotnej.', ['status' => 400]);
    }

    $note = $desk_notes[$note_id];
    if ($action === 'tylko_w_sprawie' && empty($note['case_id'])) {
        return new WP_Error('invalid_feedback', 'Kartka bez sprawy nie moze przejsc do trybu tylko w sprawie.', ['status' => 400]);
    }
    if ($action === 'zla_sprawa') {
        if (empty($note['case_id'])) {
            return new WP_Error('invalid_feedback', 'Kartka musi byc powiazana ze sprawa, aby zglosic bledne powiazanie.', ['status' => 400]);
        }
        $sig_ids = isset($note['source_signal_ids']) && is_array($note['source_signal_ids']) ? $note['source_signal_ids'] : [];
        $sid0 = isset($sig_ids[0]) ? sanitize_text_field($sig_ids[0]) : '';
        if ($sid0 === '') {
            return new WP_Error('invalid_feedback', 'Brak identyfikatora sygnalu dla tej kartki — nie mozna zbudowac kolejki adiudykacji.', ['status' => 400]);
        }
    }
    $feedback_state = isset($note['feedback_state']) && is_array($note['feedback_state']) ? $note['feedback_state'] : daszek_v2_default_feedback_state();
    if (!isset($feedback_state[$action])) {
        $feedback_state[$action] = 0;
    }
    $feedback_state[$action] = intval($feedback_state[$action]) + 1;
    $feedback_state['ostatnia_akcja'] = $action;
    $feedback_state['ostatnia_akcja_at'] = daszek_v2_now_iso();
    $note['feedback_state'] = $feedback_state;
    $note['updated_at'] = daszek_v2_now_iso();

    if ($action === 'to_juz_nieaktualne') {
        $note['lifecycle_state'] = 'resolved';
        $note['lifecycle_label_pl'] = daszek_v2_lifecycle_label_pl('resolved');
        $note['presence_mode'] = 'silent';
        $note['presence_label_pl'] = daszek_v2_presence_label_pl('silent');
        $note['surface_zone'] = 'silent';
    } elseif ($action === 'tylko_w_sprawie') {
        $note['lifecycle_state'] = 'active';
        $note['lifecycle_label_pl'] = daszek_v2_lifecycle_label_pl('active');
        $note['presence_mode'] = 'silent';
        $note['presence_label_pl'] = daszek_v2_presence_label_pl('silent');
        $note['surface_zone'] = 'case_only';
    } elseif ($action === 'nie_pokazuj_takich') {
        $note['lifecycle_state'] = 'suppressed';
        $note['lifecycle_label_pl'] = daszek_v2_lifecycle_label_pl('suppressed');
        $note['presence_mode'] = 'silent';
        $note['presence_label_pl'] = daszek_v2_presence_label_pl('silent');
        $note['surface_zone'] = 'silent';
    } elseif ($action === 'polacz_ze_sprawa' && $target_case_id !== '') {
        $sig_ids = isset($note['source_signal_ids']) && is_array($note['source_signal_ids']) ? $note['source_signal_ids'] : [];
        $sid_merge = isset($sig_ids[0]) ? sanitize_text_field($sig_ids[0]) : '';
        if ($sid_merge === '') {
            return new WP_Error('invalid_feedback', 'Brak identyfikatora sygnalu — polaczenie wymaga pelnej sygnatury.', ['status' => 400]);
        }
        if (!isset($cases[$target_case_id]) || !is_array($cases[$target_case_id])) {
            return new WP_Error('invalid_feedback', 'Polaczenie wymaga istniejacej sprawy docelowej - Daszek nie tworzy nowej prawdy biznesowej.', ['status' => 400]);
        }
        $note['case_id'] = $target_case_id;
    }

    $desk_notes[$note_id] = $note;
    daszek_v2_rebuild_case_rollups($cases, $desk_notes);

    if (!daszek_v2_save_map_store('cases', $cases) || !daszek_v2_save_map_store('desk_notes', $desk_notes)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $event = daszek_v2_build_feedback_event($note, $action, $target_case_id);
    if (!daszek_v2_append_jsonl_store('feedback_events', $event)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    if ($action === 'zla_sprawa') {
        $sig_ids = isset($note['source_signal_ids']) && is_array($note['source_signal_ids']) ? $note['source_signal_ids'] : [];
        $sid_bridge = isset($sig_ids[0]) ? sanitize_text_field($sig_ids[0]) : '';
        $bridge_row = [
            'queue_id' => daszek_v2_generate_event_id('bq'),
            'schema_version' => 'daszek_bridge_queue.v1',
            'domain' => 'adjudication',
            'adjudication_kind' => 'reject_same_case',
            'desk_note_id' => $note_id,
            'case_id' => sanitize_text_field($note['case_id']),
            'source_signal_id' => $sid_bridge,
            'bridge_status' => 'pending',
            'created_at' => daszek_v2_now_iso(),
        ];
        if (!daszek_v2_append_jsonl_store('bridge_queue', $bridge_row)) {
            return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
        }
    }

    $trace_reason = 'Operator zapisał informację zwrotną dla kartki.';
    if ($action === 'to_juz_nieaktualne') {
        $trace_reason = 'Operator oznaczył kartkę jako nieaktualną.';
    } elseif ($action === 'tylko_w_sprawie') {
        $trace_reason = 'Operator zostawił temat tylko w sprawie, bez obecności na Biurku.';
    } elseif ($action === 'nie_pokazuj_takich') {
        $trace_reason = 'Operator wyciszył kartkę tego typu.';
    } elseif ($action === 'polacz_ze_sprawa') {
        $trace_reason = 'Operator połączył kartkę z inną sprawą.';
    } elseif ($action === 'zla_sprawa') {
        $trace_reason = 'Operator zgłosił błędne powiązanie kartki ze sprawą (kolejka bridge).';
    }
    daszek_v2_append_user_trace('desk_note', $note_id, isset($note['case_id']) ? $note['case_id'] : '', isset($note['source_signal_ids'][0]) ? $note['source_signal_ids'][0] : '', $action, $trace_reason);

    return ['ok' => true, 'event' => $event, 'note' => $note];
}
