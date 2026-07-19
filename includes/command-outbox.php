<?php
if (!defined('ABSPATH')) exit;

/**
 * WP DB command outbox — durable bridge queue with claim/lease semantics.
 */

function daszek_command_outbox_table_name() {
    global $wpdb;
    return $wpdb->prefix . 'daszek_command_outbox';
}

function daszek_command_outbox_install_schema() {
    global $wpdb;
    $table = daszek_command_outbox_table_name();
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE {$table} (
        command_id VARCHAR(64) NOT NULL,
        queue_id VARCHAR(64) NOT NULL,
        schema_version VARCHAR(64) NOT NULL DEFAULT 'daszek_bridge_queue.v1',
        domain VARCHAR(64) NOT NULL DEFAULT '',
        payload_json LONGTEXT NOT NULL,
        request_hash VARCHAR(128) NOT NULL DEFAULT '',
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        lease_token VARCHAR(64) NOT NULL DEFAULT '',
        lease_expires_at DATETIME NULL,
        attempts INT NOT NULL DEFAULT 0,
        bridge_error TEXT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        PRIMARY KEY (command_id),
        UNIQUE KEY queue_id (queue_id),
        KEY status_lease (status, lease_expires_at),
        KEY created_at (created_at)
    ) {$charset};";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
}

function daszek_command_outbox_request_hash($payload) {
    $json = wp_json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return hash('sha256', is_string($json) ? $json : '');
}

function daszek_command_outbox_enqueue(array $row) {
    global $wpdb;
    daszek_command_outbox_install_schema();
    $table = daszek_command_outbox_table_name();
    $queue_id = isset($row['queue_id']) ? sanitize_text_field((string) $row['queue_id']) : '';
    if ($queue_id === '') {
        return false;
    }
    $command_id = isset($row['command_id']) ? sanitize_text_field((string) $row['command_id']) : $queue_id;
    $payload_json = wp_json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $now = current_time('mysql', true);
    $existing = $wpdb->get_row(
        $wpdb->prepare("SELECT command_id, status FROM {$table} WHERE queue_id = %s", $queue_id),
        ARRAY_A
    );
    if (is_array($existing) && !empty($existing['command_id'])) {
        return true;
    }
    $inserted = $wpdb->insert(
        $table,
        [
            'command_id' => $command_id,
            'queue_id' => $queue_id,
            'schema_version' => sanitize_text_field((string) ($row['schema_version'] ?? 'daszek_bridge_queue.v1')),
            'domain' => sanitize_text_field((string) ($row['domain'] ?? '')),
            'payload_json' => $payload_json,
            'request_hash' => daszek_command_outbox_request_hash($row),
            'status' => 'pending',
            'created_at' => $now,
            'updated_at' => $now,
        ],
        ['%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']
    );
    return $inserted !== false;
}

function daszek_command_outbox_claim_batch($limit = 25, $claimer = 'node_b', $lease_seconds = 120) {
    global $wpdb;
    daszek_command_outbox_install_schema();
    $table = daszek_command_outbox_table_name();
    $limit = max(1, min(100, (int) $limit));
    $lease_seconds = max(30, min(600, (int) $lease_seconds));
    $now = current_time('mysql', true);
    $lease_token = 'lease_' . substr(hash('sha256', $claimer . '|' . microtime(true)), 0, 24);
    $lease_expires = gmdate('Y-m-d H:i:s', time() + $lease_seconds);

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT command_id, queue_id, payload_json, status, lease_token, lease_expires_at, attempts
             FROM {$table}
             WHERE status IN ('pending', 'retry')
                OR (status = 'leased' AND lease_expires_at IS NOT NULL AND lease_expires_at < %s)
             ORDER BY created_at ASC
             LIMIT %d",
            $now,
            $limit
        ),
        ARRAY_A
    );
    $claimed = [];
    foreach ((array) $rows as $row) {
        $command_id = sanitize_text_field((string) ($row['command_id'] ?? ''));
        if ($command_id === '') {
            continue;
        }
        $updated = $wpdb->update(
            $table,
            [
                'status' => 'leased',
                'lease_token' => $lease_token,
                'lease_expires_at' => $lease_expires,
                'attempts' => ((int) ($row['attempts'] ?? 0)) + 1,
                'updated_at' => $now,
            ],
            [
                'command_id' => $command_id,
                'status' => sanitize_text_field((string) ($row['status'] ?? 'pending')),
            ],
            ['%s', '%s', '%s', '%d', '%s'],
            ['%s', '%s']
        );
        if ($updated === false || $updated === 0) {
            // Reclaim expired lease rows
            $updated = $wpdb->query(
                $wpdb->prepare(
                    "UPDATE {$table}
                     SET status = 'leased', lease_token = %s, lease_expires_at = %s,
                         attempts = attempts + 1, updated_at = %s
                     WHERE command_id = %s
                       AND status = 'leased'
                       AND lease_expires_at IS NOT NULL
                       AND lease_expires_at < %s",
                    $lease_token,
                    $lease_expires,
                    $now,
                    $command_id,
                    $now
                )
            );
        }
        if ($updated) {
            $payload = json_decode((string) ($row['payload_json'] ?? ''), true);
            if (!is_array($payload)) {
                $payload = [];
            }
            $payload['command_id'] = $command_id;
            $payload['lease_token'] = $lease_token;
            $payload['bridge_status'] = 'leased';
            $claimed[] = $payload;
        }
    }
    return $claimed;
}

function daszek_command_outbox_complete($queue_id, $status, $lease_token = '', $bridge_error = '') {
    global $wpdb;
    $table = daszek_command_outbox_table_name();
    $queue_id = sanitize_text_field((string) $queue_id);
    $status = strtolower(sanitize_text_field((string) $status));
    if (!in_array($status, ['completed', 'failed', 'skipped', 'dead_letter', 'retry'], true)) {
        return new WP_Error('invalid_status', 'Nieprawidlowy status bridge.', ['status' => 400]);
    }
    $row = $wpdb->get_row(
        $wpdb->prepare("SELECT command_id, status, lease_token, request_hash FROM {$table} WHERE queue_id = %s", $queue_id),
        ARRAY_A
    );
    if (!is_array($row) || empty($row['command_id'])) {
        return new WP_Error('not_found', 'Nieznany queue_id.', ['status' => 404]);
    }
    $terminal = in_array($row['status'], ['completed', 'failed', 'skipped', 'dead_letter'], true);
    if ($terminal) {
        return [
            'ok' => true,
            'idempotent' => true,
            'queue_id' => $queue_id,
            'status' => $row['status'],
        ];
    }
    $expected_lease = sanitize_text_field((string) ($row['lease_token'] ?? ''));
    $provided_lease = sanitize_text_field((string) $lease_token);
    if ($expected_lease !== '' && $provided_lease !== '' && $expected_lease !== $provided_lease) {
        return new WP_Error('lease_conflict', 'Zly lease token.', ['status' => 409]);
    }
    $now = current_time('mysql', true);
    $wpdb->update(
        $table,
        [
            'status' => $status,
            'bridge_error' => sanitize_textarea_field((string) $bridge_error),
            'completed_at' => in_array($status, ['completed', 'failed', 'skipped', 'dead_letter'], true) ? $now : null,
            'lease_token' => '',
            'lease_expires_at' => null,
            'updated_at' => $now,
        ],
        ['queue_id' => $queue_id],
        ['%s', '%s', '%s', '%s', '%s', '%s'],
        ['%s']
    );
    return [
        'ok' => true,
        'queue_id' => $queue_id,
        'status' => $status,
        'idempotent' => false,
    ];
}

function daszek_command_outbox_pending_rows($limit = 100) {
    return daszek_command_outbox_claim_batch(0) ?: [];
}

function daszek_command_outbox_summary() {
    global $wpdb;
    $table = daszek_command_outbox_table_name();
    if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) !== $table) {
        return [
            'pending' => 0,
            'leased' => 0,
            'retry' => 0,
            'failed' => 0,
            'completed' => 0,
            'dead_letter' => 0,
            'storage' => 'wp_db_outbox',
        ];
    }
    $rows = $wpdb->get_results(
        "SELECT status, COUNT(*) AS cnt FROM {$table} GROUP BY status",
        ARRAY_A
    );
    $summary = [
        'pending' => 0,
        'leased' => 0,
        'retry' => 0,
        'failed' => 0,
        'completed' => 0,
        'dead_letter' => 0,
        'storage' => 'wp_db_outbox',
    ];
    foreach ((array) $rows as $row) {
        $key = strtolower(sanitize_text_field((string) ($row['status'] ?? '')));
        if (array_key_exists($key, $summary)) {
            $summary[$key] = (int) ($row['cnt'] ?? 0);
        }
    }
    return $summary;
}

function daszek_command_outbox_migrate_jsonl_once() {
    if (!function_exists('daszek_v2_load_jsonl_store')) {
        return ['migrated' => 0, 'skipped' => true];
    }
    $flag = get_option('daszek_command_outbox_jsonl_migrated', '');
    if ($flag === '1') {
        return ['migrated' => 0, 'skipped' => true, 'reason' => 'already_migrated'];
    }
    $rows = daszek_v2_load_jsonl_store('bridge_queue');
    $migrated = 0;
    foreach ((array) $rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $status = strtolower(sanitize_text_field((string) ($row['bridge_status'] ?? 'pending')));
        if (in_array($status, ['completed', 'failed', 'skipped'], true)) {
            continue;
        }
        if (daszek_command_outbox_enqueue($row)) {
            $migrated++;
        }
    }
    update_option('daszek_command_outbox_jsonl_migrated', '1', false);
    return ['migrated' => $migrated, 'skipped' => false];
}
