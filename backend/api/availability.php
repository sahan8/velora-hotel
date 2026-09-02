<?php

header('Content-Type: application/json');

require_once '../config/database.php';

$arrival = $_GET['arrival'] ?? '';
$departure = $_GET['departure'] ?? '';
$guests = (int) ($_GET['guests'] ?? 0);

if ($arrival === '' || $departure === '' || $guests < 1) {
    http_response_code(400);

    echo json_encode([
        'error' => 'Arrival, departure and guests are required'
    ]);

    exit;
}

if ($departure <= $arrival) {
    http_response_code(400);

    echo json_encode([
        'error' => 'Departure must be after arrival'
    ]);

    exit;
}

$sql = "
    SELECT room_types.*
    FROM room_types
    WHERE room_types.status = 'active'
      AND room_types.capacity >= :guests
      AND (
          SELECT COUNT(*)
          FROM bookings
          WHERE bookings.room_type_id = room_types.id
            AND bookings.booking_status IN (
                'pending',
                'confirmed',
                'checked_in'
            )
            AND bookings.arrival_date < :departure
            AND bookings.departure_date > :arrival
      ) < room_types.total_rooms
";

$statement = $pdo->prepare($sql);

$statement->execute([
    'guests' => $guests,
    'arrival' => $arrival,
    'departure' => $departure
]);

$availableRooms = $statement->fetchAll();

echo json_encode($availableRooms);