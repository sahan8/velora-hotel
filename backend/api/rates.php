<?php

require_once dirname(__DIR__) . '/common.php';

$sql = "
    SELECT
        rates.*,
        room_types.code AS room_code,
        room_types.name AS room_name
    FROM rates
    JOIN room_types ON rates.room_type_id = room_types.id
    WHERE rates.status = 'active'
      AND room_types.status = 'active'
";

sendJson($pdo->query($sql)->fetchAll());
