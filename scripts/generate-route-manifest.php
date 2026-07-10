<?php
/**
 * P2-20: Dump registered Daszek REST routes into docs/ROUTE_MANIFEST.json
 * Usage: php daszek/scripts/generate-route-manifest.php
 */

$root = dirname(__DIR__);
$includes = glob($root . '/includes/*.php') ?: [];
$routes = [];

function daszek_manifest_namespace_for_file(string $basename): string {
    if ($basename === 'api-v2.php') {
        return 'daszek/v2';
    }
    if ($basename === 'api-v3.php' || $basename === 'api-v3-handlers.php' || $basename === 'proxy-agent-chat.php') {
        return 'daszek/v3';
    }
    return 'daszek/includes';
}

foreach ($includes as $file) {
    $content = (string) file_get_contents($file);
    $basename = basename($file);
    if (!preg_match_all(
        "/register_rest_route\s*\(\s*\\\$namespace\s*,\s*'([^']+)'\s*,\s*\[([\s\S]*?)\]\s*\)/u",
        $content,
        $matches,
        PREG_SET_ORDER
    )) {
        continue;
    }
    foreach ($matches as $match) {
        $path = $match[1];
        $block = $match[2];
        $methods = 'GET';
        if (preg_match("/'methods'\s*=>\s*'([^']+)'/u", $block, $m)) {
            $methods = strtoupper($m[1]);
        } elseif (preg_match("/'methods'\s*=>\s*\[([^\]]+)\]/u", $block, $m)) {
            $methods = strtoupper(preg_replace("/['\"\s,]/", '', $m[1]));
        }
        $callback = '';
        if (preg_match("/'callback'\s*=>\s*'([^']+)'/u", $block, $m)) {
            $callback = $m[1];
        }
        $routes[] = [
            'source_file' => $basename,
            'namespace' => daszek_manifest_namespace_for_file($basename),
            'path' => $path,
            'methods' => $methods,
            'callback' => $callback,
        ];
    }
}

// v1 routes in api.php use literal namespace
$apiPhp = $root . '/includes/api.php';
if (is_readable($apiPhp)) {
    $content = (string) file_get_contents($apiPhp);
    if (preg_match_all(
        "/register_rest_route\s*\(\s*'daszek\/v1'\s*,\s*'([^']+)'\s*,\s*\[([\s\S]*?)\]\s*\)/u",
        $content,
        $matches,
        PREG_SET_ORDER
    )) {
        foreach ($matches as $match) {
            $block = $match[2];
            $methods = 'GET';
            if (preg_match("/'methods'\s*=>\s*'([^']+)'/u", $block, $m)) {
                $methods = strtoupper($m[1]);
            }
            $callback = '';
            if (preg_match("/'callback'\s*=>\s*'([^']+)'/u", $block, $m)) {
                $callback = $m[1];
            }
            $routes[] = [
                'source_file' => 'api.php',
                'namespace' => 'daszek/v1',
                'path' => $match[1],
                'methods' => $methods,
                'callback' => $callback,
            ];
        }
    }
}

usort($routes, static function (array $a, array $b): int {
    return [$a['namespace'], $a['path'], $a['methods']] <=> [$b['namespace'], $b['path'], $b['methods']];
});

$docsDir = $root . '/docs';
if (!is_dir($docsDir)) {
    mkdir($docsDir, 0755, true);
}

$manifest = [
    'generated_at' => gmdate('c'),
    'route_count' => count($routes),
    'routes' => $routes,
];

$out = $docsDir . '/ROUTE_MANIFEST.json';
file_put_contents($out, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
fwrite(STDOUT, "Wrote {$out} (" . count($routes) . " routes)\n");
