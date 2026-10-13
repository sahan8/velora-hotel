<?php

// Shared setup and helpers for the JSON API endpoints in backend/api.

// Never show PHP errors to visitors; they go to the server error log instead.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

set_exception_handler(function (Throwable $error): void {
    error_log('API error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
});

require_once __DIR__ . '/config/database.php';

function sendJson(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function sendError(int $status, string $message): never
{
    sendJson(['success' => false, 'error' => $message], $status);
}

function readJsonPost(): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendError(405, 'Only POST requests are allowed');
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
        sendError(400, 'Invalid JSON data');
    }

    return $data;
}

// Limits how often one IP address can perform an action, e.g. 5 bookings per hour.
// ponytail: per-IP only; visitors behind one shared IP share the limit, and an
// attacker with many IPs is slowed, not stopped. Add CAPTCHA if abuse continues.
function enforceRateLimit(PDO $pdo, string $action, int $maxRequests, int $windowSeconds): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    $pdo->exec('DELETE FROM api_requests WHERE created_at < NOW() - INTERVAL 1 DAY');

    $statement = $pdo->prepare('
        SELECT COUNT(*)
        FROM api_requests
        WHERE action = :action
          AND ip_address = :ip
          AND created_at > NOW() - INTERVAL :window SECOND
    ');
    $statement->execute(['action' => $action, 'ip' => $ip, 'window' => $windowSeconds]);

    if ((int) $statement->fetchColumn() >= $maxRequests) {
        sendError(429, 'Too many requests. Please try again later.');
    }

    $pdo->prepare('INSERT INTO api_requests (ip_address, action) VALUES (:ip, :action)')
        ->execute(['ip' => $ip, 'action' => $action]);
}

function isTooLong(string $value, int $maximum): bool
{
    return mb_strlen($value) > $maximum;
}

function isValidDate(string $value): bool
{
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

// Validates the requested stay and returns its number of nights.
function validateStay(string $arrival, string $departure, int $adults, int $teens, int $children): int
{
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

    $nights = (int) $arrivalDate->diff($departureDate)->days;

    if ($nights > 30) {
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

    return $nights;
}
