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
   C:\xampp\php\php.exe -S localhost:8000
   ```

   Then open <http://localhost:8000/frontend/index.html>.

   Always open the site through `localhost`. Opening the HTML files directly (`file://`) breaks the API calls.

## Project structure

```
frontend/          Pages, style.css, script.js, utilities.js, images and hero videos
backend/api/       JSON endpoints
backend/common.php Shared API helpers (JSON responses, validation)
backend/config/    Database connection (database.local.php holds your credentials)
database/          velora_hotel.sql: schema and sample data
```

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `backend/api/rooms.php` | GET | Active room types |
| `backend/api/rates.php` | GET | Rates per room type |
| `backend/api/availability.php?arrival=&departure=&adults=&teens=&children=` | GET | Rooms available for the given dates and guests |
| `backend/api/bookings.php` | POST (JSON) | Create a booking |
| `backend/api/contact.php` | POST (JSON) | Save a contact message |

## Notes

- After changing `style.css`, bump the `?v=` number in the stylesheet links so browsers load the new file.
- The payment form only validates the card format. No payment is processed.
