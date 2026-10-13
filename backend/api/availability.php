<?php

require_once dirname(__DIR__) . '/common.php';

$arrival = (string) ($_GET['arrival'] ?? '');
$departure = (string) ($_GET['departure'] ?? '');
$adults = (int) ($_GET['adults'] ?? 0);
$teens = (int) ($_GET['teens'] ?? 0);
$children = (int) ($_GET['children'] ?? 0);

validateStay($arrival, $departure, $adults, $teens, $children);

// A room type is available while its overlapping active bookings
// are fewer than its total number of rooms.
$sql = "
    SELECT room_types.*
    FROM room_types
    WHERE room_types.status = 'active'
      AND room_types.capacity >= :guests
      AND (
          SELECT COUNT(*)
          FROM bookings
          WHERE bookings.room_type_id = room_types.id
            AND bookings.booking_status IN ('pending', 'confirmed', 'checked_in')
            AND bookings.arrival_date < :departure
            AND bookings.departure_date > :arrival
      ) < room_types.total_rooms
";

$statement = $pdo->prepare($sql);
$statement->execute([
    'guests' => $adults + $teens + $children,
    'arrival' => $arrival,
    'departure' => $departure,
]);

sendJson(['success' => true, 'rooms' => $statement->fetchAll()]);
