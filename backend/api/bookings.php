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

function textLengthIsValid(string $value, int $maximum): bool
{
    return mb_strlen($value) <= $maximum;
}

function isValidPhone(string $phone): bool
{
    $digits = preg_replace('/\D/', '', $phone);
    $length = strlen($digits);
    return $length >= 7 && $length <= 15;
}

function findBookingByToken(PDO $pdo, string $requestToken): array|false
{
    $sql = "
        SELECT
            bookings.reference,
            bookings.number_of_nights,
            bookings.subtotal,
            bookings.total,
            room_types.name AS room_name,
            rates.name AS rate_name
        FROM bookings
        JOIN room_types ON room_types.id = bookings.room_type_id
        JOIN rates ON rates.id = bookings.rate_id
        WHERE bookings.request_token = :request_token
    ";

    $statement = $pdo->prepare($sql);
    $statement->execute(['request_token' => $requestToken]);
    return $statement->fetch();
}

function sendExistingBooking(array $booking): void
{
    echo json_encode([
        'success' => true,
        'duplicate' => true,
        'message' => 'This booking was already created',
        'reference' => $booking['reference'],
        'room' => $booking['room_name'],
        'rate' => $booking['rate_name'],
        'numberOfNights' => (int) $booking['number_of_nights'],
        'subtotal' => (float) $booking['subtotal'],
        'total' => (float) $booking['total']
    ]);
    exit;
}

// Only allow POST requests.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'error' => 'Only POST requests are allowed'
    ]);

    exit;
}

// Read JSON sent by JavaScript.
$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    sendError(400, 'Invalid JSON data');
}

// Booking information.
$arrival = (string) ($data['arrival'] ?? '');
$departure = (string) ($data['departure'] ?? '');

$adults = (int) ($data['adults'] ?? 0);
$teens = (int) ($data['teens'] ?? 0);
$children = (int) ($data['children'] ?? 0);

$roomTypeId = (int) ($data['roomTypeId'] ?? 0);
$rateId = (int) ($data['rateId'] ?? 0);
$requestToken = trim((string) ($data['requestToken'] ?? ''));

$specialRequests = trim((string) ($data['specialRequests'] ?? ''));

// Guest information.
$guest = is_array($data['guest'] ?? null) ? $data['guest'] : [];

$firstName = trim((string) ($guest['firstName'] ?? ''));
$lastName = trim((string) ($guest['lastName'] ?? ''));
$email = trim((string) ($guest['email'] ?? ''));
$phone = trim((string) ($guest['phone'] ?? ''));
$country = trim((string) ($guest['country'] ?? ''));

// Validate booking details.
if (!isValidDate($arrival) || !isValidDate($departure)) {
    sendError(400, 'Dates must use the YYYY-MM-DD format');
}

$today = new DateTime('today');
$arrivalDate = new DateTime($arrival);
$departureDate = new DateTime($departure);

if ($arrivalDate < $today) {
    sendError(400, 'Arrival cannot be in the past');
}

if ($departureDate <= $arrivalDate) {
    sendError(400, 'Departure must be after arrival');
}

$numberOfNights = (int) $arrivalDate->diff($departureDate)->days;

if ($numberOfNights > 30) {
    sendError(400, 'A booking cannot exceed 30 nights');
}

if ($adults < 1 || $adults > 5) {
    sendError(400, 'Adults must be between 1 and 5');
}

if ($teens < 0 || $teens > 3) {
    sendError(400, 'Teen guests must be between 0 and 3');
}

if ($children < 0 || $children > 3) {
    sendError(400, 'Child guests must be between 0 and 3');
}

if ($roomTypeId < 1 || $rateId < 1) {
    sendError(400, 'A room and rate are required');
}

if (!preg_match('/^[a-zA-Z0-9-]{16,64}$/', $requestToken)) {
    sendError(400, 'A valid booking request token is required');
}

if ($firstName === '' || !textLengthIsValid($firstName, 100)) {
    sendError(400, 'First name is required and cannot exceed 100 characters');
}

if ($lastName === '' || !textLengthIsValid($lastName, 100)) {
    sendError(400, 'Last name is required and cannot exceed 100 characters');
}

if ($country === '' || !textLengthIsValid($country, 100)) {
    sendError(400, 'Country is required and cannot exceed 100 characters');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !textLengthIsValid($email, 255)) {
    sendError(400, 'Please provide a valid email address');
}

if (!isValidPhone($phone)) {
    sendError(400, 'Phone number must contain between 7 and 15 digits');
}

if (!textLengthIsValid($specialRequests, 2000)) {
    sendError(400, 'Special requests cannot exceed 2000 characters');
}

$existingBooking = findBookingByToken($pdo, $requestToken);

if ($existingBooking) {
    sendExistingBooking($existingBooking);
}

try {
    /*
     * Start the transaction before checking availability.
     * This keeps the availability check and inserts together.
     */
    $pdo->beginTransaction();

    /*
     * Get and lock the selected room.
     * Other booking requests for this room must wait.
     */
    $roomSql = "
        SELECT
            room_types.name AS room_name,
            room_types.capacity,
            room_types.total_rooms,
            room_types.base_price,
            rates.name AS rate_name,
            rates.extra_price
        FROM room_types
        JOIN rates
            ON rates.room_type_id = room_types.id
        WHERE room_types.id = :room_type_id
          AND rates.id = :rate_id
          AND room_types.status = 'active'
          AND rates.status = 'active'
        FOR UPDATE
    ";

    $statement = $pdo->prepare($roomSql);

    $statement->execute([
        'room_type_id' => $roomTypeId,
        'rate_id' => $rateId
    ]);

    $room = $statement->fetch();

    if (!$room) {
        $pdo->rollBack();

        http_response_code(404);

        echo json_encode([
            'error' => 'Room or rate was not found'
        ]);

        exit;
    }

    // Check room capacity.
    $totalGuests = $adults + $teens + $children;

    if ($totalGuests > (int) $room['capacity']) {
        $pdo->rollBack();

        http_response_code(400);

        echo json_encode([
            'error' =>
                'The selected room cannot accommodate all guests'
        ]);

        exit;
    }

    /*
     * Count bookings that overlap the requested dates.
     *
     * Existing arrival < requested departure
     * Existing departure > requested arrival
     */
    $availabilitySql = "
        SELECT COUNT(*)
        FROM bookings
        WHERE room_type_id = :room_type_id
          AND booking_status IN (
              'pending',
              'confirmed',
              'checked_in'
          )
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
        $pdo->rollBack();

        http_response_code(409);

        echo json_encode([
            'error' => 'This room is no longer available'
        ]);

        exit;
    }

    // Calculate the price using database values.
    $basePrice = (float) $room['base_price'];
    $extraPrice = (float) $room['extra_price'];

    $nightlyPrice = $basePrice + $extraPrice;
    $subtotal = $nightlyPrice * $numberOfNights;
    // Tax is currently not charged.
    $tax = 0;
    $total = $subtotal;

    // Create a unique-looking booking reference.
    $reference =
        'VEL-' . strtoupper(bin2hex(random_bytes(4)));

    // Save the guest.
    $guestSql = "
        INSERT INTO guests (
            first_name,
            last_name,
            email,
            phone,
            country
        )
        VALUES (
            :first_name,
            :last_name,
            :email,
            :phone,
            :country
        )
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

    // Save the booking.
    $bookingSql = "
        INSERT INTO bookings (
            reference,
            request_token,
            guest_id,
            room_type_id,
            rate_id,
            arrival_date,
            departure_date,
            adults,
            teens,
            children,
            number_of_nights,
            nightly_price,
            subtotal,
            tax,
            total,
            booking_status,
            payment_status,
            special_requests
        )
        VALUES (
            :reference,
            :request_token,
            :guest_id,
            :room_type_id,
            :rate_id,
            :arrival,
            :departure,
            :adults,
            :teens,
            :children,
            :number_of_nights,
            :nightly_price,
            :subtotal,
            :tax,
            :total,
            'pending',
            'unpaid',
            :special_requests
        )
    ";

    $statement = $pdo->prepare($bookingSql);

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
        'subtotal' => $subtotal,
        'tax' => $tax,
        'total' => $total,
        'special_requests' => $specialRequests
    ]);

    /*
     * Save all changes and release the room lock.
     */
    $pdo->commit();

    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Booking created successfully',
        'reference' => $reference,
        'room' => $room['room_name'],
        'rate' => $room['rate_name'],
        'numberOfNights' => $numberOfNights,
        'nightlyPrice' => $nightlyPrice,
        'subtotal' => $subtotal,
        'total' => $total
    ]);
} catch (Throwable $error) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($error instanceof PDOException && $error->getCode() === '23000') {
        $existingBooking = findBookingByToken($pdo, $requestToken);

        if ($existingBooking) {
            sendExistingBooking($existingBooking);
        }
    }

    error_log('Booking API error: ' . $error->getMessage());
    sendError(500, 'The booking could not be saved');
}
