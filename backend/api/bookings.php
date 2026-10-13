<?php

require_once dirname(__DIR__) . '/common.php';

function isValidPhone(string $phone): bool
{
    $length = strlen(preg_replace('/\D/', '', $phone));
    return $length >= 7 && $length <= 15;
}

// A retried request (same token) returns the booking it already created.
function sendExistingBookingIfAny(PDO $pdo, string $requestToken): void
{
    $statement = $pdo->prepare("
        SELECT bookings.reference, bookings.total, room_types.name AS room_name
        FROM bookings
        JOIN room_types ON room_types.id = bookings.room_type_id
        WHERE bookings.request_token = :request_token
    ");
    $statement->execute(['request_token' => $requestToken]);
    $booking = $statement->fetch();

    if ($booking) {
        sendJson([
            'success' => true,
            'reference' => $booking['reference'],
            'room' => $booking['room_name'],
            'total' => (float) $booking['total'],
        ]);
    }
}

$data = readJsonPost();

$arrival = (string) ($data['arrival'] ?? '');
$departure = (string) ($data['departure'] ?? '');
$adults = (int) ($data['adults'] ?? 0);
$teens = (int) ($data['teens'] ?? 0);
$children = (int) ($data['children'] ?? 0);
$roomTypeId = (int) ($data['roomTypeId'] ?? 0);
$rateId = (int) ($data['rateId'] ?? 0);
$requestToken = trim((string) ($data['requestToken'] ?? ''));

$guest = is_array($data['guest'] ?? null) ? $data['guest'] : [];
$firstName = trim((string) ($guest['firstName'] ?? ''));
$lastName = trim((string) ($guest['lastName'] ?? ''));
$email = trim((string) ($guest['email'] ?? ''));
$phone = trim((string) ($guest['phone'] ?? ''));
$country = trim((string) ($guest['country'] ?? ''));

$numberOfNights = validateStay($arrival, $departure, $adults, $teens, $children);

if ($roomTypeId < 1 || $rateId < 1) {
    sendError(400, 'A room and rate are required');
}

if (!preg_match('/^[a-zA-Z0-9-]{16,64}$/', $requestToken)) {
    sendError(400, 'A valid booking request token is required');
}

if ($firstName === '' || isTooLong($firstName, 100)) {
    sendError(400, 'First name is required and cannot exceed 100 characters');
}

if ($lastName === '' || isTooLong($lastName, 100)) {
    sendError(400, 'Last name is required and cannot exceed 100 characters');
}

if ($country === '' || isTooLong($country, 100)) {
    sendError(400, 'Country is required and cannot exceed 100 characters');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || isTooLong($email, 255)) {
    sendError(400, 'Please provide a valid email address');
}

if (!isValidPhone($phone) || isTooLong($phone, 30)) {
    sendError(400, 'Phone number must contain between 7 and 15 digits');
}

sendExistingBookingIfAny($pdo, $requestToken);

// Stops one visitor from filling every room with fake bookings.
enforceRateLimit($pdo, 'booking', 5, 3600);

try {
    // Lock the room type row so concurrent bookings for it wait for this
    // transaction; the availability check and inserts then stay consistent.
    $pdo->beginTransaction();

    $statement = $pdo->prepare("
        SELECT
            room_types.name AS room_name,
            room_types.capacity,
            room_types.total_rooms,
            room_types.base_price,
            rates.extra_price
        FROM room_types
        JOIN rates ON rates.room_type_id = room_types.id
        WHERE room_types.id = :room_type_id
          AND rates.id = :rate_id
          AND room_types.status = 'active'
          AND rates.status = 'active'
        FOR UPDATE
    ");
    $statement->execute(['room_type_id' => $roomTypeId, 'rate_id' => $rateId]);
    $room = $statement->fetch();

    if (!$room) {
        $pdo->rollBack();
        sendError(404, 'Room or rate was not found');
    }

    if ($adults + $teens + $children > (int) $room['capacity']) {
        $pdo->rollBack();
        sendError(400, 'The selected room cannot accommodate all guests');
    }

    $statement = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE room_type_id = :room_type_id
          AND booking_status IN ('pending', 'confirmed', 'checked_in')
          AND arrival_date < :departure
          AND departure_date > :arrival
    ");
    $statement->execute([
        'room_type_id' => $roomTypeId,
        'arrival' => $arrival,
        'departure' => $departure,
    ]);

    if ((int) $statement->fetchColumn() >= (int) $room['total_rooms']) {
        $pdo->rollBack();
        sendError(409, 'This room is no longer available');
    }

    // Prices always come from the database, never from the client.
    $nightlyPrice = (float) $room['base_price'] + (float) $room['extra_price'];
    $total = $nightlyPrice * $numberOfNights;
    $reference = 'VEL-' . strtoupper(bin2hex(random_bytes(4)));

    $statement = $pdo->prepare("
        INSERT INTO guests (first_name, last_name, email, phone, country)
        VALUES (:first_name, :last_name, :email, :phone, :country)
    ");
    $statement->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'phone' => $phone,
        'country' => $country,
    ]);
    $guestId = (int) $pdo->lastInsertId();

    // booking_status, payment_status and tax use their column defaults.
    $statement = $pdo->prepare("
        INSERT INTO bookings (
            reference, request_token, guest_id, room_type_id, rate_id,
            arrival_date, departure_date, adults, teens, children,
            number_of_nights, nightly_price, subtotal, total
        )
        VALUES (
            :reference, :request_token, :guest_id, :room_type_id, :rate_id,
            :arrival, :departure, :adults, :teens, :children,
            :number_of_nights, :nightly_price, :subtotal, :total
        )
    ");
    $statement->execute([
        'reference' => $reference,
        'request_token' => $requestToken,
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
        'subtotal' => $total,
        'total' => $total,
    ]);

    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // Duplicate request token: a parallel retry already saved this booking.
    if ($error instanceof PDOException && $error->getCode() === '23000') {
        sendExistingBookingIfAny($pdo, $requestToken);
    }

    error_log('Booking API error: ' . $error->getMessage());
    sendError(500, 'The booking could not be saved');
}

sendJson([
    'success' => true,
    'reference' => $reference,
    'room' => $room['room_name'],
    'total' => $total,
], 201);
