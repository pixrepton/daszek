<?php
/**
 * Daszek REST API v3 route registration (read aliases, snapshots, system views).
 * Handler implementations remain in api-v2.php until full split migration.
 */

if (!defined('ABSPATH')) exit;
function daszek_api_register_v3_routes() {
    $namespace = 'daszek/v3';

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

    register_rest_route($namespace, '/desk-notes/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_note_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/ai-quality', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v2_ai_quality',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cockpit', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_cockpit',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cohort-runs', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_cohort_runs',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cohort-runs', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_cohort_run_ingest',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cohort-runs/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_cohort_run_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/ingress-quality-snapshots/latest', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_ingress_quality_snapshot_latest',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/ingress-quality-snapshots/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_ingress_quality_snapshot_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/ingress-quality-snapshots', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_ingress_quality_snapshots_list',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/ingress-quality-snapshots', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_ingress_quality_snapshot_ingest',
        'permission_callback' => 'daszek_check_ingress_quality_snapshot_write',
    ]);

    register_rest_route($namespace, '/operational-feed-snapshots/latest', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_operational_feed_snapshot_latest',
        'permission_callback' => 'daszek_check_auth',
        'args' => [
            'exceptions_only' => [
                'required' => false,
                'default' => false,
                'sanitize_callback' => 'rest_sanitize_boolean',
            ],
        ],
    ]);

    register_rest_route($namespace, '/operational-feed-snapshots/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_operational_feed_snapshot_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/operational-feed-snapshots', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_operational_feed_snapshots_list',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/operational-feed-snapshots', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_operational_feed_snapshot_ingest',
        'permission_callback' => 'daszek_check_operational_feed_snapshot_write',
    ]);

    register_rest_route($namespace, '/system-health-snapshots/latest', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_health_snapshot_latest',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system-health-snapshots/(?P<id>[a-zA-Z0-9_:-]+)', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_health_snapshot_detail',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system-health-snapshots', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_health_snapshots_list',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system-health-snapshots', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_system_health_snapshot_ingest',
        'permission_callback' => 'daszek_check_system_health_snapshot_write',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/skrzat/ask', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_skrzat_ask',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/engagement', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_case_engagement',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/offers/latest', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_case_latest_offer',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/offers/(?P<offer_id>[^/]+)/conflicts/resolve', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_offer_conflict_resolve',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/engagements/(?P<id>[a-zA-Z0-9_:-]+)/snapshot', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_engagement_snapshot',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/engagements/(?P<id>[a-zA-Z0-9_:-]+)/os-events', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_engagement_os_events',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/os-events/recent', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_os_events_recent',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/health/status', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_health_status',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/bridge-queue/summary', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_bridge_queue_summary',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/decision-queue', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_decision_queue',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/correction-ledger', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_correction_ledger',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/cases/(?P<case_id>[a-zA-Z0-9_:-]+)/business-outcome', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_case_business_outcome',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/constitution', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_constitution',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/briefing', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_briefing',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/cost-summary', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_cost_summary',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/system/quality-summary', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_system_quality_summary',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Merged timeline (3 lanes: case events + os_events + agent turns)
    register_rest_route($namespace, '/engagements/(?P<id>[a-zA-Z0-9_:-]+)/timeline', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_engagement_timeline',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Learning rule candidates (Sugestie z obserwacji)
    register_rest_route($namespace, '/learning/rule-candidates', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_learning_rule_candidates',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/learning/rule-candidates/(?P<id>[a-zA-Z0-9_:-]+)/status', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_learning_rule_candidate_status',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Identity binding suggestions (Sugestie toĹĽsamoĹ›ci â€” C1 L3 UI)
    register_rest_route($namespace, '/identity/binding-suggestions', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_identity_binding_suggestions',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/identity/binding-suggestions/scan', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_identity_binding_suggestions_scan',
        'permission_callback' => 'daszek_check_auth',
    ]);

    register_rest_route($namespace, '/identity/binding-suggestions/(?P<id>[a-zA-Z0-9_:-]+)/status', [
        'methods' => 'POST',
        'callback' => 'daszek_api_v3_identity_binding_suggestion_status',
        'permission_callback' => 'daszek_check_auth',
    ]);

    // Case State Summary (I3.3)
    register_rest_route($namespace, '/cases/(?P<id>[a-zA-Z0-9_:-]+)/state-summary', [
        'methods' => 'GET',
        'callback' => 'daszek_api_v3_case_state_summary',
        'permission_callback' => 'daszek_check_auth',
    ]);
}
