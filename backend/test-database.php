<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

$query = $pdo->query('SELECT DATABASE() AS database_name');
$result = $query->fetch();

echo 'Connected successfully to: ' . htmlspecialchars(
    $result['database_name'],
    ENT_QUOTES,
    'UTF-8'
);