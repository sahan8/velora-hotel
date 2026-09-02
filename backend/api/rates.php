<?php

header('Content-Type: application/json');

require_once '../config/database.php';

$sql = "
    SELECT
        rates.*,
        room_types.name AS room_name
    FROM rates
    JOIN room_types
        ON rates.room_type_id = room_types.id
    WHERE rates.status = 'active'
";

$statement = $pdo->query($sql);

$rates = $statement->fetchAll();

echo json_encode($rates);