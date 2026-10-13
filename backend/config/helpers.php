<?php

// Shared helpers for the JSON API endpoints.

declare(strict_types=1);

header('Content-Type: application/json');

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

function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendError(405, 'Only POST requests are allowed');
    }
}

function readJsonBody(): array
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
        sendError(400, 'Invalid JSON data');
    }

    return $data;
}

// Strict YYYY-MM-DD check (rejects values like 2026-02-31).
function isValidDate(string $value): bool
{
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function isWithinLength(string $value, int $maximum): bool
{
    return mb_strlen($value) <= $maximum;
}

function isValidPhone(string $phone): bool
{
    $digits = strlen(preg_replace('/\D/', '', $phone));
    return $digits >= 7 && $digits <= 15;
}

// Shared rules for a stay search: valid dates, max 30 nights, guest limits.
// Returns the number of nights.
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
