(() => {
"use strict";

const BOOKING_STORAGE_KEY = "veloraHotelBooking";

const rooms = [];
const rates = [];

const emptyBooking = {
    arrival: "",
    departure: "",
    adults: 1,
    teens: 0,
    children: 0,
    room: null,
    rate: null,
    nights: 0,
    subtotal: 0,
    total: 0,
    guest: null,
    requestToken: null,
    currentStep: 1,
    maxStepReached: 1
};

function loadBooking() {
    try {
        const savedBooking = JSON.parse(sessionStorage.getItem(BOOKING_STORAGE_KEY));
        return savedBooking ? { ...emptyBooking, ...savedBooking } : { ...emptyBooking };
    } catch (error) {
        return { ...emptyBooking };
    }
}

function saveBooking(booking) {
    try {
        sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(booking));
        return true;
    } catch (error) {
        // The booking flow must still work when the page is opened directly
        // from the file system or browser storage is disabled.
        return false;
    }
}

function byId(id) {
    return document.getElementById(id);
}

function all(selector) {
    return document.querySelectorAll(selector);
}

function getTodayValue() {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().split("T")[0];
}

function parseDate(dateValue) {
    return dateValue ? new Date(`${dateValue}T00:00:00`) : null;
}

function calculateNights(arrival, departure) {
    const arrivalDate = parseDate(arrival);
    const departureDate = parseDate(departure);

    if (!arrivalDate || !departureDate) {
        return 0;
    }

    const difference = departureDate.getTime() - arrivalDate.getTime();
    return Math.max(0, Math.round(difference / 86400000));
}

function formatCurrency(amount) {
    return `LKR ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(amount)}`;
}

function formatDate(dateValue, short = false) {
    const date = parseDate(dateValue);

    if (!date) {
        return "Not selected";
    }

    return new Intl.DateTimeFormat("en-LK", {
        day: "numeric",
        month: short ? "short" : "long",
        year: "numeric"
    }).format(date);
}

function getRoom(roomId) {
    return rooms.find((room) => room.id === roomId) || null;
}

function getRate(roomCode, rateCode) {
    return rates.find((rate) => {
        return rate.roomCode === roomCode && rate.code === rateCode;
    }) || null;
}

async function loadCatalogData() {
    const [roomsResponse, ratesResponse] = await Promise.all([
        fetch("../backend/api/rooms.php"),
        fetch("../backend/api/rates.php")
    ]);

    if (!roomsResponse.ok || !ratesResponse.ok) {
        throw new Error("Unable to load rooms and rates.");
    }

    const roomRows = await roomsResponse.json();
    const rateRows = await ratesResponse.json();

    rooms.splice(0, rooms.length, ...roomRows.map((room) => ({
        id: room.code,
        databaseId: Number(room.id),
        name: room.name,
        description: room.description,
        price: Number(room.base_price),
        maxGuests: Number(room.capacity),
        totalRooms: Number(room.total_rooms),
        image: room.image
    })));

    rates.splice(0, rates.length, ...rateRows.map((rate) => ({
        id: Number(rate.id),
        roomTypeId: Number(rate.room_type_id),
        roomCode: rate.room_code,
        code: rate.code,
        name: rate.name,
        extra: Number(rate.extra_price),
        includesBreakfast: Boolean(Number(rate.includes_breakfast))
    })));
}

function setStatus(element, message, type = "error") {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.toggle("form-status-success", type === "success");
    element.classList.toggle("form-status-error", type === "error" && Boolean(message));
}

function clearFieldError(field) {
    if (!field) {
        return;
    }

    field.classList.remove("is-invalid");
    const feedback = field.parentElement.querySelector(".invalid-feedback");

    if (feedback) {
        feedback.remove();
    }
}

function setFieldError(field, message) {
    clearFieldError(field);
    field.classList.add("is-invalid");

    const feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    feedback.textContent = message;
    field.insertAdjacentElement("afterend", feedback);
}

function markFieldValid(field) {
    clearFieldError(field);
    field.classList.add("is-valid");
}

function clearFormValidation(form) {
    if (!form) {
        return;
    }

    form.querySelectorAll(".is-invalid, .is-valid").forEach((field) => {
        field.classList.remove("is-invalid", "is-valid");
    });
    form.querySelectorAll(".invalid-feedback").forEach((feedback) => feedback.remove());
}

function validateRequiredField(field, message, validator = (value) => Boolean(value)) {
    const value = field.value.trim();

    if (!validator(value)) {
        setFieldError(field, message);
        return false;
    }

    markFieldValid(field);
    return true;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    return phone.replace(/\D/g, "").length >= 7;
}

function setDateRestrictions(arrivalInput, departureInput) {
    if (!arrivalInput || !departureInput) {
        return;
    }

    const today = getTodayValue();
    arrivalInput.min = today;
    departureInput.min = arrivalInput.value || today;

    arrivalInput.addEventListener("change", () => {
        departureInput.min = arrivalInput.value || today;

        if (departureInput.value && departureInput.value <= arrivalInput.value) {
            departureInput.value = "";
        }
    });
}

function validateDates(arrivalInput, departureInput) {
    let valid = true;
    const today = getTodayValue();

    clearFieldError(arrivalInput);
    clearFieldError(departureInput);

    if (!arrivalInput.value) {
        setFieldError(arrivalInput, "Please select your arrival date.");
        valid = false;
    } else if (arrivalInput.value < today) {
        setFieldError(arrivalInput, "Arrival cannot be in the past.");
        valid = false;
    } else {
        markFieldValid(arrivalInput);
    }

    if (!departureInput.value) {
        setFieldError(departureInput, "Please select your departure date.");
        valid = false;
    } else if (arrivalInput.value && departureInput.value <= arrivalInput.value) {
        setFieldError(departureInput, "Departure must be after arrival.");
        valid = false;
    } else {
        markFieldValid(departureInput);
    }

    return valid;
}

window.VeloraUtils = {
    emptyBooking,
    loadBooking,
    saveBooking,
    byId,
    all,
    getTodayValue,
    calculateNights,
    formatCurrency,
    formatDate,
    getRoom,
    getRate,
    loadCatalogData,
    setStatus,
    clearFieldError,
    setFieldError,
    markFieldValid,
    clearFormValidation,
    validateRequiredField,
    validateEmail,
    validatePhone,
    setDateRestrictions,
    validateDates
};

})();
