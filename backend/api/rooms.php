<?php

require_once dirname(__DIR__) . '/common.php';

$rooms = $pdo->query("SELECT * FROM room_types WHERE status = 'active'")->fetchAll();

sendJson($rooms);
