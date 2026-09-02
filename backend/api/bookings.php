<?php

header('Content-Type: application/json');

require_once '../config/database.php';

// This endpoint only accepts POST requests.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST requests are allowed']);
    exit;
}

// Read JSON sent by JavaScript.
$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

$arrival = $data['arrival'] ?? '';
$departure = $data['departure'] ?? '';
$adults = (int) ($data['adults'] ?? 0);
$teens = (int) ($data['teens'] ?? 0);
$children = (int) ($data['children'] ?? 0);
$roomTypeId = (int) ($data['roomTypeId'] ?? 0);
$rateId = (int) ($data['rateId'] ?? 0);
$guest = $data['guest'] ?? [];
$specialRequests = trim($data['specialRequests'] ?? '');

$firstName = trim($guest['firstName'] ?? '');
$lastName = trim($guest['lastName'] ?? '');
$email = trim($guest['email'] ?? '');
$phone = trim($guest['phone'] ?? '');
$country = trim($guest['country'] ?? '');

// Basic validation.
if ($arrival === '' || $departure === '' || $adults < 1) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid dates and at least one adult are required']);
    exit;
}

if ($departure <= $arrival || $arrival < date('Y-m-d')) {
    http_response_code(400);
    echo json_encode(['error' => 'Please provide valid booking dates']);
    exit;
}

if ($roomTypeId < 1 || $rateId < 1) {
    http_response_code(400);
    echo json_encode(['error' => 'A room and rate are required']);
    exit;
}

if ($firstName === '' || $lastName === '' || $phone === '' || $country === '') {
    http_response_code(400);
    echo json_encode(['error' => 'All guest details are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please provide a valid email address']);
    exit;
}

try {
    // Get the selected room and selected rate from the database.
    $sql = "
        SELECT
            room_types.name AS room_name,
            room_types.capacity,
            room_types.total_rooms,
            room_types.base_price,
            rates.name AS rate_name,
            rates.extra_price
        FROM room_types
        JOIN rates ON rates.room_type_id = room_types.id
        WHERE room_types.id = :room_type_id
          AND rates.id = :rate_id
          AND room_types.status = 'active'
          AND rates.status = 'active'
    ";

    $statement = $pdo->prepare($sql);
    $statement->execute([
        'room_type_id' => $roomTypeId,
        'rate_id' => $rateId
    ]);

    $room = $statement->fetch();

    if (!$room) {
        http_response_code(404);
        echo json_encode(['error' => 'Room or rate was not found']);
        exit;
    }

    $totalGuests = $adults + $teens + $children;

    if ($totalGuests > (int) $room['capacity']) {
        http_response_code(400);
        echo json_encode(['error' => 'The selected room cannot accommodate all guests']);
        exit;
    }

    // Check how many rooms are already booked for dates
    $availabilitySql = "
        SELECT COUNT(*)
        FROM bookings
        WHERE room_type_id = :room_type_id
          AND booking_status IN ('pending', 'confirmed', 'checked_in')
          AND arrival_date < :departure
          AND departure_date > :arrival
    ";

    $statement = $pdo->prepare($availabilitySql);
    $statement->execute([
        'room_type_id' => $roomTypeId,
        'arrival' => $arrival,
        'departure' => $departure
    ]);

    $bookedRooms = (int) $statement->fetchColumn();

    if ($bookedRooms >= (int) $room['total_rooms']) {
        http_response_code(409);
        echo json_encode(['error' => 'This room is no longer available']);
        exit;
    }

    // Calculate the booking price on the server.
    $arrivalDate = new DateTime($arrival);
    $departureDate = new DateTime($departure);
    $numberOfNights = (int) $arrivalDate->diff($departureDate)->days;
    $nightlyPrice = (float) $room['base_price'] + (float) $room['extra_price'];
    $subtotal = $nightlyPrice * $numberOfNights;
    $tax = round($subtotal * 0.10, 2);
    $total = $subtotal + $tax;
    $reference = 'VEL-' . strtoupper(bin2hex(random_bytes(4)));

    // Save the guest and booking together.
    $pdo->beginTransaction();

    $guestSql = "
        INSERT INTO guests (first_name, last_name, email, phone, country)
        VALUES (:first_name, :last_name, :email, :phone, :country)
    ";

    $statement = $pdo->prepare($guestSql);
    $statement->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'phone' => $phone,
        'country' => $country
    ]);

    $guestId = (int) $pdo->lastInsertId();

    $bookingSql = "
        INSERT INTO bookings (
            reference, guest_id, room_type_id, rate_id,
            arrival_date, departure_date, adults, teens, children,
            number_of_nights, nightly_price, subtotal, tax, total,
            booking_status, payment_status, special_requests
        ) VALUES (
            :reference, :guest_id, :room_type_id, :rate_id,
            :arrival, :departure, :adults, :teens, :children,
            :number_of_nights, :nightly_price, :subtotal, :tax, :total,
            'pending', 'unpaid', :special_requests
        )
    ";

    $statement = $pdo->prepare($bookingSql);
    $statement->execute([
        'reference' => $reference,
        'guest_id' => $guestId,
        'room_type_id' => $roomTypeId,
        'rate_id' => $rateId,
        'arrival' => $arrival,
        'departure' => $departure,
        'adults' => $adults,
        'teens' => $teens,
        'children' => $children,
        'number_of_nights' => $numberOfNights,
        'nightly_price' => $nightlyPrice,
        'subtotal' => $subtotal,
        'tax' => $tax,
        'total' => $total,
        'special_requests' => $specialRequests
    ]);

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'reference' => $reference,
        'room' => $room['room_name'],
        'rate' => $room['rate_name'],
        'numberOfNights' => $numberOfNights,
        'subtotal' => $subtotal,
        'tax' => $tax,
        'total' => $total
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['error' => 'The booking could not be saved']);
}

