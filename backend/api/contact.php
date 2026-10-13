<?php

require_once dirname(__DIR__) . '/common.php';

$data = readJsonPost();

$name = trim((string) ($data['name'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$phone = trim((string) ($data['phone'] ?? ''));
$subject = trim((string) ($data['subject'] ?? ''));
$message = trim((string) ($data['message'] ?? ''));

if ($name === '' || isTooLong($name, 150)) {
    sendError(400, 'Name is required and cannot exceed 150 characters');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || isTooLong($email, 255)) {
    sendError(400, 'Please provide a valid email address');
}

$phoneDigits = strlen(preg_replace('/\D/', '', $phone));
if ($phone !== '' && ($phoneDigits < 7 || $phoneDigits > 15 || isTooLong($phone, 30))) {
    sendError(400, 'Phone number must contain between 7 and 15 digits');
}

if ($subject === '' || isTooLong($subject, 200)) {
    sendError(400, 'Subject is required and cannot exceed 200 characters');
}

if ($message === '' || isTooLong($message, 5000)) {
    sendError(400, 'Message is required and cannot exceed 5000 characters');
}

enforceRateLimit($pdo, 'contact', 5, 3600);

try {
    $statement = $pdo->prepare("
        INSERT INTO contact_messages (name, email, phone, subject, message)
        VALUES (:name, :email, :phone, :subject, :message)
    ");
    $statement->execute([
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'subject' => $subject,
        'message' => $message,
    ]);
} catch (Throwable $error) {
    error_log('Contact API error: ' . $error->getMessage());
    sendError(500, 'Your message could not be saved');
}

sendJson(['success' => true, 'message' => 'Your message was saved successfully'], 201);
