<?php
if (!defined('ABSPATH')) exit;

/**
 * Obsługa zadań cyklicznych
 */


/**
 * Dodanie zadania z cyklem
 * Generuje n osobnych zadań z przesunięciem dat
 */
function daszek_add_cyclic_task($data, $cycle) {
    $interval = $cycle['interval'] ?? 'yearly';
    $count = intval($cycle['count'] ?? 1);
    
    // Walidacja
    if (!in_array($interval, ['yearly', 'monthly'])) {
        return ['error' => 'Nieprawidłowy interwał'];
    }
    
    if ($count < 2 || $count > 36) {
        return ['error' => 'Liczba wystąpień musi być między 2 a 36'];
    }
    
    $base_due = $data['due_at'];
    $created = [];
    
    // Generuj n zadań
    for ($i = 0; $i < $count; $i++) {
        $task_data = $data;
        $task_data['title'] = $data['title'];
        $task_data['due_at'] = daszek_add_interval($base_due, $interval, $i);
        $task_data['source'] = 'auto';
        $task_data['amount'] = $data['amount'] ?? null;
        
        $task = daszek_add_task($task_data);
        $created[] = $task;
    }
    
    return ['created' => $created, 'count' => count($created)];
}

