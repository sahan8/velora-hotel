<?php

declare(strict_types=1);

$configFile = __DIR__ . '/database.local.php';

if (!is_file($configFile)) {
    http_response_code(500);
    exit('Database configuration is missing.');
}

$config = require $configFile;

$host = $config['host'];
$port = $config['port'];
$database = $config['database'];
$username = $config['username'];
$password = $config['password'];

$dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $username, $password, $options);
} catch (PDOException $exception) {
    http_response_code(500);

    exit('Database connection failed.');
}
