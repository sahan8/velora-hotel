<?php

header('Content-Type: application/json');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST requests are allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');
$subject = trim($data['subject'] ?? '');
$message = trim($data['message'] ?? '');

if ($name === '' || $subject === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Name, subject and message are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please provide a valid email address']);
    exit;
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
    http_response_code(500);
    echo json_encode(['error' => 'Your message could not be saved']);
}

