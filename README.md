# Velora Hotel

Hotel website with room booking. Plain HTML/CSS/JS frontend (Bootstrap 5, lightGallery) and a PHP + MySQL backend.

## Requirements

- PHP 8+ with the `pdo_mysql` extension
- MySQL or MariaDB

[XAMPP](https://www.apachefriends.org/) includes both.

## Setup

1. **Start MySQL.** In XAMPP, open the Control Panel and click **Start** next to MySQL.

2. **Import the database.** This creates the `velora_hotel` database with its sample rooms and rates:

   ```powershell
   cmd /c "C:\xampp\mysql\bin\mysql.exe -u root -p < database\velora_hotel.sql"
   ```

   You can also import `database/velora_hotel.sql` from phpMyAdmin.

   > Re-importing drops and recreates every table, so existing bookings are lost.

3. **Configure the database connection.** Copy the example config and fill in your MySQL username and password:

   ```powershell
   copy backend\config\database.example.php backend\config\database.local.php
   ```

   A default XAMPP install uses username `root` and an empty password `''`. `database.local.php` is git-ignored and never committed.

4. **Run the site** from the project root:

   ```powershell
   C:\xampp\php\php.exe -S localhost:8000 router.php
   ```

   Then open <http://localhost:8000>. `router.php` serves only the website and API and returns 404 for private files such as `.git` and the SQL dump.

   Always open the site through `localhost`. Opening the HTML files directly (`file://`) breaks the API calls.

## Project structure

```
frontend/          Pages, style.css, script.js, utilities.js, images and hero videos
backend/api/       JSON endpoints
backend/common.php Shared API helpers (JSON responses, validation, rate limiting)
backend/config/    Database connection (database.local.php holds your credentials)
database/          velora_hotel.sql: schema and sample data
router.php         Dev-server router that blocks private files
.htaccess          Apache rules: blocks private files, security headers, HTTPS redirect
```

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `backend/api/rooms.php` | GET | Active room types |
| `backend/api/rates.php` | GET | Rates per room type |
| `backend/api/availability.php?arrival=&departure=&adults=&teens=&children=` | GET | Rooms available for the given dates and guests |
| `backend/api/bookings.php` | POST (JSON) | Create a booking (max 5 per IP per hour) |
| `backend/api/contact.php` | POST (JSON) | Save a contact message (max 5 per IP per hour) |

## Notes

- After changing `style.css`, bump the `?v=` number in the stylesheet links so browsers load the new file.
- The payment form only validates the card format. No payment is processed.

## Deploying

Before putting the site online:

1. **Use Apache with the project root as the web root.** `.htaccess` blocks private files (`.git`, `database/`, `backend/config/`), sets security headers (Content-Security-Policy and others) and redirects to HTTPS. It needs `AllowOverride All` plus `mod_rewrite` and `mod_headers`.
2. **Enable HTTPS** with a certificate, for example from Let's Encrypt.
3. **Use a least-privilege database user** instead of `root`, and put it in `database.local.php`:

   ```sql
   CREATE USER 'velora_app'@'localhost' IDENTIFIED BY 'a-long-random-password';
   GRANT SELECT, INSERT ON velora_hotel.* TO 'velora_app'@'localhost';
   GRANT DELETE ON velora_hotel.api_requests TO 'velora_app'@'localhost';
   ```

4. **Turn off PHP error display** (`display_errors = Off` in `php.ini`). The API already hides its own errors; this covers everything else.
5. **Replace the demo payment form** with a payment provider's hosted checkout (such as Stripe or PayHere) before taking real payments.

If you add a new external script, font or embed, add its domain to the Content-Security-Policy in `.htaccess`, or the browser will block it.
