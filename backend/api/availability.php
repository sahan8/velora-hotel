<?php

header('Content-Type: application/json');

require_once dirname(__DIR__) . '/config/database.php';

function sendError(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function isValidDate(string $value): bool
{
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

$arrival = $_GET['arrival'] ?? '';
$departure = $_GET['departure'] ?? '';
$adults = (int) ($_GET['adults'] ?? 0);
$teens = (int) ($_GET['teens'] ?? 0);
$children = (int) ($_GET['children'] ?? 0);
$guests = $adults + $teens + $children;

if (!isValidDate($arrival) || !isValidDate($departure)) {
    sendError(400, 'Dates must use the YYYY-MM-DD format');
}

$arrivalDate = new DateTime($arrival);
$departureDate = new DateTime($departure);

if ($arrivalDate < new DateTime('today')) {
    sendError(400, 'Arrival cannot be in the past');
}

if ($departureDate <= $arrivalDate) {
    sendError(400, 'Departure must be after arrival');
}

if ((int) $arrivalDate->diff($departureDate)->days > 30) {
    sendError(400, 'A booking cannot exceed 30 nights');
}

if ($adults < 1 || $adults > 5 || $teens < 0 || $teens > 3 || $children < 0 || $children > 3) {
    sendError(400, 'Guest counts are outside the allowed range');
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
