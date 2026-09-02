<?php

header('Content-Type: application/json');

require_once dirname(__DIR__) . '/config/database.php';

function sendError(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function validLength(string $value, int $maximum): bool
{
    return mb_strlen($value) <= $maximum;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST requests are allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    sendError(400, 'Invalid JSON data');
}

$name = trim((string) ($data['name'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$phone = trim((string) ($data['phone'] ?? ''));
$subject = trim((string) ($data['subject'] ?? ''));
$message = trim((string) ($data['message'] ?? ''));

if ($name === '' || !validLength($name, 150)) {
    sendError(400, 'Name is required and cannot exceed 150 characters');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !validLength($email, 255)) {
    sendError(400, 'Please provide a valid email address');
}

$phoneDigits = preg_replace('/\D/', '', $phone);
if ($phone !== '' && (strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15)) {
    sendError(400, 'Phone number must contain between 7 and 15 digits');
}

if ($subject === '' || !validLength($subject, 200)) {
    sendError(400, 'Subject is required and cannot exceed 200 characters');
}

if ($message === '' || !validLength($message, 5000)) {
    sendError(400, 'Message is required and cannot exceed 5000 characters');
}

try {
    $sql = "
        INSERT INTO contact_messages (name, email, phone, subject, message)
        VALUES (:name, :email, :phone, :subject, :message)
    ";

    $statement = $pdo->prepare($sql);
    $statement->execute([
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'subject' => $subject,
        'message' => $message
    ]);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Your message was saved successfully'
    ]);
} catch (Throwable $error) {
    error_log('Contact API error: ' . $error->getMessage());
    sendError(500, 'Your message could not be saved');
}
