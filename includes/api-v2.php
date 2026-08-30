<?php
if (!defined('ABSPATH')) exit;

/**
 * Daszek v2 REST API.
 *
 * Canonical objects live in v2 storage. UI-facing read models and feedback
 * actions are exposed here, while `/tasks` remains a compatibility seam.
 */

function daszek_api_register_v2_routes() {
    $namespace = 'daszek/v2';

    register_rest_route($namespace, '/ingest', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_ingest',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/desk', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_desk',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/day', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_day',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_cases',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_case_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/case-archive', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_case_archive',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/archive', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_case_archive_mutate',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/unarchive', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_case_unarchive',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/desk-notes/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_note_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/desk-notes/(?P<id>[a-zA-Z0-9_:-]+)/feedback', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_note_feedback',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/thread-memory/(?P<id>[^/]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_thread_memory',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/calibration-profile', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_calibration_profile',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/ai-quality', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_ai_quality',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/action-proposals/(?P<id>[a-zA-Z0-9_:-]+)/approve', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_action_proposal_approve',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/action-proposals/(?P<id>[a-zA-Z0-9_:-]+)/reject', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_action_proposal_reject',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-hitl/approve', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_agent_hitl_approve',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/engagements/(?P<id>[a-zA-Z0-9_:-]+)/materialize/approve', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_engagement_materialize_approve',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/engagements/(?P<id>[a-zA-Z0-9_:-]+)/feed-visibility/override', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_engagement_feed_visibility_override',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-hitl/send', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_agent_hitl_send',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Node B bridge: GET accepts optional query params `status` (default pending) and `limit` (max 100).
    // Do not require desk/case shape here â€” those fields belong to ingest/read models, not queue listing.
    register_rest_route($namespace, '/bridge-queue', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_bridge_queue',
        'permission_callback' => 'daszek_check_bridge_token',
    ]);

    register_rest_route($namespace, '/bridge-queue/complete', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_bridge_queue_complete',
        'permission_callback' => 'daszek_check_bridge_token',
    ]);

    // Identity L3 merge UI (P2-14): duplicate email groups from mailbox_memory
    register_rest_route($namespace, '/identity/suggestions', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_identity_suggestions',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/identity/merge', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_identity_merge',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Agent Chat legacy (UI uses v3 proxy; kept for compatibility)
    register_rest_route($namespace, '/agent-chat', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_agent_chat',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Tasks (internal_task proxy to Node B)
    register_rest_route($namespace, '/tasks', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_tasks_list',
        'permission_callback' => 'daszek_check_auth',
    ]);
    register_rest_route($namespace, '/tasks', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_tasks_create',
        'permission_callback' => 'daszek_check_auth',
    ]);
    register_rest_route($namespace, '/tasks/(?P<id>[a-zA-Z0-9_:-]+)/confirm', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_tasks_confirm',
        'permission_callback' => 'daszek_check_auth',
    ]);
    register_rest_route($namespace, '/tasks/(?P<id>[a-zA-Z0-9_:-]+)/reject', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_tasks_reject',
        'permission_callback' => 'daszek_check_auth',
    ]);
    register_rest_route($namespace, '/tasks/(?P<id>[a-zA-Z0-9_:-]+)/done', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v2_tasks_done',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Mailbox case registry (Node B GET /cases â€” full Sprawy list, not WP projection)
    register_rest_route($namespace, '/mailbox-cases', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_mailbox_cases_list',
        'permission_callback' => 'daszek_check_auth',
    ]);
}


function daszek_api_v2_agent_chat(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $body = $request->get_json_params();
    if (!is_array($body) || empty($body['user_input'])) {
        return new WP_Error('invalid_payload', 'Wymagane user_input.', ['status' => 400]);
    }
    $path = '/agent-chat';
    $result = daszek_node_b_get_json($path, 'POST', $body);
    if (is_wp_error($result)) {
        return $result;
    }
    return [
        'ok' => true,
        'signal_id' => $result['signal_id'] ?? '',
        'session_id' => $result['session_id'] ?? '',
        'user_input' => $result['user_input'] ?? '',
        'engagement_id' => $result['engagement_id'] ?? '',
        'case_id' => $result['case_id'] ?? '',
        'agent_ok' => $result['agent_ok'] ?? false,
        'warnings' => $result['warnings'] ?? [],
        'proposals' => $result['proposals'] ?? [],
        'hitl_required' => $result['hitl_required'] ?? false,
    ];
}

// -- Tasks proxy callbacks -----------------------------------------------

function daszek_api_v2_tasks_list(WP_REST_Request $request) {
    $qs = '';
    if ($request->get_param('archive')) $qs = '?archive=true';
    if ($request->get_param('status')) $qs = (strpos($qs,'?')===false?'?':'&').'status='.urlencode($request->get_param('status'));
    $result = daszek_node_b_get_json('/tasks'.$qs, 'GET');
    if (is_wp_error($result)) return $result;
    return $result;
}

function daszek_api_v2_tasks_create(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $body = $request->get_json_params();
    if (!is_array($body) || empty($body['title'])) return new WP_Error('invalid_payload', 'Wymagane title.', ['status' => 400]);
    $result = daszek_node_b_get_json('/tasks', 'POST', $body);
    if (is_wp_error($result)) return $result;
    return $result;
}

function daszek_api_v2_tasks_confirm(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    return daszek_node_b_get_json('/tasks/'.urlencode($request->get_param('id')).'/confirm', 'POST', $request->get_json_params() ?: []);
}

function daszek_api_v2_tasks_reject(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    return daszek_node_b_get_json('/tasks/'.urlencode($request->get_param('id')).'/reject', 'POST', $request->get_json_params() ?: []);
}

function daszek_api_v2_tasks_done(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    return daszek_node_b_get_json('/tasks/'.urlencode($request->get_param('id')).'/done', 'POST', []);
}

function daszek_api_v2_mailbox_cases_list(WP_REST_Request $request) {
    $params = [];
    foreach (['requires_action', 'case_family', 'desk_only', 'view', 'limit'] as $key) {
        $val = $request->get_param($key);
        if ($val !== null && $val !== '') {
            $params[$key] = $val;
        }
    }
    $qs = $params ? ('?'.http_build_query($params)) : '';
    $result = daszek_node_b_get_json('/cases'.$qs, 'GET');
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

function daszek_node_b_get_json($path, $method = 'GET', $body = null) {
    $cfg = daszek_get_config();
    $node_b = isset($cfg['node_b_api']) && is_array($cfg['node_b_api']) ? $cfg['node_b_api'] : [];
    $base_url = isset($node_b['base_url']) ? trim((string) $node_b['base_url']) : '';
    if ($base_url === '') {
        return new WP_Error('node_b_unconfigured', 'Brak konfiguracji DASZEK_NODE_B_API_BASE.', ['status' => 503]);
    }
    $headers = ['Accept' => 'application/json'];
    $token = isset($node_b['api_token']) ? trim((string) $node_b['api_token']) : '';
    if ($token !== '') {
        $headers['Authorization'] = 'Bearer ' . $token;
    }
    $service_token = isset($node_b['service_token']) ? trim((string) $node_b['service_token']) : '';
    if ($service_token === '') {
        $service_token = $token;
    }
    if ($service_token !== '') {
        $headers['X-Node-B-Service-Authorization'] = 'Bearer ' . $service_token;
    }
    $args = [
        'timeout' => isset($node_b['timeout']) ? max(5, (int) $node_b['timeout']) : 20,
        'headers' => $headers,
        'method' => strtoupper((string) $method),
    ];
    if ($body !== null) {
        $headers['Content-Type'] = 'application/json';
        $args['headers'] = $headers;
        $args['body'] = wp_json_encode($body);
    }
    $url = rtrim($base_url, '/') . $path;
    $response = wp_remote_request($url, $args);
    if (is_wp_error($response)) {
        return new WP_Error('node_b_unavailable', $response->get_error_message(), ['status' => 502]);
    }
    $status = (int) wp_remote_retrieve_response_code($response);
    $raw = wp_remote_retrieve_body($response);
    $decoded = json_decode($raw, true);
    if ($status < 200 || $status >= 300) {
        return new WP_Error('node_b_error', 'Node B odrzucil zapytanie.', ['status' => $status ?: 502, 'body' => is_array($decoded) ? $decoded : null]);
    }
    return is_array($decoded) ? $decoded : [];
}


require_once __DIR__ . '/api-v3-handlers.php';

function daszek_api_v2_identity_suggestions(WP_REST_Request $request) {
    $limit = intval($request->get_param('limit') ?: 50);
    if ($limit <= 0) { $limit = 50; }
    $limit = min($limit, 200);
    $result = daszek_node_b_get_json('/identity/suggestions?limit=' . $limit);
    if (is_wp_error($result)) {
        return $result;
    }
    return [
        'ok' => true,
        'items' => isset($result['items']) && is_array($result['items']) ? $result['items'] : [],
        'limit' => $limit,
    ];
}

function daszek_api_v2_identity_merge(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $body = $request->get_json_params();
    if (!is_array($body)) {
        return new WP_Error('invalid_payload', 'Wymagane JSON body.', ['status' => 400]);
    }
    $email = isset($body['email']) ? sanitize_email($body['email']) : '';
    $target_case_id = isset($body['target_case_id']) ? sanitize_text_field($body['target_case_id']) : '';
    $source_case_ids = isset($body['source_case_ids']) && is_array($body['source_case_ids']) ? array_map('sanitize_text_field', $body['source_case_ids']) : [];
    if ($email === '' || $target_case_id === '' || empty($source_case_ids)) {
        return new WP_Error('invalid_payload', 'Wymagane email, target_case_id i source_case_ids.', ['status' => 400]);
    }
    $result = daszek_node_b_get_json('/identity/merge', 'POST', [
        'email' => $email,
        'target_case_id' => $target_case_id,
        'source_case_ids' => $source_case_ids,
    ]);
    if (is_wp_error($result)) {
        return $result;
    }
    return [
        'ok' => true,
        'email' => $email,
        'target_case_id' => $target_case_id,
        'merged_count' => count($source_case_ids),
        'result' => $result,
    ];
}
