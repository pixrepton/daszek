<?php
declare(strict_types=1);

error_reporting(E_ALL);

if ($argc < 2) {
    fwrite(STDERR, "Usage: php v2-store-harness.php <input-json>\n");
    exit(1);
}

$inputPath = $argv[1];
$inputRaw = @file_get_contents($inputPath);
if ($inputRaw === false) {
    fwrite(STDERR, "Nie udalo sie odczytac pliku wejscia.\n");
    exit(1);
}

$input = json_decode($inputRaw, true);
if (!is_array($input)) {
    fwrite(STDERR, "Wejscie musi byc poprawnym JSON-em.\n");
    exit(1);
}

$storageDir = isset($input['storage_dir']) ? trim((string) $input['storage_dir']) : '';
$tempRoot = $storageDir !== ''
    ? $storageDir
    : sys_get_temp_dir() . '/daszek-v2-harness-' . bin2hex(random_bytes(4));
if (!is_dir($tempRoot) && !mkdir($tempRoot, 0777, true) && !is_dir($tempRoot)) {
    fwrite(STDERR, "Nie udalo sie utworzyc katalogu tymczasowego.\n");
    exit(1);
}

define('ABSPATH', __DIR__ . '/');
define('DASZEK_DATA_DIR', $tempRoot . '/');

class WP_Error {
    public $code;
    public $message;
    public $data;

    public function __construct($code = '', $message = '', $data = null) {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }

    public function get_error_message() {
        return $this->message;
    }
}

function is_wp_error($value) {
    return $value instanceof WP_Error;
}

function sanitize_text_field($value) {
    return trim((string) $value);
}

function sanitize_textarea_field($value) {
    return trim((string) $value);
}

function sanitize_key($value) {
    return preg_replace('/[^a-z0-9_]/', '_', strtolower((string) $value));
}

function current_time($type) {
    if ($type === 'mysql') {
        return gmdate('Y-m-d H:i:s');
    }
    return gmdate('c');
}

function wp_mkdir_p($dir) {
    return is_dir($dir) || mkdir($dir, 0777, true);
}

function daszek_current_user() {
    return 'tester';
}

require_once dirname(__DIR__) . '/includes/store-v2.php';

if (!daszek_v2_bootstrap_storage()) {
    fwrite(STDERR, "Bootstrap storage nie powiodl sie.\n");
    exit(1);
}

$payloads = isset($input['payloads']) && is_array($input['payloads']) ? $input['payloads'] : [];
$feedbackActions = isset($input['feedback_actions']) && is_array($input['feedback_actions']) ? $input['feedback_actions'] : [];
$includeSubtle = array_key_exists('include_subtle', $input) ? !empty($input['include_subtle']) : true;
$persistedResults = [];
$feedbackResults = [];
$lastPayload = null;

foreach ($payloads as $payload) {
    if (!is_array($payload)) {
        continue;
    }
    $lastPayload = $payload;
    $persisted = daszek_v2_persist_projection($payload);
    if (is_wp_error($persisted)) {
        fwrite(STDERR, $persisted->get_error_message() . "\n");
        exit(1);
    }
    $persistedResults[] = $persisted;
}

foreach ($feedbackActions as $feedbackAction) {
    if (!is_array($feedbackAction)) {
        continue;
    }
    $noteId = isset($feedbackAction['note_id']) ? sanitize_text_field($feedbackAction['note_id']) : '';
    $action = isset($feedbackAction['action']) ? sanitize_text_field($feedbackAction['action']) : '';
    $targetCaseId = isset($feedbackAction['target_case_id']) ? sanitize_text_field($feedbackAction['target_case_id']) : '';
    $feedbackResult = daszek_v2_apply_feedback($noteId, $action, $targetCaseId);
    if (is_wp_error($feedbackResult)) {
        fwrite(STDERR, $feedbackResult->get_error_message() . "\n");
        exit(1);
    }
    $feedbackResults[] = $feedbackResult;
}

$caseId = isset($input['case_id']) ? sanitize_text_field($input['case_id']) : '';
$noteId = isset($input['note_id']) ? sanitize_text_field($input['note_id']) : '';
$threadId = isset($input['thread_id']) ? sanitize_text_field($input['thread_id']) : '';

if ($lastPayload && $caseId === '') {
    $casePatch = isset($lastPayload['case_patch']) && is_array($lastPayload['case_patch']) ? $lastPayload['case_patch'] : [];
    $caseId = isset($casePatch['case_id']) ? sanitize_text_field($casePatch['case_id']) : '';
}
if ($lastPayload && $noteId === '') {
    $deskNotePatch = isset($lastPayload['desk_note_patch']) && is_array($lastPayload['desk_note_patch']) ? $lastPayload['desk_note_patch'] : [];
    $noteId = isset($deskNotePatch['desk_note_id']) ? sanitize_text_field($deskNotePatch['desk_note_id']) : '';
}
if ($lastPayload && $threadId === '') {
    $threadMemory = isset($lastPayload['thread_memory']) && is_array($lastPayload['thread_memory']) ? $lastPayload['thread_memory'] : [];
    if (isset($threadMemory['thread_id'])) {
        $threadId = sanitize_text_field($threadMemory['thread_id']);
    } else {
        $signal = isset($lastPayload['signal_projection']) && is_array($lastPayload['signal_projection']) ? $lastPayload['signal_projection'] : [];
        $sourceRef = isset($signal['source_ref']) && is_array($signal['source_ref']) ? $signal['source_ref'] : [];
        $threadId = isset($sourceRef['thread_id']) ? sanitize_text_field($sourceRef['thread_id']) : '';
    }
}

$output = [
    'storage_dir' => $tempRoot,
    'persisted' => $persistedResults,
    'feedback' => $feedbackResults,
    'counts' => [
        'signals' => count(daszek_v2_load_jsonl_store('signals')),
        'decision_traces' => count(daszek_v2_load_jsonl_store('decision_traces')),
        'event_log' => count(daszek_v2_load_jsonl_store('event_log')),
        'cases' => count(daszek_v2_load_map_store('cases')),
        'desk_notes' => count(daszek_v2_load_map_store('desk_notes')),
        'thread_memory' => count(daszek_v2_load_map_store('thread_memory')),
    ],
    'stores' => [
        'signals' => daszek_v2_load_jsonl_store('signals'),
        'decision_traces' => daszek_v2_load_jsonl_store('decision_traces'),
        'event_log' => daszek_v2_load_jsonl_store('event_log'),
        'cases' => daszek_v2_load_map_store('cases'),
        'desk_notes' => daszek_v2_load_map_store('desk_notes'),
        'thread_memory' => daszek_v2_load_map_store('thread_memory'),
    ],
    'desk' => daszek_v2_build_desk_read_model($includeSubtle),
    'day' => daszek_v2_build_day_read_model($includeSubtle),
    'cases_read_model' => daszek_v2_build_cases_read_model(),
    'case_detail' => $caseId !== '' ? daszek_v2_get_case_detail($caseId) : null,
    'note_detail' => $noteId !== '' ? daszek_v2_get_desk_note_detail($noteId) : null,
    'thread_memory_detail' => ($threadId !== '' && isset(daszek_v2_load_map_store('thread_memory')[$threadId]))
        ? daszek_v2_load_map_store('thread_memory')[$threadId]
        : null,
];

echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
