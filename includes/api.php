<?php
if (!defined('ABSPATH')) exit;

/**
 * REST API endpoints.
 */

function daszek_api_register_routes() {
    $namespace = 'daszek/v1';

    register_rest_route($namespace, '/login', [
        'methods' => 'POST',
        'callback' => 'daszek_api_login',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/logout', [
        'methods' => 'POST',
        'callback' => 'daszek_api_logout',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/csrf', [
        'methods' => 'GET',
        'callback' => 'daszek_api_csrf',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/tasks', [
        'methods' => 'GET',
        'callback' => 'daszek_api_get_tasks',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/tasks', [
        'methods' => 'POST',
        'callback' => 'daszek_api_create_task',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/tasks/(?P<id>[a-z0-9_]+)', [
        'methods' => 'PATCH',
        'callback' => 'daszek_api_update_task',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/tasks/(?P<id>[a-z0-9_]+)/done', [
        'methods' => 'POST',
        'callback' => 'daszek_api_mark_done',
        'permission_callback' => 'daszek_check_auth',
    ]);
}

function daszek_api_login(WP_REST_Request $request) {
    $login = $request->get_param('login');
    $password = $request->get_param('password');

    if (!$login || !$password) {
        return new WP_Error('invalid_credentials', 'Brak loginu lub hasla', ['status' => 400]);
    }

    if (daszek_login($login, $password)) {
        return [
            'ok' => true,
            'user' => $login,
            'csrf_token' => daszek_generate_csrf_token(),
        ];
    }

    return new WP_Error('invalid_credentials', 'Nieprawidlowy login lub haslo', ['status' => 401]);
}

function daszek_api_logout(WP_REST_Request $request) {
    daszek_logout();
    return ['ok' => true];
}

function daszek_api_csrf(WP_REST_Request $request) {
    return [
        'csrf_token' => daszek_generate_csrf_token(),
    ];
}

function daszek_api_get_tasks(WP_REST_Request $request) {
    if (function_exists('daszek_v2_get_compatibility_tasks')) {
        return daszek_v2_get_compatibility_tasks();
    }
    return daszek_get_all_tasks();
}

function daszek_api_create_task(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }

    $payload = daszek_request_payload($request);
    $title = isset($payload['title']) && is_string($payload['title']) ? trim($payload['title']) : '';
    $due_at = $payload['due_at'] ?? null;
    $cycle = isset($payload['cycle']) && is_array($payload['cycle']) ? $payload['cycle'] : null;

    if ($title === '') {
        return new WP_Error('invalid_data', 'Brak wymaganego pola title', ['status' => 400]);
    }

    $boundary_check = daszek_validate_legacy_task_write_payload($payload);
    if (is_wp_error($boundary_check)) {
        return $boundary_check;
    }

    $payload_check = daszek_validate_task_payload($payload, false);
    if (is_wp_error($payload_check)) {
        return $payload_check;
    }

    if ($cycle) {
        if (!$due_at || !daszek_validate_date($due_at, true)) {
            return new WP_Error('invalid_date', 'Zadanie cykliczne wymaga poprawnej daty due_at', ['status' => 400]);
        }

        $result = daszek_add_cyclic_task($payload, $cycle);
        if (isset($result['error'])) {
            return new WP_Error('cycle_error', $result['error'], ['status' => 400]);
        }

        return [
            'ok' => true,
            'created' => $result['count'],
            'tasks' => $result['created'],
        ];
    }

    $task = daszek_add_task($payload);
    if (is_array($task) && isset($task['error'])) {
        return new WP_Error('storage_error', $task['error'], ['status' => 500]);
    }

    return [
        'ok' => true,
        'created' => 1,
        'task' => $task,
    ];
}

function daszek_api_update_task(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }

    $id = $request->get_param('id');
    $payload = daszek_request_payload($request);
    $legacy_task = daszek_get_task($id);

    if ($legacy_task && daszek_is_intake_owned_legacy_task($legacy_task)) {
        return new WP_Error('legacy_boundary', 'Legacy /tasks nie mutuje rekordow nalezacych do Gmail Intake. Uzyj warstwy v2.', ['status' => 409]);
    }

    $boundary_check = daszek_validate_legacy_task_write_payload($payload);
    if (is_wp_error($boundary_check)) {
        return $boundary_check;
    }

    $payload_check = daszek_validate_task_payload($payload, true);
    if (is_wp_error($payload_check)) {
        return $payload_check;
    }

    $task = daszek_update_task($id, $payload);
    if (is_array($task) && isset($task['error'])) {
        return new WP_Error('storage_error', $task['error'], ['status' => 500]);
    }
    if (!$task && function_exists('daszek_v2_update_compatibility_task')) {
        $task = daszek_v2_update_compatibility_task($id, $payload);
    }
    if (is_wp_error($task)) {
        return $task;
    }
    if (!$task) {
        return new WP_Error('not_found', 'Zadanie nie znalezione', ['status' => 404]);
    }

    return [
        'ok' => true,
        'task' => $task,
    ];
}

function daszek_api_mark_done(WP_REST_Request $request) {
    $csrf_check = daszek_check_csrf($request);
    if (is_wp_error($csrf_check)) {
        return $csrf_check;
    }

    $id = $request->get_param('id');
    $legacy_task = daszek_get_task($id);
    if ($legacy_task && daszek_is_intake_owned_legacy_task($legacy_task)) {
        return new WP_Error('legacy_boundary', 'Legacy /tasks nie zamyka rekordow nalezacych do Gmail Intake. Uzyj warstwy v2.', ['status' => 409]);
    }

    $task = daszek_mark_done($id);
    if (is_array($task) && isset($task['error'])) {
        return new WP_Error('storage_error', $task['error'], ['status' => 500]);
    }
    if (!$task && function_exists('daszek_v2_mark_compatibility_task_done')) {
        $task = daszek_v2_mark_compatibility_task_done($id);
    }
    if (is_wp_error($task)) {
        return $task;
    }

    if (!$task) {
        return new WP_Error('not_found', 'Zadanie nie znalezione', ['status' => 404]);
    }

    return [
        'ok' => true,
        'task' => $task,
    ];
}

function daszek_request_payload(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (is_array($payload)) {
        return $payload;
    }

    $params = $request->get_params();
    return is_array($params) ? $params : [];
}

function daszek_validate_task_payload($payload, $is_update = false) {
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Payload musi byc obiektem JSON', ['status' => 400]);
    }

    if (!$is_update || array_key_exists('title', $payload)) {
        if (isset($payload['title']) && !is_string($payload['title'])) {
            return new WP_Error('invalid_title', 'Pole title musi byc stringiem', ['status' => 400]);
        }

        $title = isset($payload['title']) ? trim($payload['title']) : '';
        if ($title === '') {
            return new WP_Error('invalid_title', 'Pole title nie moze byc puste', ['status' => 400]);
        }
    }

    if (array_key_exists('due_at', $payload) && !daszek_validate_date($payload['due_at'], true)) {
        return new WP_Error('invalid_date', 'Nieprawidlowa data', ['status' => 400]);
    }

    if (array_key_exists('amount', $payload) && $payload['amount'] !== null && $payload['amount'] !== '' && !is_numeric($payload['amount'])) {
        return new WP_Error('invalid_amount', 'Pole amount musi byc liczba lub null', ['status' => 400]);
    }

    $enum_checks = [
        'status' => ['open', 'done'],
        'source' => ['manual', 'mail', 'auto', 'gmail_intake'],
        'kind' => ['task', 'review', 'reference', 'watchlist', 'case', 'case_update'],
        'priority' => ['critical', 'high', 'medium', 'low'],
    ];

    foreach ($enum_checks as $field => $allowed) {
        if (!array_key_exists($field, $payload) || $payload[$field] === null || $payload[$field] === '') {
            continue;
        }

        if (!is_string($payload[$field]) || !in_array($payload[$field], $allowed, true)) {
            return new WP_Error(
                'invalid_' . $field,
                sprintf('Pole %s ma nieobslugiwana wartosc', $field),
                ['status' => 400]
            );
        }
    }

    if (array_key_exists('note', $payload) && $payload['note'] !== null && !is_string($payload['note'])) {
        return new WP_Error('invalid_note', 'Pole note musi byc stringiem lub null', ['status' => 400]);
    }

    if (array_key_exists('tags', $payload) && !is_string($payload['tags']) && !is_array($payload['tags']) && $payload['tags'] !== null) {
        return new WP_Error('invalid_tags', 'Pole tags musi byc stringiem, tablica lub null', ['status' => 400]);
    }

    $external_ref_check = daszek_validate_external_ref_payload($payload['external_ref'] ?? null);
    if (is_wp_error($external_ref_check)) {
        return $external_ref_check;
    }

    $intake_check = daszek_validate_intake_payload($payload['intake'] ?? null);
    if (is_wp_error($intake_check)) {
        return $intake_check;
    }

    if (isset($payload['cycle']) && $payload['cycle'] !== null) {
        if (!is_array($payload['cycle'])) {
            return new WP_Error('invalid_cycle', 'Pole cycle musi byc obiektem', ['status' => 400]);
        }

        $interval = $payload['cycle']['interval'] ?? null;
        $count = $payload['cycle']['count'] ?? null;
        if (!in_array($interval, ['monthly', 'yearly'], true)) {
            return new WP_Error('invalid_cycle', 'Cycle interval musi byc monthly lub yearly', ['status' => 400]);
        }
        if (!is_numeric($count) || intval($count) < 2 || intval($count) > 36) {
            return new WP_Error('invalid_cycle', 'Cycle count musi byc liczba od 2 do 36', ['status' => 400]);
        }
    }

    return true;
}

function daszek_validate_legacy_task_write_payload($payload) {
    if (!is_array($payload)) {
        return true;
    }

    if (isset($payload['source']) && is_string($payload['source']) && sanitize_text_field($payload['source']) === 'gmail_intake') {
        return new WP_Error('legacy_boundary', 'Legacy /tasks nie przyjmuje source=gmail_intake. Uzyj warstwy v2.', ['status' => 409]);
    }

    if (isset($payload['intake']) && is_array($payload['intake']) && !empty($payload['intake'])) {
        return new WP_Error('legacy_boundary', 'Legacy /tasks nie przyjmuje pola intake. Uzyj warstwy v2.', ['status' => 409]);
    }

    return true;
}

function daszek_is_intake_owned_legacy_task($task) {
    if (!is_array($task)) {
        return false;
    }

    $source = isset($task['source']) && is_string($task['source']) ? sanitize_text_field($task['source']) : '';
    if ($source === 'gmail_intake') {
        return true;
    }

    $intake = isset($task['intake']) && is_array($task['intake']) ? $task['intake'] : [];
    return !empty($intake);
}

function daszek_validate_external_ref_payload($external_ref) {
    if ($external_ref === null) {
        return true;
    }

    if (!is_array($external_ref)) {
        return new WP_Error('invalid_external_ref', 'Pole external_ref musi byc obiektem lub null', ['status' => 400]);
    }

    $allowed = ['channel', 'mailbox', 'message_id', 'thread_id', 'case_key', 'received_at'];
    foreach ($external_ref as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            return new WP_Error('invalid_external_ref', 'external_ref zawiera nieobslugiwane pole', ['status' => 400]);
        }
        if ($value !== null && !is_string($value)) {
            return new WP_Error('invalid_external_ref', 'Wartosci external_ref musza byc stringami lub null', ['status' => 400]);
        }
    }

    return true;
}

function daszek_validate_intake_payload($intake) {
    if ($intake === null) {
        return true;
    }

    if (!is_array($intake)) {
        return new WP_Error('invalid_intake', 'Pole intake musi byc obiektem lub null', ['status' => 400]);
    }

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
        if (isset($intake[$field]) && $intake[$field] !== null && !is_string($intake[$field])) {
            return new WP_Error('invalid_intake', sprintf('Pole intake.%s musi byc stringiem', $field), ['status' => 400]);
        }
    }

    if (isset($intake['review_required']) && !is_bool($intake['review_required']) && !in_array($intake['review_required'], [0, 1, '0', '1'], true)) {
        return new WP_Error('invalid_intake', 'Pole intake.review_required musi byc boolean', ['status' => 400]);
    }

    if (isset($intake['review_flags']) && !is_array($intake['review_flags']) && !is_string($intake['review_flags'])) {
        return new WP_Error('invalid_intake', 'Pole intake.review_flags musi byc tablica lub stringiem', ['status' => 400]);
    }

    if (isset($intake['confidence'])) {
        if (!is_array($intake['confidence'])) {
            return new WP_Error('invalid_intake', 'Pole intake.confidence musi byc obiektem', ['status' => 400]);
        }

        foreach (['signal_confidence', 'case_link_confidence', 'decision_confidence', 'extraction_confidence'] as $field) {
            if (!isset($intake['confidence'][$field])) {
                continue;
            }
            if (!is_numeric($intake['confidence'][$field])) {
                return new WP_Error('invalid_intake', sprintf('Pole intake.confidence.%s musi byc liczba', $field), ['status' => 400]);
            }
            $value = floatval($intake['confidence'][$field]);
            if ($value < 0 || $value > 1) {
                return new WP_Error('invalid_intake', sprintf('Pole intake.confidence.%s musi byc w zakresie 0..1', $field), ['status' => 400]);
            }
        }
    }

    if (isset($intake['state_change'])) {
        if (!is_array($intake['state_change'])) {
            return new WP_Error('invalid_intake', 'Pole intake.state_change musi byc obiektem', ['status' => 400]);
        }

        if (isset($intake['state_change']['detected']) && !is_bool($intake['state_change']['detected']) && !in_array($intake['state_change']['detected'], [0, 1, '0', '1'], true)) {
            return new WP_Error('invalid_intake', 'Pole intake.state_change.detected musi byc boolean', ['status' => 400]);
        }

        foreach (['from_state', 'to_state'] as $field) {
            if (isset($intake['state_change'][$field]) && $intake['state_change'][$field] !== null && !is_string($intake['state_change'][$field])) {
                return new WP_Error('invalid_intake', sprintf('Pole intake.state_change.%s musi byc stringiem', $field), ['status' => 400]);
            }
        }
    }

    if (isset($intake['extracted_data']) && !is_array($intake['extracted_data'])) {
        return new WP_Error('invalid_intake', 'Pole intake.extracted_data musi byc obiektem', ['status' => 400]);
    }

    return true;
}
