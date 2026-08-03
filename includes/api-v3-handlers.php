<?php
if (!defined('ABSPATH')) exit;

/**
 * Daszek REST API v3 handler implementations (Phase 9.1 split).
 */

function daszek_api_v3_case_engagement(WP_REST_Request $request) {
    $case_id = sanitize_text_field($request->get_param('id'));
    if ($case_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane case_id.', ['status' => 400]);
    }
    $result = daszek_node_b_get_json('/cases/' . rawurlencode($case_id) . '/engagement');
    if (is_wp_error($result)) {
        return $result;
    }
    return [
        'ok' => true,
        'case_id' => $case_id,
        'engagement' => $result,
        'labels_pl' => [
            'mail_case' => 'Sprawa mailowa',
            'cieplo_workflow' => 'Zlecenie Cieplo',
        ],
    ];
}

function daszek_api_v3_case_state_summary(WP_REST_Request $request) {
    $case_id = sanitize_text_field($request->get_param('id'));
    if ($case_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane case_id.', ['status' => 400]);
    }
    $result = daszek_node_b_get_json('/cases/' . rawurlencode($case_id) . '/state-summary');
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_engagement_snapshot(WP_REST_Request $request) {
    $engagement_id = sanitize_text_field($request->get_param('id'));
    if ($engagement_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane engagement_id.', ['status' => 400]);
    }
    $result = daszek_node_b_get_json('/engagements/' . rawurlencode($engagement_id) . '/snapshot');
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_engagement_os_events(WP_REST_Request $request) {
    $engagement_id = sanitize_text_field($request->get_param('id'));
    if ($engagement_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane engagement_id.', ['status' => 400]);
    }
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    if ($limit > 200) {
        $limit = 200;
    }
    $path = '/engagements/' . rawurlencode($engagement_id) . '/os-events?limit=' . $limit;
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_os_events_recent(WP_REST_Request $request) {
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    if ($limit > 200) {
        $limit = 200;
    }
    $path = '/system/os-events/recent?limit=' . $limit;
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_health_status(WP_REST_Request $request) {
    $path = '/system/health/status';
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_bridge_queue_summary(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $rows = daszek_v2_load_jsonl_store('bridge_queue');
    $pending = daszek_v2_bridge_queue_pending_rows($rows);
    $oldest_created_at = '';
    $domain_breakdown = [];
    $status_counts = daszek_v2_bridge_queue_status_counts($rows);
    $stuck_threshold = time() - (24 * 3600);
    $stuck_count = 0;

    foreach ($pending as $row) {
        if (!is_array($row)) {
            continue;
        }
        $domain = isset($row['domain']) ? sanitize_text_field($row['domain']) : 'unknown';
        if (!isset($domain_breakdown[$domain])) {
            $domain_breakdown[$domain] = 0;
        }
        $domain_breakdown[$domain]++;
        $created_at = isset($row['created_at']) ? sanitize_text_field($row['created_at']) : '';
        if ($created_at !== '') {
            if ($oldest_created_at === '' || strcmp($created_at, $oldest_created_at) < 0) {
                $oldest_created_at = $created_at;
            }
            $created_ts = strtotime($created_at);
            if ($created_ts !== false && $created_ts < $stuck_threshold) {
                $stuck_count++;
            }
        }
    }

    return [
        'ok' => true,
        'schema_version' => 'daszek_bridge_queue_summary.v1',
        'pending_count' => count($pending),
        'retry_count' => $status_counts['retry'],
        'failed_count' => $status_counts['failed'],
        'dead_letter_count' => $status_counts['dead_letter'],
        'actionable_count' => count($pending),
        'oldest_created_at' => $oldest_created_at,
        'stuck_count' => $stuck_count,
        'domain_breakdown' => $domain_breakdown,
    ];
}

function daszek_api_v3_system_decision_queue(WP_REST_Request $request) {
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    if ($limit > 200) {
        $limit = 200;
    }
    $path = '/system/decision-queue?limit=' . $limit;
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_constitution(WP_REST_Request $request) {
    $path = '/system/constitution';
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_briefing(WP_REST_Request $request) {
    $path = '/system/briefing';
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_cost_summary(WP_REST_Request $request) {
    $path = '/system/cost-summary';
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_system_quality_summary(WP_REST_Request $request) {
    $path = '/system/quality-summary';
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_engagement_timeline(WP_REST_Request $request) {
    $engagement_id = sanitize_text_field($request->get_param('id'));
    if ($engagement_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane engagement_id.', ['status' => 400]);
    }
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    if ($limit > 500) {
        $limit = 500;
    }
    $path = '/engagements/' . rawurlencode($engagement_id) . '/timeline?limit=' . $limit;
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_learning_rule_candidates(WP_REST_Request $request) {
    $status_filter = sanitize_text_field($request->get_param('status') ?? 'pending_operator');
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    $path = '/learning/rule-candidates?status=' . rawurlencode($status_filter) . '&limit=' . $limit;
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_learning_rule_candidate_status(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $candidate_id = sanitize_text_field($request->get_param('id'));
    if ($candidate_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane candidate_id.', ['status' => 400]);
    }
    $body = $request->get_json_params();
    if (!is_array($body)) {
        return new WP_Error('invalid_payload', 'Wymagane JSON body.', ['status' => 400]);
    }
    $path = '/learning/rule-candidates/' . rawurlencode($candidate_id) . '/status';
    $result = daszek_node_b_get_json($path, 'POST', $body);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_identity_binding_suggestions(WP_REST_Request $request) {
    $status_filter = sanitize_text_field($request->get_param('status') ?? 'pending_operator');
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    $path = '/identity/binding-suggestions?status=' . rawurlencode($status_filter) . '&limit=' . $limit;
    $result = daszek_node_b_get_json($path);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_identity_binding_suggestions_scan(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $limit = (int) $request->get_param('limit');
    if ($limit <= 0) {
        $limit = 50;
    }
    $path = '/identity/binding-suggestions/scan?limit=' . $limit;
    $result = daszek_node_b_get_json($path, 'POST');
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v3_identity_binding_suggestion_status(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $suggestion_id = sanitize_text_field($request->get_param('id'));
    if ($suggestion_id === '') {
        return new WP_Error('invalid_id', 'Brak suggestion_id.', ['status' => 400]);
    }
    $body = $request->get_json_params();
    if (!is_array($body)) {
        return new WP_Error('invalid_payload', 'Wymagane JSON body.', ['status' => 400]);
    }
    $path = '/identity/binding-suggestions/' . rawurlencode($suggestion_id) . '/status';
    $result = daszek_node_b_get_json($path, 'POST', $body);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v2_ingest(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }

    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload Daszek v2 musi byc obiektem JSON.', ['status' => 400]);
    }

    $persisted = daszek_v2_persist_projection($payload);
    if (is_wp_error($persisted)) {
        return $persisted;
    }

    return [
        'ok' => true,
        'shadow_contract' => 'daszek_v2_ingest',
        'persisted' => $persisted,
    ];
}

function daszek_api_v3_cockpit(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    return daszek_v3_build_cockpit_read_model();
}

function daszek_api_v3_cohort_runs(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'items' => daszek_v3_latest_cohort_runs(20),
    ];
}

function daszek_api_v3_cohort_run_detail(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    $run_id = sanitize_text_field($request->get_param('id'));
    foreach (daszek_v3_latest_cohort_runs(200) as $run) {
        if (isset($run['run_id']) && sanitize_text_field($run['run_id']) === $run_id) {
            return ['ok' => true, 'generated_at' => daszek_v2_now_iso(), 'cohort_run' => $run];
        }
    }
    return new WP_Error('not_found', 'Cohort run nie istnieje.', ['status' => 404]);
}

function daszek_api_v3_skrzat_ask(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload Skrzata musi byc obiektem JSON.', ['status' => 400]);
    }
    $case_id = sanitize_text_field($request->get_param('id'));
    $question = isset($payload['question']) ? sanitize_textarea_field($payload['question']) : '';
    $mode = isset($payload['mode']) ? sanitize_key($payload['mode']) : 'ask';
    $query_text = isset($payload['query_text']) ? sanitize_textarea_field($payload['query_text']) : '';
    if ($case_id === '' || $question === '') {
        return new WP_Error('invalid_payload', 'Skrzat wymaga case_id i pytania.', ['status' => 400]);
    }
    if (!in_array($mode, ['ask', 'investigate', 'case_copilot'], true)) {
        $mode = 'ask';
    }

    $cfg = daszek_get_config();
    $node_b = isset($cfg['node_b_api']) && is_array($cfg['node_b_api']) ? $cfg['node_b_api'] : [];
    $base_url = isset($node_b['base_url']) ? trim((string) $node_b['base_url']) : '';
    if ($base_url === '') {
        return new WP_Error('node_b_unconfigured', 'Brak konfiguracji DASZEK_NODE_B_API_BASE dla proxy Skrzata.', ['status' => 503]);
    }

    $headers = ['Content-Type' => 'application/json'];
    $token = isset($node_b['api_token']) ? trim((string) $node_b['api_token']) : '';
    if ($token !== '') {
        $headers['Authorization'] = 'Bearer ' . $token;
    }
    $body = [
        'question' => $question,
        'mode' => $mode,
    ];
    if ($query_text !== '') {
        $body['query_text'] = $query_text;
    }

    $url = rtrim($base_url, '/') . '/cases/' . rawurlencode($case_id) . '/skrzat/ask';
    $response = wp_remote_post($url, [
        'timeout' => isset($node_b['timeout']) ? max(5, (int) $node_b['timeout']) : 20,
        'headers' => $headers,
        'body' => wp_json_encode($body),
    ]);
    if (is_wp_error($response)) {
        return new WP_Error('node_b_unavailable', $response->get_error_message(), ['status' => 502]);
    }

    $status = (int) wp_remote_retrieve_response_code($response);
    $raw = wp_remote_retrieve_body($response);
    $decoded = json_decode($raw, true);
    if ($status < 200 || $status >= 300) {
        return new WP_Error('node_b_error', 'Node B odrzucil pytanie Skrzata.', ['status' => $status ?: 502, 'body' => is_array($decoded) ? $decoded : null]);
    }
    if (!is_array($decoded) || ($decoded['schema_version'] ?? '') !== 'conversation_answer_envelope.v1') {
        return new WP_Error('invalid_node_b_response', 'Node B zwrocil nieprawidlowy envelope Skrzata.', ['status' => 502]);
    }
    return $decoded;
}

function daszek_api_v3_cohort_run_ingest(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload cohort run musi byc obiektem JSON.', ['status' => 400]);
    }
    $run_id = isset($payload['run_id']) ? sanitize_text_field($payload['run_id']) : '';
    if ($run_id === '') {
        return new WP_Error('invalid_payload', 'Cohort run wymaga run_id.', ['status' => 400]);
    }
    $payload['schema_version'] = isset($payload['schema_version']) ? sanitize_text_field($payload['schema_version']) : 'cohort_proof_run.v1';
    $payload['run_id'] = $run_id;
    $payload['projected_at'] = gmdate('c');
    $result = daszek_v2_append_jsonl_store_unique('cohort_runs', daszek_v2_sanitize_json_value($payload), 'run_id');
    if ($result === 'error') {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    return ['ok' => true, 'status' => $result, 'run_id' => $run_id];
}

function daszek_v3_build_cockpit_read_model() {
    $desk = daszek_v2_build_desk_read_model(true);
    $cases = daszek_v2_build_cases_read_model();
    $quality = daszek_v2_build_ai_quality_read_model();
    $case_items = isset($cases['items']) && is_array($cases['items']) ? $cases['items'] : [];
    $desk_items = isset($desk['items']) && is_array($desk['items']) ? $desk['items'] : [];

    $substrate = [
        'case_count' => count($case_items),
        'desk_item_count' => count($desk_items),
        'conflict_count' => 0,
        'gap_count' => 0,
        'evidence_card_count' => 0,
        'service_signal_count' => 0,
        'marketing_signal_count' => 0,
        'action_proposal_count' => 0,
    ];

    foreach ($case_items as $case) {
        $substrate['conflict_count'] += isset($case['operator_visible_conflicts']) && is_array($case['operator_visible_conflicts']) ? count($case['operator_visible_conflicts']) : 0;
        $substrate['gap_count'] += isset($case['completeness_gaps']) && is_array($case['completeness_gaps']) ? count($case['completeness_gaps']) : 0;
        $substrate['evidence_card_count'] += isset($case['evidence_cards']) && is_array($case['evidence_cards']) ? count($case['evidence_cards']) : 0;
        $substrate['service_signal_count'] += isset($case['service_signals']) && is_array($case['service_signals']) ? count($case['service_signals']) : 0;
        $substrate['marketing_signal_count'] += isset($case['marketing_signals']) && is_array($case['marketing_signals']) ? count($case['marketing_signals']) : 0;
        $substrate['action_proposal_count'] += isset($case['action_proposals']) && is_array($case['action_proposals']) ? count($case['action_proposals']) : 0;
    }

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'view' => 'cockpit_v3',
        'substrate' => $substrate,
        'desk' => $desk,
        'cases' => $cases,
        'quality' => $quality,
        'cohort_runs' => daszek_v3_latest_cohort_runs(5),
        'guards' => [
            'truth_source' => 'node_b_mailbox_memory',
            'surface_role' => 'projection_operator_cockpit',
            'outbound_autonomy' => 'disabled_without_operator_approval',
        ],
    ];
}

function daszek_v3_latest_cohort_runs($limit = 20) {
    $rows = daszek_v2_load_jsonl_store('cohort_runs');
    $out = [];
    foreach ($rows as $row) {
        if (is_array($row)) {
            $out[] = $row;
        }
    }
    usort($out, function ($left, $right) {
        $left_at = isset($left['generated_at']) ? $left['generated_at'] : (isset($left['projected_at']) ? $left['projected_at'] : '');
        $right_at = isset($right['generated_at']) ? $right['generated_at'] : (isset($right['projected_at']) ? $right['projected_at'] : '');
        return strcmp($right_at, $left_at);
    });
    return array_slice($out, 0, intval($limit));
}

function daszek_api_v2_desk(WP_REST_Request $request) {
    $include_subtle = !empty($request->get_param('include_subtle'));
    return daszek_v2_build_desk_read_model($include_subtle);
}

function daszek_api_v2_day(WP_REST_Request $request) {
    $include_subtle = !empty($request->get_param('include_subtle'));
    return daszek_v2_build_day_read_model($include_subtle);
}

function daszek_api_v2_cases(WP_REST_Request $request) {
    return daszek_v2_build_cases_read_model();
}

function daszek_api_v2_case_archive(WP_REST_Request $request) {
    return daszek_v2_build_case_archive_read_model();
}

function daszek_api_v2_case_archive_mutate(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $case_id = sanitize_text_field($request->get_param('id'));
    $body = $request->get_json_params();
    $meta = is_array($body) ? $body : [];
    $result = daszek_v2_archive_case($case_id, $meta);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v2_case_unarchive(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $case_id = sanitize_text_field($request->get_param('id'));
    $result = daszek_v2_unarchive_case($case_id);
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_api_v2_case_detail(WP_REST_Request $request) {
    $case = daszek_v2_get_case_detail($request->get_param('id'));
    if (!$case) {
        return new WP_Error('not_found', 'Sprawa nie istnieje.', ['status' => 404]);
    }
    return $case;
}

function daszek_api_v2_note_detail(WP_REST_Request $request) {
    $note = daszek_v2_get_desk_note_detail($request->get_param('id'));
    if (!$note) {
        return new WP_Error('not_found', 'Kartka nie istnieje.', ['status' => 404]);
    }
    return $note;
}

function daszek_api_v2_thread_memory(WP_REST_Request $request) {
    $tid = sanitize_text_field($request->get_param('id'));
    if ($tid === '') {
        return new WP_Error('invalid_thread', 'Brak identyfikatora wÄ…tku.', ['status' => 400]);
    }
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    $map = daszek_v2_load_map_store('thread_memory');
    if (!isset($map[$tid]) || !is_array($map[$tid])) {
        return [
            'ok' => true,
            'thread_id' => $tid,
            'empty' => true,
        ];
    }
    return array_merge(['ok' => true, 'empty' => false], $map[$tid]);
}

function daszek_api_v2_calibration_profile(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    return daszek_v2_build_calibration_read_model();
}

function daszek_api_v2_ai_quality(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    return daszek_v2_build_ai_quality_read_model();
}

function daszek_api_v2_current_role() {
    $user = daszek_current_user();
    $login = is_string($user) ? sanitize_text_field($user) : '';
    if (in_array($login, ['konrad', 'darek'], true)) {
        return 'owner';
    }
    if ($login === 'daszek') {
        return 'agent_service';
    }
    return 'unknown';
}

function daszek_api_v2_require_owner() {
    if (daszek_api_v2_current_role() !== 'owner') {
        return new WP_Error('forbidden', 'Tylko owner moze zatwierdzac lub odrzucac akcje.', ['status' => 403]);
    }
    return true;
}

function daszek_api_v2_action_proposal_approve(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $owner_check = daszek_api_v2_require_owner();
    if (is_wp_error($owner_check)) {
        return $owner_check;
    }
    return daszek_api_v2_append_action_decision($request, 'approve');
}

function daszek_api_v2_action_proposal_reject(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $owner_check = daszek_api_v2_require_owner();
    if (is_wp_error($owner_check)) {
        return $owner_check;
    }
    return daszek_api_v2_append_action_decision($request, 'reject');
}

function daszek_api_v2_append_action_decision(WP_REST_Request $request, $decision) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    $payload = daszek_request_payload($request);
    $proposal_id = sanitize_text_field($request->get_param('id'));
    $reason = isset($payload['reason']) ? sanitize_textarea_field($payload['reason']) : '';
    $actor = daszek_current_user();
    $queue_id = 'bq_' . substr(hash('sha256', $proposal_id . '|' . $decision), 0, 24);
    $row = [
        'queue_id' => $queue_id,
        'schema_version' => 'daszek_bridge_queue.v1',
        'domain' => 'action_decision',
        'bridge_status' => 'pending',
        'proposal_id' => $proposal_id,
        'decision' => $decision,
        'reason' => $reason,
        'actor_id' => is_string($actor) ? sanitize_text_field($actor) : '',
        'created_at' => gmdate('c'),
    ];
    if (!daszek_v2_append_jsonl_store('bridge_queue', $row)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }
    return ['ok' => true, 'decision_key' => $queue_id, 'decision_status' => 'accepted', 'queued' => $row];
}

function daszek_api_v2_agent_hitl_request_payload(WP_REST_Request $request) {
    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }
    $engagement_id = isset($payload['engagement_id']) ? sanitize_text_field($payload['engagement_id']) : '';
    $action_id = isset($payload['action_id']) ? sanitize_text_field($payload['action_id']) : 'draft_reply';
    $case_id = isset($payload['case_id']) ? sanitize_text_field($payload['case_id']) : '';
    $operator_id = isset($payload['operator_id']) ? sanitize_text_field($payload['operator_id']) : '';
    if ($engagement_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane engagement_id.', ['status' => 400]);
    }
    if ($action_id === '') {
        return new WP_Error('invalid_payload', 'Wymagane action_id.', ['status' => 400]);
    }
    if ($operator_id === '') {
        $actor = daszek_current_user();
        $operator_id = is_string($actor) ? sanitize_text_field($actor) : 'operator';
    }
    $draft_pl = isset($payload['draft_pl']) ? sanitize_textarea_field($payload['draft_pl']) : '';
    return [
        'engagement_id' => $engagement_id,
        'action_id' => $action_id,
        'case_id' => $case_id,
        'operator_id' => $operator_id,
        'draft_pl' => $draft_pl,
    ];
}

function daszek_api_v2_agent_hitl_approve(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $owner_check = daszek_api_v2_require_owner();
    if (is_wp_error($owner_check)) {
        return $owner_check;
    }

    $parsed = daszek_api_v2_agent_hitl_request_payload($request);
    if (is_wp_error($parsed)) {
        return $parsed;
    }

    $result = daszek_node_b_get_json(
        '/engagements/' . rawurlencode($parsed['engagement_id']) . '/hitl/approve',
        'POST',
        [
            'action_id' => $parsed['action_id'],
            'operator_id' => $parsed['operator_id'],
            'case_id' => $parsed['case_id'],
            'operator_draft_pl' => $parsed['draft_pl'],
        ]
    );
    if (is_wp_error($result)) {
        return $result;
    }
    if (empty($result['ok'])) {
        $message = isset($result['error']) ? sanitize_text_field((string) $result['error']) : 'Node B odrzucil HITL approve.';
        return new WP_Error('hitl_approve_failed', $message, ['status' => 502, 'detail' => $result]);
    }
    return $result;
}

function daszek_api_v2_engagement_materialize_approve(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $owner_check = daszek_api_v2_require_owner();
    if (is_wp_error($owner_check)) {
        return $owner_check;
    }

    $engagement_id = sanitize_text_field((string) $request->get_param('id'));
    if ($engagement_id === '') {
        return new WP_Error('invalid_request', 'Brak engagement_id.', ['status' => 400]);
    }
    $body = $request->get_json_params();
    if (!is_array($body)) {
        $body = [];
    }
    $proposal_id = sanitize_text_field((string) ($body['proposal_id'] ?? $body['action_id'] ?? ''));
    if ($proposal_id === '') {
        return new WP_Error('invalid_request', 'Brak proposal_id.', ['status' => 400]);
    }
    $operator_id = isset($body['operator_id']) ? sanitize_text_field((string) $body['operator_id']) : '';
    if ($operator_id === '' || $operator_id === '0') {
        $actor = daszek_current_user();
        $operator_id = is_string($actor) && $actor !== '' ? sanitize_text_field($actor) : '';
    }
    if ($operator_id === '' || $operator_id === '0') {
        return new WP_Error('invalid_operator', 'Brak operator_id.', ['status' => 400]);
    }

    $result = daszek_node_b_get_json(
        '/engagements/' . rawurlencode($engagement_id) . '/materialize/approve',
        'POST',
        [
            'proposal_id' => $proposal_id,
            'operator_id' => $operator_id,
            'reason' => sanitize_text_field((string) ($body['reason'] ?? '')),
        ]
    );
    if (is_wp_error($result)) {
        return $result;
    }
    if (empty($result['ok'])) {
        $message = isset($result['error']) ? sanitize_text_field((string) $result['error']) : 'Node B odrzucil materialize approve.';
        return new WP_Error('materialize_approve_failed', $message, ['status' => 502, 'detail' => $result]);
    }
    return $result;
}

function daszek_api_v2_agent_hitl_send(WP_REST_Request $request) {
    return new WP_Error(
        'agent_hitl_send_disabled',
        'Node B ma Gmail read-only. Zatwierdz szkic do recznej wysylki przez operatora.',
        ['status' => 410]
    );
}

function daszek_api_v2_note_feedback(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }

    $payload = daszek_request_payload($request);
    $action = isset($payload['action']) ? sanitize_text_field($payload['action']) : '';
    $target_case_id = isset($payload['target_case_id']) ? sanitize_text_field($payload['target_case_id']) : '';

    $result = daszek_v2_apply_feedback($request->get_param('id'), $action, $target_case_id);
    if (is_wp_error($result)) {
        return $result;
    }

    return $result;
}

function daszek_bridge_api_token() {
    if (defined('DASZEK_BRIDGE_TOKEN') && is_string(DASZEK_BRIDGE_TOKEN) && trim(DASZEK_BRIDGE_TOKEN) !== '') {
        return trim(DASZEK_BRIDGE_TOKEN);
    }

    $env_token = getenv('DASZEK_BRIDGE_TOKEN');
    if (is_string($env_token) && trim($env_token) !== '') {
        return trim($env_token);
    }

    return '';
}

function daszek_bridge_request_token(WP_REST_Request $request) {
    $token = $request->get_header('X-Daszek-Bridge-Token');
    if (is_string($token) && trim($token) !== '') {
        return trim($token);
    }

    $authorization = $request->get_header('Authorization');
    if (is_string($authorization) && preg_match('/^Bearer\s+(.+)$/i', trim($authorization), $matches)) {
        return trim($matches[1]);
    }

    return '';
}

function daszek_node_b_service_token() {
    if (defined('DASZEK_NODE_B_SERVICE_TOKEN') && is_string(DASZEK_NODE_B_SERVICE_TOKEN) && trim(DASZEK_NODE_B_SERVICE_TOKEN) !== '') {
        return trim(DASZEK_NODE_B_SERVICE_TOKEN);
    }

    $env_token = getenv('DASZEK_NODE_B_SERVICE_TOKEN');
    if (is_string($env_token) && trim($env_token) !== '') {
        return trim($env_token);
    }

    return '';
}

function daszek_check_node_b_service_token(WP_REST_Request $request) {
    $expected = daszek_node_b_service_token();
    if ($expected === '') {
        return new WP_Error('service_token_not_configured', 'Node B service token is not configured.', ['status' => 503]);
    }

    $provided = daszek_bridge_request_token($request);
    if ($provided === '' || !hash_equals($expected, $provided)) {
        return new WP_Error('unauthorized_service', 'Invalid Node B service token.', ['status' => 401]);
    }

    return true;
}

function daszek_check_bridge_token(WP_REST_Request $request) {
    $expected = daszek_bridge_api_token();
    if ($expected === '') {
        return new WP_Error('bridge_token_not_configured', 'Bridge token is not configured.', ['status' => 503]);
    }

    $provided = daszek_bridge_request_token($request);
    if ($provided === '' || !hash_equals($expected, $provided)) {
        return new WP_Error('unauthorized_bridge', 'Invalid bridge token.', ['status' => 401]);
    }

    return true;
}

/**
 * POST ingress-quality / operational-feed snapshots:
 * 1) DASZEK_NODE_B_SERVICE_TOKEN (dedicated Node B push identity)
 * 2) DASZEK_BRIDGE_TOKEN (legacy bridge)
 * 3) operator session + CSRF (manual dev)
 */
function daszek_check_ingress_quality_snapshot_write(WP_REST_Request $request) {
    if (daszek_node_b_service_token() !== '') {
        return daszek_check_node_b_service_token($request);
    }

    $expected = daszek_bridge_api_token();
    if ($expected !== '') {
        return daszek_check_bridge_token($request);
    }

    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }

    return daszek_check_auth($request);
}

function daszek_check_operational_feed_snapshot_write(WP_REST_Request $request) {
    return daszek_check_ingress_quality_snapshot_write($request);
}

function daszek_check_system_health_snapshot_write(WP_REST_Request $request) {
    return daszek_check_ingress_quality_snapshot_write($request);
}

function daszek_v2_bridge_queue_completion_ids($rows) {
    $done = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $queue_id = isset($row['queue_id']) ? sanitize_text_field($row['queue_id']) : '';
        $status = isset($row['bridge_status']) ? strtolower(sanitize_text_field($row['bridge_status'])) : '';
        if ($queue_id !== '' && in_array($status, ['completed', 'failed', 'skipped', 'dead_letter'], true)) {
            $done[$queue_id] = true;
        }
    }
    return $done;
}

function daszek_v2_bridge_queue_latest_rows($rows) {
    $latest = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $queue_id = isset($row['queue_id']) ? sanitize_text_field($row['queue_id']) : '';
        if ($queue_id === '') {
            continue;
        }
        $latest[$queue_id] = $row;
    }
    return $latest;
}

function daszek_v2_bridge_queue_retry_due($row) {
    if (!is_array($row)) {
        return false;
    }
    $next_retry_at = isset($row['next_retry_at']) ? sanitize_text_field($row['next_retry_at']) : '';
    if ($next_retry_at === '') {
        return true;
    }
    $ts = strtotime($next_retry_at);
    if ($ts === false) {
        return true;
    }
    return $ts <= time();
}

function daszek_v2_bridge_queue_merge_status($base_row, $status_row) {
    $merged = is_array($base_row) ? $base_row : [];
    foreach (['bridge_status', 'bridge_error', 'retry_count', 'next_retry_at', 'retryable'] as $key) {
        if (isset($status_row[$key]) && $status_row[$key] !== '') {
            $merged[$key] = $status_row[$key];
        }
    }
    return $merged;
}

function daszek_v2_bridge_queue_status_counts($rows) {
    $counts = [
        'pending' => 0,
        'retry' => 0,
        'failed' => 0,
        'dead_letter' => 0,
        'completed' => 0,
        'skipped' => 0,
    ];
    foreach (daszek_v2_bridge_queue_latest_rows($rows) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $status = isset($row['bridge_status']) ? strtolower(sanitize_text_field($row['bridge_status'])) : 'pending';
        if (!isset($counts[$status])) {
            continue;
        }
        $counts[$status]++;
    }
    return $counts;
}

function daszek_v2_bridge_queue_pending_rows($rows) {
    $latest = daszek_v2_bridge_queue_latest_rows($rows);
    $seen = [];
    $pending = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $queue_id = isset($row['queue_id']) ? sanitize_text_field($row['queue_id']) : '';
        if ($queue_id === '' || isset($seen[$queue_id])) {
            continue;
        }
        if (($row['schema_version'] ?? '') !== 'daszek_bridge_queue.v1') {
            continue;
        }

        $domain = isset($row['domain']) ? sanitize_text_field($row['domain']) : '';
        if (!in_array($domain, ['adjudication', 'action_decision', 'agent_hitl'], true)) {
            continue;
        }
        if ($domain === 'adjudication') {
            $kind = isset($row['adjudication_kind']) ? sanitize_text_field($row['adjudication_kind']) : '';
            if ($kind !== 'reject_same_case') {
                continue;
            }
        }
        if ($domain === 'agent_hitl') {
            $kind = isset($row['adjudication_kind']) ? sanitize_text_field($row['adjudication_kind']) : '';
            if ($kind !== 'hitl_action_execute') {
                continue;
            }
        }

        $status_row = isset($latest[$queue_id]) && is_array($latest[$queue_id]) ? $latest[$queue_id] : $row;
        $status = isset($status_row['bridge_status']) ? strtolower(sanitize_text_field($status_row['bridge_status'])) : 'pending';
        if (in_array($status, ['completed', 'failed', 'skipped', 'dead_letter'], true)) {
            continue;
        }
        if (!in_array($status, ['pending', 'retry'], true)) {
            continue;
        }
        if ($status === 'retry' && !daszek_v2_bridge_queue_retry_due($status_row)) {
            continue;
        }

        $pending[] = daszek_v2_bridge_queue_merge_status($row, $status_row);
        $seen[$queue_id] = true;
    }

    return $pending;
}

function daszek_api_v2_bridge_queue(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $status = sanitize_text_field($request->get_param('status') ?: 'pending');
    $limit = intval($request->get_param('limit') ?: 25);
    if ($limit <= 0) {
        $limit = 25;
    }
    $limit = min($limit, 100);

    $rows = daszek_v2_load_jsonl_store('bridge_queue');
    if ($status === 'all') {
        $items = $rows;
    } elseif ($status === 'pending' || $status === 'actionable') {
        $items = daszek_v2_bridge_queue_pending_rows($rows);
    } else {
        $items = [];
        foreach (daszek_v2_bridge_queue_latest_rows($rows) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $row_status = isset($row['bridge_status']) ? strtolower(sanitize_text_field($row['bridge_status'])) : 'pending';
            if ($row_status === $status) {
                $items[] = $row;
            }
        }
    }

    return [
        'ok' => true,
        'schema_version' => 'daszek_bridge_queue_api.v1',
        'status' => $status === 'all' ? 'all' : $status,
        'total_rows' => count($rows),
        'pending_count' => count(daszek_v2_bridge_queue_pending_rows($rows)),
        'limit' => $limit,
        'items' => array_slice($items, 0, $limit),
    ];
}

function daszek_api_v2_bridge_queue_complete(WP_REST_Request $request) {
    if (!daszek_v2_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload must be a JSON object.', ['status' => 400]);
    }

    $queue_id = isset($payload['queue_id']) ? sanitize_text_field($payload['queue_id']) : '';
    $status = isset($payload['bridge_status']) ? strtolower(sanitize_text_field($payload['bridge_status'])) : 'completed';
    if ($queue_id === '') {
        return new WP_Error('invalid_payload', 'queue_id is required.', ['status' => 400]);
    }
    if (!in_array($status, ['completed', 'failed', 'skipped', 'retry', 'dead_letter'], true)) {
        return new WP_Error('invalid_payload', 'Unsupported bridge_status.', ['status' => 400]);
    }

    $bridge_error = isset($payload['bridge_error']) ? substr(sanitize_textarea_field($payload['bridge_error']), 0, 4000) : '';
    $error_payload = json_decode($bridge_error, true);
    $row = [
        'queue_id' => $queue_id,
        'schema_version' => 'daszek_bridge_queue.v1',
        'bridge_status' => $status,
        'bridge_error' => $bridge_error,
        'bridge_completed_at' => gmdate('c'),
    ];
    if (is_array($error_payload)) {
        if (isset($error_payload['retry_count'])) {
            $row['retry_count'] = max(0, intval($error_payload['retry_count']));
        }
        if (!empty($error_payload['next_retry_at'])) {
            $row['next_retry_at'] = sanitize_text_field((string) $error_payload['next_retry_at']);
        }
        if (array_key_exists('retryable', $error_payload)) {
            $row['retryable'] = (bool) $error_payload['retryable'];
        }
    }

    if (!daszek_v2_append_jsonl_store('bridge_queue', $row)) {
        return new WP_Error('storage_error', daszek_v2_storage_error_message(), ['status' => 500]);
    }

    return ['ok' => true, 'completed' => $row];
}

function daszek_v3_validate_ingress_quality_snapshot_payload($payload) {
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }

    $schema_name = isset($payload['schema_name']) ? sanitize_text_field($payload['schema_name']) : '';
    if ($schema_name !== 'daszek_ingress_quality_snapshot') {
        return new WP_Error('invalid_schema', 'Nieprawidlowe schema_name.', ['status' => 400]);
    }

    if (empty($payload['schema_version'])) {
        return new WP_Error('invalid_schema', 'Brak schema_version.', ['status' => 400]);
    }

    $run_id = isset($payload['run_id']) ? sanitize_text_field($payload['run_id']) : '';
    if ($run_id === '') {
        return new WP_Error('invalid_payload', 'Brak run_id.', ['status' => 400]);
    }

    if (empty($payload['read_only']) || $payload['read_only'] !== true) {
        return new WP_Error('invalid_payload', 'read_only musi byc true.', ['status' => 400]);
    }

    if (!isset($payload['creates_cases']) || $payload['creates_cases'] !== false) {
        return new WP_Error('invalid_payload', 'creates_cases musi byc false.', ['status' => 400]);
    }

    if (!isset($payload['executes_actions']) || $payload['executes_actions'] !== false) {
        return new WP_Error('invalid_payload', 'executes_actions musi byc false.', ['status' => 400]);
    }

    if (!isset($payload['counts']) || !is_array($payload['counts'])) {
        return new WP_Error('invalid_payload', 'Brak obiektu counts.', ['status' => 400]);
    }

    $forbidden_top = ['email_body', 'body', 'snippet', 'raw_llm', 'raw_response', 'prompt', 'prompt_text'];
    foreach ($forbidden_top as $key) {
        if (array_key_exists($key, $payload)) {
            return new WP_Error('invalid_payload', 'Zabroniony klucz w payloadzie.', ['status' => 400]);
        }
    }

    if (isset($payload['items']) && is_array($payload['items'])) {
        foreach ($payload['items'] as $idx => $item) {
            if (!is_array($item)) {
                continue;
            }
            foreach (['body', 'email_body', 'snippet', 'subject', 'raw_llm', 'raw_response', 'prompt'] as $bad) {
                if (array_key_exists($bad, $item)) {
                    return new WP_Error('invalid_payload', 'Element items zawiera zabronione pole.', ['status' => 400]);
                }
            }
        }
    }

    return true;
}

function daszek_api_v3_ingress_quality_snapshots_list(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $rows = daszek_v3_sorted_ingress_snapshots_desc();
    $limit = intval($request->get_param('limit') ?: 50);
    if ($limit <= 0) {
        $limit = 50;
    }
    $limit = min($limit, 200);

    $trimmed = [];
    foreach (array_slice($rows, 0, $limit) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $trimmed[] = [
            'run_id' => isset($row['run_id']) ? sanitize_text_field($row['run_id']) : '',
            'created_at' => isset($row['created_at']) ? sanitize_text_field($row['created_at']) : '',
            'ingested_at' => isset($row['ingested_at']) ? sanitize_text_field($row['ingested_at']) : '',
            'title' => isset($row['title']) ? sanitize_text_field($row['title']) : '',
        ];
    }

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'storage' => 'ingress_quality_snapshots',
        'items' => $trimmed,
    ];
}

function daszek_api_v3_ingress_quality_snapshot_latest(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $snap = daszek_v3_latest_ingress_quality_snapshot();
    if (!$snap) {
        return [
            'ok' => true,
            'snapshot' => null,
            'message' => 'Brak zapisanych snapshotĂłw ingressu.',
        ];
    }
    return [
        'ok' => true,
        'snapshot' => $snap,
    ];
}

function daszek_api_v3_ingress_quality_snapshot_detail(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $run_id = sanitize_text_field($request->get_param('id'));
    $snap = daszek_v3_get_ingress_quality_snapshot_by_run_id($run_id);
    if (!$snap) {
        return new WP_Error('not_found', 'Snapshot ingressu nie istnieje.', ['status' => 404]);
    }
    return [
        'ok' => true,
        'snapshot' => $snap,
    ];
}

function daszek_api_v3_ingress_quality_snapshot_ingest(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }

    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }

    $validated = daszek_v3_validate_ingress_quality_snapshot_payload($payload);
    if (is_wp_error($validated)) {
        return $validated;
    }

    $run_id = isset($payload['run_id']) ? sanitize_text_field($payload['run_id']) : '';
    $ingested_at = gmdate('c');
    $payload['ingested_at'] = $ingested_at;

    if (!daszek_v3_upsert_ingress_quality_snapshot($payload)) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }

    return [
        'ok' => true,
        'run_id' => $run_id,
        'ingested_at' => $ingested_at,
        'storage' => 'ingress_quality_snapshots',
        'warnings' => [],
    ];
}

function daszek_v3_normalize_operational_feed_schema_aliases($payload) {
    if (!is_array($payload)) {
        return $payload;
    }
    $schema_name = isset($payload['schema_name']) ? sanitize_text_field($payload['schema_name']) : '';
    if ($schema_name === 'daszek_v3_operational_feed_snapshot') {
        $payload['schema_name'] = 'daszek_operational_feed_snapshot';
    }
    return $payload;
}

/**
 * Forbidden JSON object keys anywhere in the operational feed snapshot payload.
 * Mirror: tools/gmail_audit/daszek_v3_operational_feed_contract.py FORBIDDEN_KEYS_ANYWHERE
 */
function daszek_v3_operational_feed_forbidden_keys_flat() {
    return array(
        'email_body',
        'body',
        'snippet',
        'subject',
        'raw_llm',
        'raw_response',
        'raw_body',
        'message_body',
        'prompt',
        'prompt_text',
        'attachment_bytes',
    );
}

/**
 * Depth-first scan for forbidden keys (privacy / projection contract).
 *
 * @param mixed $value
 * @param array $forbidden
 * @param string $path
 * @param int $depth
 * @param int $nodes
 * @return true|WP_Error
 */
function daszek_v3_walk_forbidden_keys($value, $forbidden, $path, $depth, &$nodes) {
    if ($depth > 12) {
        return new WP_Error('invalid_payload', 'Przekroczono glebokosc skanu payloadu.', array('status' => 400));
    }
    if ($nodes > 50000) {
        return new WP_Error('invalid_payload', 'Przekroczono limit wezlow skanu payloadu.', array('status' => 400));
    }
    if (is_array($value)) {
        foreach ($value as $key => $child) {
            $nodes++;
            if (is_string($key) && in_array($key, $forbidden, true)) {
                $suffix = $path === '' ? $key : $path . '/' . $key;
                return new WP_Error('invalid_payload', 'Zabroniony klucz w payloadzie: ' . $suffix, array('status' => 400));
            }
            $next_path = $path === '' ? (is_string($key) ? $key : '') : $path . '/' . (is_string($key) ? $key : '');
            $err = daszek_v3_walk_forbidden_keys($child, $forbidden, $next_path, $depth + 1, $nodes);
            if (is_wp_error($err)) {
                return $err;
            }
        }
    }
    return true;
}

function daszek_v3_validate_operational_feed_snapshot_payload($payload) {
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }

    $schema_name = isset($payload['schema_name']) ? sanitize_text_field($payload['schema_name']) : '';
    if ($schema_name !== 'daszek_operational_feed_snapshot') {
        return new WP_Error('invalid_schema', 'Nieprawidlowe schema_name.', ['status' => 400]);
    }

    if (empty($payload['schema_version'])) {
        return new WP_Error('invalid_schema', 'Brak schema_version.', ['status' => 400]);
    }

    $snapshot_id = isset($payload['snapshot_id']) ? sanitize_text_field($payload['snapshot_id']) : '';
    if ($snapshot_id === '') {
        return new WP_Error('invalid_payload', 'Brak snapshot_id.', ['status' => 400]);
    }

    if (empty($payload['read_only']) || $payload['read_only'] !== true) {
        return new WP_Error('invalid_payload', 'read_only musi byc true.', ['status' => 400]);
    }

    if (!isset($payload['creates_cases']) || $payload['creates_cases'] !== false) {
        return new WP_Error('invalid_payload', 'creates_cases musi byc false.', ['status' => 400]);
    }

    if (!isset($payload['executes_actions']) || $payload['executes_actions'] !== false) {
        return new WP_Error('invalid_payload', 'executes_actions musi byc false.', ['status' => 400]);
    }

    if (!isset($payload['feed']) || !is_array($payload['feed'])) {
        return new WP_Error('invalid_payload', 'Brak obiektu feed.', ['status' => 400]);
    }

    $feed = $payload['feed'];
    $schema_version = isset($payload['schema_version']) ? sanitize_text_field($payload['schema_version']) : '';
    foreach (['desk', 'cases', 'tasks', 'action_items'] as $list_key) {
        if (isset($feed[$list_key]) && !is_array($feed[$list_key])) {
            return new WP_Error('invalid_payload', 'feed.' . $list_key . ' musi byc tablica.', ['status' => 400]);
        }
    }
    if ($schema_version === '1.2' || $schema_version === '1.3') {
        if (!isset($feed['action_items']) || !is_array($feed['action_items'])) {
            return new WP_Error(
                'invalid_payload',
                'feed.action_items jest wymagane dla schema_version ' . $schema_version . '.',
                ['status' => 400]
            );
        }
    }
    if (isset($feed['case_details']) && !is_array($feed['case_details'])) {
        return new WP_Error('invalid_payload', 'feed.case_details musi byc obiektem mapy.', ['status' => 400]);
    }
    if (isset($feed['day']) && !is_array($feed['day'])) {
        return new WP_Error('invalid_payload', 'feed.day musi byc obiektem.', ['status' => 400]);
    }
    if (isset($feed['quality_readonly'])) {
        if (!is_array($feed['quality_readonly'])) {
            return new WP_Error('invalid_payload', 'feed.quality_readonly musi byc obiektem.', ['status' => 400]);
        }
        if (empty($feed['quality_readonly']['read_only']) || $feed['quality_readonly']['read_only'] !== true) {
            return new WP_Error('invalid_payload', 'feed.quality_readonly.read_only musi byc true.', ['status' => 400]);
        }
        if (!isset($feed['quality_readonly']['projection_type']) || $feed['quality_readonly']['projection_type'] !== 'quality_readonly') {
            return new WP_Error('invalid_payload', 'feed.quality_readonly.projection_type musi byc quality_readonly.', ['status' => 400]);
        }
    }

    $forbidden = daszek_v3_operational_feed_forbidden_keys_flat();
    $nodes = 0;
    $scan = daszek_v3_walk_forbidden_keys($payload, $forbidden, '', 0, $nodes);
    if (is_wp_error($scan)) {
        return $scan;
    }

    return true;
}

/**
 * Cross-check feed.desk[].note_id against v2 desk_notes store. Mutates $payload with
 * validation_warnings (string[]) when missing refs found. Returns warnings array, or WP_Error if strict.
 */
function daszek_v3_validate_operational_feed_desk_note_refs(&$payload) {
    $warnings = [];
    if (!is_array($payload) || !isset($payload['feed']) || !is_array($payload['feed'])) {
        return $warnings;
    }
    if (!daszek_v2_bootstrap_storage()) {
        $warnings[] = 'Magazyn v2 niedostÄ™pny â€” pominiÄ™to weryfikacjÄ™ referencji kartek (desk).';
        return $warnings;
    }

    $desk_notes = daszek_v2_load_map_store('desk_notes');
    $feed = $payload['feed'];
    $desk = isset($feed['desk']) && is_array($feed['desk']) ? $feed['desk'] : [];
    $missing = [];
    foreach ($desk as $item) {
        if (!is_array($item)) {
            continue;
        }
        $nid = isset($item['note_id']) ? sanitize_text_field((string) $item['note_id']) : '';
        if ($nid === '') {
            continue;
        }
        // Projection-only desk rows from Node B exporter use synthetic ids (desk-{case_id}-{ix}); they are not v2 desk_notes.
        if (stripos($nid, 'desk-') === 0) {
            continue;
        }
        if (!isset($desk_notes[$nid]) || !is_array($desk_notes[$nid])) {
            $missing[] = $nid;
        }
    }
    $missing = array_values(array_unique($missing));

    foreach ($missing as $id) {
        $warnings[] = 'Kartka z biurka (note_id) nie istnieje w magazynie v2: ' . $id;
    }

    if ($warnings) {
        $payload['validation_warnings'] = $warnings;
    }

    $cfg = daszek_get_config();
    $strict = !empty($cfg['operational_feed']['strict_desk_note_refs']);
    if ($strict && $missing) {
        return new WP_Error(
            'desk_note_refs',
            'Snapshot zawiera note_id bez rekordu w magazynie v2: ' . implode(', ', $missing),
            ['status' => 400]
        );
    }

    return $warnings;
}

function daszek_api_v3_operational_feed_snapshots_list(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $rows = daszek_v3_sorted_operational_feed_snapshots_desc();
    $limit = intval($request->get_param('limit') ?: 50);
    if ($limit <= 0) {
        $limit = 50;
    }
    $limit = min($limit, 200);

    $trimmed = [];
    foreach (array_slice($rows, 0, $limit) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $trimmed[] = [
            'snapshot_id' => isset($row['snapshot_id']) ? sanitize_text_field($row['snapshot_id']) : '',
            'created_at' => isset($row['created_at']) ? sanitize_text_field($row['created_at']) : '',
            'generated_at' => isset($row['generated_at']) ? sanitize_text_field($row['generated_at']) : '',
            'ingested_at' => isset($row['ingested_at']) ? sanitize_text_field($row['ingested_at']) : '',
            'title' => isset($row['title']) ? sanitize_text_field($row['title']) : '',
        ];
    }

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'storage' => 'operational_feed_snapshots',
        'items' => $trimmed,
    ];
}

function daszek_api_v3_operational_feed_snapshot_latest(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $snap = daszek_v3_latest_operational_feed_snapshot();
    if (!$snap) {
        return [
            'ok' => true,
            'snapshot' => null,
            'message' => 'Brak zapisanych snapshotĂłw operational feed.',
        ];
    }
    return [
        'ok' => true,
        'snapshot' => $snap,
    ];
}

function daszek_api_v3_operational_feed_snapshot_detail(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $snapshot_id = sanitize_text_field($request->get_param('id'));
    $snap = daszek_v3_get_operational_feed_snapshot_by_id($snapshot_id);
    if (!$snap) {
        return new WP_Error('not_found', 'Snapshot operational feed nie istnieje.', ['status' => 404]);
    }
    return [
        'ok' => true,
        'snapshot' => $snap,
    ];
}

function daszek_api_v3_operational_feed_snapshot_ingest(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }

    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }

    $payload = daszek_v3_normalize_operational_feed_schema_aliases($payload);

    foreach (array('environment', 'source_run_id', 'build_git_sha') as $meta_key) {
        if (isset($payload[$meta_key]) && is_string($payload[$meta_key])) {
            $payload[$meta_key] = sanitize_text_field($payload[$meta_key]);
            if (strlen($payload[$meta_key]) > 240) {
                $payload[$meta_key] = substr($payload[$meta_key], 0, 240);
            }
        }
    }

    $validated = daszek_v3_validate_operational_feed_snapshot_payload($payload);
    if (is_wp_error($validated)) {
        return $validated;
    }

    $note_ref_check = daszek_v3_validate_operational_feed_desk_note_refs($payload);
    if (is_wp_error($note_ref_check)) {
        return $note_ref_check;
    }
    $ingest_warnings = is_array($note_ref_check) ? $note_ref_check : [];

    $snapshot_id = isset($payload['snapshot_id']) ? sanitize_text_field($payload['snapshot_id']) : '';
    $ingested_at = gmdate('c');
    $payload['ingested_at'] = $ingested_at;

    if (!daszek_v3_upsert_operational_feed_snapshot($payload)) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }

    return [
        'ok' => true,
        'snapshot_id' => $snapshot_id,
        'ingested_at' => $ingested_at,
        'storage' => 'operational_feed_snapshots',
        'warnings' => $ingest_warnings,
    ];
}

function daszek_v3_validate_system_health_snapshot_payload($payload) {
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }

    $schema_name = isset($payload['schema_name']) ? sanitize_text_field($payload['schema_name']) : '';
    if ($schema_name !== 'daszek_system_health_snapshot') {
        return new WP_Error('invalid_schema', 'Nieprawidlowe schema_name.', ['status' => 400]);
    }

    if (empty($payload['schema_version'])) {
        return new WP_Error('invalid_schema', 'Brak schema_version.', ['status' => 400]);
    }

    $snapshot_id = isset($payload['snapshot_id']) ? sanitize_text_field($payload['snapshot_id']) : '';
    if ($snapshot_id === '') {
        return new WP_Error('invalid_payload', 'Brak snapshot_id.', ['status' => 400]);
    }

    if (empty($payload['read_only']) || $payload['read_only'] !== true) {
        return new WP_Error('invalid_payload', 'read_only musi byc true.', ['status' => 400]);
    }

    if (!isset($payload['creates_cases']) || $payload['creates_cases'] !== false) {
        return new WP_Error('invalid_payload', 'creates_cases musi byc false.', ['status' => 400]);
    }

    if (!isset($payload['executes_actions']) || $payload['executes_actions'] !== false) {
        return new WP_Error('invalid_payload', 'executes_actions musi byc false.', ['status' => 400]);
    }

    if (!isset($payload['components']) || !is_array($payload['components'])) {
        return new WP_Error('invalid_payload', 'Brak obiektu components.', ['status' => 400]);
    }

    $forbidden = daszek_v3_operational_feed_forbidden_keys_flat();
    $nodes = 0;
    $err = daszek_v3_walk_forbidden_keys($payload, $forbidden, '', 0, $nodes);
    if (is_wp_error($err)) {
        return $err;
    }

    return true;
}

function daszek_api_v3_system_health_snapshots_list(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $rows = daszek_v3_sorted_system_health_snapshots_desc();
    $limit = intval($request->get_param('limit') ?: 50);
    if ($limit <= 0) {
        $limit = 50;
    }
    $limit = min($limit, 200);

    $trimmed = [];
    foreach (array_slice($rows, 0, $limit) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $trimmed[] = [
            'snapshot_id' => isset($row['snapshot_id']) ? sanitize_text_field($row['snapshot_id']) : '',
            'created_at' => isset($row['created_at']) ? sanitize_text_field($row['created_at']) : '',
            'ingested_at' => isset($row['ingested_at']) ? sanitize_text_field($row['ingested_at']) : '',
            'title' => isset($row['title']) ? sanitize_text_field($row['title']) : '',
        ];
    }

    return [
        'ok' => true,
        'generated_at' => daszek_v2_now_iso(),
        'storage' => 'system_health_snapshots',
        'items' => $trimmed,
    ];
}

function daszek_api_v3_system_health_snapshot_latest(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $snap = daszek_v3_latest_system_health_snapshot();
    if (!$snap) {
        return [
            'ok' => true,
            'snapshot' => null,
            'message' => 'Brak zapisanych snapshotĂłw system_health.',
        ];
    }
    return [
        'ok' => true,
        'snapshot' => $snap,
    ];
}

function daszek_api_v3_system_health_snapshot_detail(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }
    $snapshot_id = sanitize_text_field($request->get_param('id'));
    $snap = daszek_v3_get_system_health_snapshot_by_id($snapshot_id);
    if (!$snap) {
        return new WP_Error('not_found', 'Snapshot system_health nie istnieje.', ['status' => 404]);
    }
    return [
        'ok' => true,
        'snapshot' => $snap,
    ];
}

function daszek_api_v3_system_health_snapshot_ingest(WP_REST_Request $request) {
    if (!daszek_v3_bootstrap_storage()) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }

    $payload = daszek_request_payload($request);
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON.', ['status' => 400]);
    }

    $validated = daszek_v3_validate_system_health_snapshot_payload($payload);
    if (is_wp_error($validated)) {
        return $validated;
    }

    $snapshot_id = isset($payload['snapshot_id']) ? sanitize_text_field($payload['snapshot_id']) : '';
    $ingested_at = gmdate('c');
    $payload['ingested_at'] = $ingested_at;

    if (!daszek_v3_upsert_system_health_snapshot($payload)) {
        return new WP_Error('storage_error', daszek_v3_storage_error_message(), ['status' => 500]);
    }

    return [
        'ok' => true,
        'snapshot_id' => $snapshot_id,
        'ingested_at' => $ingested_at,
        'storage' => 'system_health_snapshots',
        'warnings' => [],
    ];
}

/* --- P2-14: Identity L3 merge UI --- */
