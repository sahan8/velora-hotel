<?php

// Router for PHP's built-in development server:
//     php -S localhost:8000 router.php
// Only the website and the API are served. Everything else (git data, the SQL
// dump, config files) returns 404. On Apache, .htaccess applies the same rules.

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if ($path === '/') {
    header('Location: /frontend/index.html');
    exit;
}

if (str_contains($path, '..') || !preg_match('#^/(frontend/|backend/api/[a-z]+\.php$)#', $path)) {
    http_response_code(404);
    exit;
}

return false;
