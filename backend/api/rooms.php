<?php

header('Content-Type: application/json');

require_once dirname(__DIR__) . '/config/database.php';

$sql = "SELECT * FROM room_types WHERE status = 'active'";

$statement = $pdo->query($sql);

$rooms = $statement->fetchAll();

echo json_encode($rooms);
