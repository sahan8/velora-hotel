CREATE DATABASE IF NOT EXISTS velora_hotel
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE velora_hotel;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS guests;
DROP TABLE IF EXISTS rates;
DROP TABLE IF EXISTS room_types;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE room_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    capacity TINYINT UNSIGNED NOT NULL,
    total_rooms TINYINT UNSIGNED NOT NULL DEFAULT 1,
    base_price DECIMAL(10, 2) NOT NULL,
    image VARCHAR(255),
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE rates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_type_id INT UNSIGNED NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    extra_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    includes_breakfast BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    CONSTRAINT fk_rates_room_type FOREIGN KEY (room_type_id)
        REFERENCES room_types(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_room_rate UNIQUE (room_type_id, code)
) ENGINE=InnoDB;

CREATE TABLE guests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    country VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guests_email (email)
) ENGINE=InnoDB;

CREATE TABLE contact_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('new', 'read', 'replied') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contact_status (status),
    INDEX idx_contact_email (email)
) ENGINE=InnoDB;

CREATE TABLE bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference VARCHAR(30) NOT NULL UNIQUE,
    request_token VARCHAR(64) NOT NULL UNIQUE,
    guest_id BIGINT UNSIGNED NOT NULL,
    room_type_id INT UNSIGNED NOT NULL,
    rate_id INT UNSIGNED NOT NULL,
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    adults TINYINT UNSIGNED NOT NULL,
    teens TINYINT UNSIGNED NOT NULL DEFAULT 0,
    children TINYINT UNSIGNED NOT NULL DEFAULT 0,
    number_of_nights SMALLINT UNSIGNED NOT NULL,
    nightly_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    booking_status ENUM('pending', 'confirmed', 'checked_in', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    payment_status ENUM('unpaid', 'pending', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'unpaid',
    special_requests TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_guest FOREIGN KEY (guest_id)
        REFERENCES guests(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_room_type FOREIGN KEY (room_type_id)
        REFERENCES room_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_rate FOREIGN KEY (rate_id)
        REFERENCES rates(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_booking_dates (room_type_id, arrival_date, departure_date),
    INDEX idx_booking_status (booking_status)
) ENGINE=InnoDB;

INSERT INTO room_types
    (id, code, name, description, capacity, total_rooms, base_price, image)
VALUES
    (1, 'standard', 'Standard Room', 'A serene space with thoughtful essentials.', 2, 5, 18000.00, 'images/standard-room.jpeg'),
    (2, 'deluxe', 'Deluxe Room', 'Generous comfort and refined details.', 3, 4, 25000.00, 'images/deluxe-room.jpeg'),
    (3, 'family', 'Family Room', 'Flexible space designed for time together.', 5, 3, 32000.00, 'images/family-room.jpeg'),
    (4, 'suite', 'The Suite', 'Signature luxury with a private living area.', 4, 2, 45000.00, 'images/suite-room.jpeg');

INSERT INTO rates
    (room_type_id, code, name, extra_price, includes_breakfast)
VALUES
    (1, 'room-only', 'Room Only', 0.00, FALSE),
    (1, 'breakfast', 'Breakfast Included', 4000.00, TRUE),
    (2, 'room-only', 'Room Only', 0.00, FALSE),
    (2, 'breakfast', 'Breakfast Included', 4000.00, TRUE),
    (3, 'room-only', 'Room Only', 0.00, FALSE),
    (3, 'breakfast', 'Breakfast Included', 4000.00, TRUE),
    (4, 'room-only', 'Room Only', 0.00, FALSE),
    (4, 'breakfast', 'Breakfast Included', 4000.00, TRUE);
