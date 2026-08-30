<?php
if (!defined('ABSPATH')) exit;

/**
 * Daszek Agent Chat — WordPress REST proxy to gmail-agent (Node B).
 *
 * Enterprise-grade proxy with:
 * - Circuit breaker (3 failures -> 60s cooldown)
 * - Structured error responses (always JSON)
 * - Connection health check
 * - cURL SSE streaming with error detection
 *
 * Proxy endpoints:
 *   POST /daszek/v3/agent-chat          — sync /agent-chat
 *   POST /daszek/v3/agent-chat/stream   — streaming SSE /agent-chat/stream
 *   POST /daszek/v3/agent-chat/feedback — feedback /agent-chat/feedback
 *   POST /daszek/v3/agent-chat/async      — async /agent-chat/async (202)
 *   GET  /daszek/v3/agent-chat/jobs/{id}  — poll job status
 */

/* ── Circuit breaker state ─────────────────────────────────────────── */
define('DASZEK_CHAT_CB_KEY', 'daszek_chat_circuit_breaker');

/**
 * @return array{open:bool,failures:int,cooldown_until:int}
 */
function daszek_chat_circuit_breaker_state() {
    $default = ['open' => false, 'failures' => 0, 'cooldown_until' => 0];
    $stored = get_transient(DASZEK_CHAT_CB_KEY);
    return is_array($stored) ? array_merge($default, $stored) : $default;
}

function daszek_chat_circuit_breaker_record_failure() {
    $state = daszek_chat_circuit_breaker_state();
    $state['failures'] = ($state['failures'] ?? 0) + 1;
    if ($state['failures'] >= 3) {
        $state['open'] = true;
        $state['cooldown_until'] = time() + 60;
    }
    set_transient(DASZEK_CHAT_CB_KEY, $state, 120);
    return $state;
}

function daszek_chat_circuit_breaker_record_success() {
    set_transient(DASZEK_CHAT_CB_KEY, ['open' => false, 'failures' => 0, 'cooldown_until' => 0], 120);
}

function daszek_chat_is_circuit_open(): bool {
    $state = daszek_chat_circuit_breaker_state();
    if (!$state['open']) return false;
    if (time() >= ($state['cooldown_until'] ?? 0)) {
        // Cooldown expired — half-open
        set_transient(DASZEK_CHAT_CB_KEY, ['open' => false, 'failures' => 0, 'cooldown_until' => 0], 120);
        return false;
    }
    return true;
}

/* ── Route registration ────────────────────────────────────────────── */

function daszek_proxy_agent_chat_register_routes() {
    $namespace = 'daszek/v3';

    register_rest_route($namespace, '/agent-chat', [
        'methods'             => 'POST',
        'callback'            => 'daszek_proxy_agent_chat_sync',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-chat/stream', [
        'methods'             => 'POST',
        'callback'            => 'daszek_proxy_agent_chat_stream',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-chat/feedback', [
        'methods'             => 'POST',
        'callback'            => 'daszek_proxy_agent_chat_feedback',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-chat/health', [
        'methods'             => 'GET',
        'callback'            => 'daszek_proxy_agent_chat_health',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-chat/async', [
        'methods'             => 'POST',
        'callback'            => 'daszek_proxy_agent_chat_async',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/agent-chat/jobs/(?P<job_id>[a-zA-Z0-9_:-]+)', [
        'methods'             => 'GET',
        'callback'            => 'daszek_proxy_agent_chat_job',
        'permission_callback' => 'daszek_check_auth',
    ]);
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * @return array{base_url:string,api_token:string,service_token:string,timeout:int}
 */
function daszek_chat_node_b_config(): array {
    $cfg = daszek_get_config();
    $nb = isset($cfg['node_b_api']) && is_array($cfg['node_b_api']) ? $cfg['node_b_api'] : [];
    $api_token = isset($nb['api_token']) ? trim((string) $nb['api_token']) : '';
    $service_token = isset($nb['service_token']) ? trim((string) $nb['service_token']) : '';
    return [
        'base_url'  => isset($nb['base_url']) ? trim((string) $nb['base_url']) : '',
        'api_token' => $api_token,
        'service_token' => $service_token !== '' ? $service_token : $api_token,
        'timeout'   => isset($nb['timeout']) ? max(30, (int) $nb['timeout']) : 150,
    ];
}

/**
 * Structured JSON error response for the frontend.
 */
function daszek_chat_error(int $status, string $code, string $message): WP_Error {
    return new WP_Error($code, $message, ['status' => $status]);
}

/* ── Sync /agent-chat ───────────────────────────────────────────────── */

function daszek_proxy_agent_chat_sync(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $body = $request->get_json_params();
    if (!is_array($body) || (empty($body['user_input']) && empty($body['brief']))) {
        return daszek_chat_error(400, 'invalid_payload', 'Wymagane user_input lub brief=true.');
    }

    if (daszek_chat_is_circuit_open()) {
        return daszek_chat_error(503, 'circuit_open', 'Agent chwilowo niedostepny. Spróbuj za chwile.');
    }

    $result = daszek_node_b_get_json('/agent-chat', 'POST', $body);
    if (is_wp_error($result)) {
        daszek_chat_circuit_breaker_record_failure();
        return $result;
    }

    daszek_chat_circuit_breaker_record_success();

    return [
        'ok'            => true,
        'signal_id'     => $result['signal_id'] ?? '',
        'session_id'    => $result['session_id'] ?? '',
        'user_input'    => $result['user_input'] ?? '',
        'engagement_id' => $result['engagement_id'] ?? '',
        'case_id'       => $result['case_id'] ?? '',
        'agent_ok'      => $result['agent_ok'] ?? false,
        'warnings'      => $result['warnings'] ?? [],
        'proposals'     => $result['proposals'] ?? [],
        'hitl_required' => $result['hitl_required'] ?? false,
        'agent_turns'   => $result['agent_turns'] ?? 0,
    ];
}

/* ── Streaming SSE /agent-chat/stream ──────────────────────────────── */

function daszek_proxy_agent_chat_stream(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $nb = daszek_chat_node_b_config();
    if ($nb['base_url'] === '') {
        return daszek_chat_error(503, 'node_b_unconfigured', 'Brak konfiguracji DASZEK_NODE_B_API_BASE.');
    }

    $body = $request->get_json_params();
    if (!is_array($body) || (empty($body['user_input']) && empty($body['brief']))) {
        return daszek_chat_error(400, 'invalid_payload', 'Wymagane user_input lub brief=true.');
    }

    if (daszek_chat_is_circuit_open()) {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        echo "event: error\ndata: {\"error\":\"Agent chwilowo niedostepny. Circuit breaker open.\"}\n\n";
        flush();
        exit;
    }

    $url = rtrim($nb['base_url'], '/') . '/agent-chat/stream';
    $token = $nb['api_token'];
    $json_body = wp_json_encode($body);

    $headers = ['Content-Type: application/json', 'Accept: text/event-stream'];
    if ($token !== '') {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    $service_token = $nb['service_token'];
    if ($service_token !== '') {
        $headers[] = 'X-Node-B-Service-Authorization: Bearer ' . $service_token;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $json_body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => $nb['timeout'],
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION  => function ($ch, $data) {
            echo $data;
            flush();
            return connection_aborted() ? 0 : strlen($data);
        },
    ]);

    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    while (ob_get_level()) {
        ob_end_flush();
    }

    $success = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($success === false) {
        daszek_chat_circuit_breaker_record_failure();
        if ($errno === CURLE_OPERATION_TIMEDOUT) {
            echo "event: error\ndata: {\"error\":\"Node B timeout.\"}\n\n";
        } elseif ($errno === CURLE_COULDNT_CONNECT) {
            echo "event: error\ndata: {\"error\":\"Node B unavailable.\"}\n\n";
        } else {
            echo "event: error\ndata: {\"error\":\"Stream error: " . json_encode($error) . "\"}\n\n";
        }
        flush();
    } else {
        daszek_chat_circuit_breaker_record_success();
    }

    exit;
}

/* ── Feedback /agent-chat/feedback ─────────────────────────────────── */

function daszek_proxy_agent_chat_feedback(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $body = $request->get_json_params();
    if (!is_array($body) || empty($body['session_id']) || empty($body['turn_id']) || empty($body['rating'])) {
        return daszek_chat_error(400, 'invalid_payload', 'Wymagane session_id, turn_id, rating.');
    }
    if (!in_array($body['rating'], ['thumbs_up', 'thumbs_down', 'needs_improvement'], true)) {
        return daszek_chat_error(400, 'invalid_rating', 'Rating musi byc: thumbs_up, thumbs_down, lub needs_improvement.');
    }

    $result = daszek_node_b_get_json('/agent-chat/feedback', 'POST', $body);
    if (is_wp_error($result)) {
        return $result;
    }

    return ['ok' => true];
}

/* ── Async /agent-chat/async + poll ─────────────────────────────────── */

function daszek_proxy_agent_chat_async(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }
    $body = $request->get_json_params();
    if (!is_array($body) || empty($body['user_input'])) {
        return daszek_chat_error(400, 'invalid_payload', 'Wymagane user_input.');
    }
    if (daszek_chat_is_circuit_open()) {
        return daszek_chat_error(503, 'circuit_open', 'Agent chwilowo niedostepny.');
    }
    $result = daszek_node_b_get_json('/agent-chat/async', 'POST', $body);
    if (is_wp_error($result)) {
        daszek_chat_circuit_breaker_record_failure();
        return $result;
    }
    daszek_chat_circuit_breaker_record_success();
    return $result;
}

function daszek_proxy_agent_chat_job(WP_REST_Request $request) {
    $job_id = trim((string) $request->get_param('job_id'));
    if ($job_id === '') {
        return daszek_chat_error(400, 'invalid_job_id', 'job_id is required');
    }
    $result = daszek_node_b_get_json('/agent-chat/jobs/' . rawurlencode($job_id), 'GET');
    if (is_wp_error($result)) {
        return $result;
    }
    return $result;
}

/* ── Health check ───────────────────────────────────────────────────── */

function daszek_proxy_agent_chat_health() {
    $state = daszek_chat_circuit_breaker_state();
    $nb = daszek_chat_node_b_config();
    $node_b_ok = false;

    if ($nb['base_url'] !== '') {
        $headers = ['Accept' => 'application/json'];
        if ($nb['api_token'] !== '') {
            $headers['Authorization'] = 'Bearer ' . $nb['api_token'];
        }
        if ($nb['service_token'] !== '') {
            $headers['X-Node-B-Service-Authorization'] = 'Bearer ' . $nb['service_token'];
        }
        $probe = wp_remote_get(rtrim($nb['base_url'], '/') . '/health', [
            'timeout'   => 5,
            'headers'   => $headers,
        ]);
        $node_b_ok = !is_wp_error($probe) && wp_remote_retrieve_response_code($probe) === 200;
    }

    return [
        'ok'               => $node_b_ok && !$state['open'],
        'node_b_ok'        => $node_b_ok,
        'circuit_open'     => $state['open'],
        'failures'         => $state['failures'] ?? 0,
        'cooldown_until'   => $state['cooldown_until'] ?? 0,
        'cooldown_remaining' => max(0, ($state['cooldown_until'] ?? 0) - time()),
    ];
}
