<?php

header('Content-Type: application/json');

require_once '../config/database.php';

$arrival = $_GET['arrival'] ?? '';
$departure = $_GET['departure'] ?? '';
$adults = (int) ($_GET['adults'] ?? 0);
$teens = (int) ($_GET['teens'] ?? 0);
$children = (int) ($_GET['children'] ?? 0);
$guests = $adults + $teens + $children;

if ($arrival === '' || $departure === '' || $adults < 1 || $teens < 0 || $children < 0) {
    http_response_code(400);

    echo json_encode([
        'error' => 'Arrival, departure and at least one adult are required'
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

echo json_encode([
    'success' => true,
    'message' => 'Availability checked successfully',
    'search' => [
        'arrival' => $arrival,
        'departure' => $departure,
        'adults' => $adults,
        'teens' => $teens,
        'children' => $children,
        'totalGuests' => $guests
    ],
    'rooms' => $availableRooms
]);
