"use strict";

const {
    rooms, rates, emptyBooking, loadBooking, saveBooking, byId, all,
    getTodayValue, calculateNights, formatCurrency, formatDate, getRoom,
    setStatus, clearFieldError, setFieldError, markFieldValid,
    clearFormValidation, validateRequiredField, validateEmail, validatePhone,
    setDateRestrictions, validateDates
} = window.VeloraUtils;

let booking = loadBooking();

function getTotalGuests() {
    return Number(booking.adults) + Number(booking.teens) + Number(booking.children);
}

function hasValidBookingSearch() {
    return booking.arrival >= getTodayValue()
        && calculateNights(booking.arrival, booking.departure) > 0
        && Number(booking.adults) >= 1;
}

// Home and rooms pages

function initializeQuickSearch() {
    const form = byId("quickBookingForm");

    if (!form) {
        return;
    }

    const arrivalInput = byId("quickArrival");
    const departureInput = byId("quickDeparture");
    const guestsInput = byId("quickGuests");
    const message = byId("quickBookingMessage");

    setDateRestrictions(arrivalInput, departureInput);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        setStatus(message, "");
        clearFieldError(guestsInput);

        const datesValid = validateDates(arrivalInput, departureInput);
        let guestsValid = true;

        if (!guestsInput.value) {
            setFieldError(guestsInput, "Please select the number of guests.");
            guestsValid = false;
        } else {
            markFieldValid(guestsInput);
        }

        if (!datesValid || !guestsValid) {
            setStatus(message, "Please correct the highlighted booking details.");
            return;
        }

        booking = {
            ...emptyBooking,
            arrival: arrivalInput.value,
            departure: departureInput.value,
            adults: Number(guestsInput.value),
            nights: calculateNights(arrivalInput.value, departureInput.value),
            currentStep: 2
        };
        saveBooking(booking);
        window.location.href = "booking.html";
    });
}

function initializeBookingSuggestion() {
    const suggestion = byId("bookingSuggestion");
    const closeButton = byId("bookingSuggestionClose");

    if (!suggestion || !closeButton) {
        return;
    }

    const suggestionKey = "veloraHotelBookingSuggestionSeen";

    try {
        if (sessionStorage.getItem(suggestionKey)) {
            return;
        }
    } catch (error) {
        return;
    }

    // Booking popup

    window.setTimeout(() => {
        suggestion.hidden = false;
        suggestion.classList.add("show");
        try {
            sessionStorage.setItem(suggestionKey, "true");
        } catch (error) {
            suggestion.hidden = true;
        }
    }, 1500);

    closeButton.addEventListener("click", () => {
        suggestion.classList.remove("show");
        window.setTimeout(() => {
            suggestion.hidden = true;
        }, 250);
    });
}

function initializeRoomLinks() {
    all(".book-room-link[data-room]").forEach((link) => {
        link.addEventListener("click", () => {
            const selectedRoom = getRoom(link.dataset.room);

            if (!selectedRoom) {
                return;
            }

            const hasValidDates = hasValidBookingSearch();
            booking.room = selectedRoom.id;
            booking.rate = null;
            booking.subtotal = 0;
            booking.tax = 0;
            booking.total = 0;
            booking.currentStep = hasValidDates ? 3 : 1;
            saveBooking(booking);
        });
    });
}

function calculateBookingTotal() {
    const selectedRoom = getRoom(booking.room);
    const selectedRate = rates[booking.rate];

    if (!selectedRoom || !selectedRate || booking.nights < 1) {
        booking.subtotal = 0;
        booking.tax = 0;
        booking.total = 0;
        return;
    }

    const nightlyRate = selectedRoom.price + selectedRate.extra;
    booking.subtotal = nightlyRate * booking.nights;
    booking.tax = Math.round(booking.subtotal * 0.1);
    booking.total = booking.subtotal + booking.tax;
}

// Booking page

function initializeBookingPage() {
    const bookingArea = document.querySelector(".booking-interface");

    if (!bookingArea) {
        return;
    }

    const steps = all(".booking-step");
    const progressSteps = all(".booking-progress-step");
    const arrivalInput = byId("arrivalDate");
    const departureInput = byId("departureDate");
    const adultInput = byId("adultGuests");
    const teenInput = byId("teenGuests");
    const childInput = byId("childGuests");
    const searchForm = byId("bookingSearchForm");

    function resetFieldValidation(field, statusElement = null) {
        if (!field) return;

        const reset = () => {
            clearFieldError(field);
            field.classList.remove("is-valid");
            if (statusElement) setStatus(statusElement, "");
            if (field.closest("#paymentForm")) byId("payConfirmBtn").disabled = false;
        };

        field.addEventListener(field.matches("select, input[type='date']") ? "change" : "input", reset);
    }

    function showStep(stepNumber, shouldScroll = true) {
        const safeStepNumber = Math.min(6, Math.max(1, Number(stepNumber) || 1));

        steps.forEach((step, index) => {
            const isActive = index + 1 === safeStepNumber;
            step.classList.toggle("active", isActive);
            step.hidden = !isActive;
        });

        progressSteps.forEach((step, index) => {
            const number = index + 1;
            step.classList.toggle("active", number === safeStepNumber);
            step.classList.toggle("completed", number < safeStepNumber);
            step.setAttribute("aria-current", number === safeStepNumber ? "step" : "false");
        });

        booking.currentStep = safeStepNumber;
        booking.maxStepReached = Math.max(Number(booking.maxStepReached) || 1, safeStepNumber);
        saveBooking(booking);

        if (shouldScroll) {
            bookingArea.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function hasValidSearch() {
        return hasValidBookingSearch();
    }

    function getSafeStep() {
        let step = Math.min(6, Math.max(1, Number(booking.currentStep) || 1));

        if (!hasValidSearch()) {
            return 1;
        }

        const selectedRoom = getRoom(booking.room);

        if (!selectedRoom || selectedRoom.maxGuests < getTotalGuests()) {
            return Math.min(step, 2);
        }

        if (!rates[booking.rate]) {
            return Math.min(step, 3);
        }

        if (!booking.guest) {
            return Math.min(step, 5);
        }

        return step;
    }

    function getAvailableStepLimit() {
        if (!hasValidSearch()) return 1;

        const selectedRoom = getRoom(booking.room);
        if (!selectedRoom || selectedRoom.maxGuests < getTotalGuests()) return 2;
        if (!rates[booking.rate]) return 3;
        if (!booking.guest) return 5;
        return 6;
    }

    function updateSearchSummary() {
        const totalGuests = getTotalGuests();
        byId("roomSearchArrival").textContent = formatDate(booking.arrival, true);
        byId("roomSearchDeparture").textContent = formatDate(booking.departure, true);
        byId("roomSearchGuests").textContent = `${totalGuests} guest${totalGuests === 1 ? "" : "s"}`;
    }

    function updateRoomAvailability() {
        const totalGuests = getTotalGuests();
        let availableRooms = 0;

        document.querySelectorAll(".show-rates-btn").forEach((button) => {
            const room = getRoom(button.dataset.room);
            const unavailable = !room || room.maxGuests < totalGuests;
            if (!unavailable) availableRooms += 1;
            button.disabled = unavailable;
            button.closest(".booking-room-option").classList.toggle("room-unavailable", unavailable);
            button.textContent = unavailable ? "Not Available" : "Show Rates";
        });

        if (totalGuests > 0 && availableRooms === 0) {
            setStatus(document.getElementById("roomSelectionMessage"), `No single room accommodates ${totalGuests} guests. Please adjust your guest count or contact the hotel.`);
        }
    }

    function updateRateStep() {
        const selectedRoom = getRoom(booking.room);

        if (!selectedRoom) {
            return;
        }

        document.getElementById("rateSelectedRoom").textContent = selectedRoom.name;
        document.getElementById("rateSelectedRoomImage").src = selectedRoom.image;
        document.getElementById("rateSelectedRoomImage").alt = `Selected ${selectedRoom.name}`;
        document.getElementById("rateSelectedDates").textContent = `${formatDate(booking.arrival)} – ${formatDate(booking.departure)} · ${booking.nights} night${booking.nights === 1 ? "" : "s"}`;
        document.getElementById("roomOnlyPrice").innerHTML = `${formatCurrency(selectedRoom.price)} <small>/ night</small>`;
        document.getElementById("breakfastPrice").innerHTML = `${formatCurrency(selectedRoom.price + rates.breakfast.extra)} <small>/ night</small>`;

        document.querySelectorAll('input[name="rateType"]').forEach((input) => {
            input.checked = input.value === booking.rate;
        });
    }

    function updateSummary() {
        const selectedRoom = getRoom(booking.room);
        const selectedRate = rates[booking.rate];
        const children = Number(booking.teens) + Number(booking.children);

        calculateBookingTotal();
        document.getElementById("summaryRoom").textContent = selectedRoom ? selectedRoom.name : "Not selected";
        document.getElementById("summaryArrival").textContent = formatDate(booking.arrival);
        document.getElementById("summaryDeparture").textContent = formatDate(booking.departure);
        document.getElementById("summaryNights").textContent = booking.nights;
        document.getElementById("summaryGuests").textContent = `${booking.adults} adult${Number(booking.adults) === 1 ? "" : "s"} / ${children} children`;
        document.getElementById("summaryRate").textContent = selectedRate ? selectedRate.name : "Not selected";
        document.getElementById("summarySubtotal").textContent = formatCurrency(booking.subtotal);
        document.getElementById("summaryTax").textContent = formatCurrency(booking.tax);
        document.getElementById("summaryTotal").textContent = formatCurrency(booking.total);
        saveBooking(booking);
    }

    function updatePaymentSummary() {
        const selectedRoom = getRoom(booking.room);
        const selectedRate = rates[booking.rate];
        document.getElementById("paymentRoom").textContent = selectedRoom ? selectedRoom.name : "Not selected";
        document.getElementById("paymentDates").textContent = `${formatDate(booking.arrival, true)} – ${formatDate(booking.departure, true)}`;
        document.getElementById("paymentRate").textContent = selectedRate ? selectedRate.name : "Not selected";
        document.getElementById("paymentTotal").textContent = formatCurrency(booking.total);
    }

    setDateRestrictions(arrivalInput, departureInput);
    arrivalInput.value = booking.arrival;
    departureInput.value = booking.departure;
    adultInput.value = booking.adults;
    teenInput.value = booking.teens;
    childInput.value = booking.children;
    departureInput.min = booking.arrival || getTodayValue();

    if (booking.guest) {
        document.getElementById("firstName").value = booking.guest.firstName || "";
        document.getElementById("lastName").value = booking.guest.lastName || "";
        document.getElementById("guestEmail").value = booking.guest.email || "";
        document.getElementById("guestPhone").value = booking.guest.phone || "";
        document.getElementById("guestCountry").value = booking.guest.country || "";
    }

    updateSearchSummary();
    updateRoomAvailability();
    updateRateStep();
    updateSummary();
    updatePaymentSummary();
    showStep(getSafeStep(), false);

    const searchMessage = byId("bookingSearchMessage");
    [arrivalInput, departureInput, adultInput, teenInput, childInput]
        .forEach((field) => resetFieldValidation(field, searchMessage));

    const guestForm = byId("guestDetailsForm");
    guestForm.querySelectorAll("input").forEach((field) => resetFieldValidation(field));

    const paymentForm = byId("paymentForm");
    const paymentMessage = byId("paymentConfirmation");
    paymentForm.querySelectorAll("input").forEach((field) => resetFieldValidation(field, paymentMessage));

    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = document.getElementById("bookingSearchMessage");
        setStatus(message, "");
        setStatus(document.getElementById("roomSelectionMessage"), "");

        const datesValid = validateDates(arrivalInput, departureInput);
        const adults = Number(adultInput.value);

        clearFieldError(adultInput);
        if (adults < 1) {
            setFieldError(adultInput, "At least one adult is required.");
        } else {
            markFieldValid(adultInput);
        }

        if (!datesValid || adults < 1) {
            setStatus(message, "Please correct the highlighted search details.");
            return;
        }

        booking.arrival = arrivalInput.value;
        booking.departure = departureInput.value;
        booking.adults = adults;
        booking.teens = Number(teenInput.value);
        booking.children = Number(childInput.value);
        booking.nights = calculateNights(booking.arrival, booking.departure);
        booking.rate = null;
        booking.subtotal = 0;
        booking.tax = 0;
        booking.total = 0;
        booking.guest = null;
        booking.maxStepReached = 2;

        const selectedRoom = getRoom(booking.room);
        if (selectedRoom && selectedRoom.maxGuests < getTotalGuests()) {
            booking.room = null;
            setStatus(document.getElementById("roomSelectionMessage"), `Your previous room cannot accommodate ${getTotalGuests()} guests. Please choose another room.`);
        }

        updateSearchSummary();
        updateRoomAvailability();
        saveBooking(booking);
        showStep(2);
    });

    document.querySelectorAll(".show-rates-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const selectedRoom = getRoom(button.dataset.room);
            const message = document.getElementById("roomSelectionMessage");

            if (!selectedRoom || selectedRoom.maxGuests < getTotalGuests()) {
                setStatus(message, `This room accommodates a maximum of ${selectedRoom ? selectedRoom.maxGuests : 0} guests.`);
                return;
            }

            setStatus(message, "");
            booking.room = selectedRoom.id;
            booking.rate = null;
            updateRateStep();
            saveBooking(booking);
            showStep(3);
        });
    });

    document.querySelectorAll('input[name="rateType"]').forEach((input) => {
        input.addEventListener("change", () => {
            booking.rate = input.value;
            calculateBookingTotal();
            saveBooking(booking);
            setStatus(document.getElementById("rateSelectionMessage"), "");
        });
    });

    document.getElementById("continueToSummaryBtn").addEventListener("click", () => {
        const selectedRate = document.querySelector('input[name="rateType"]:checked');

        if (!selectedRate) {
            setStatus(document.getElementById("rateSelectionMessage"), "Please select a rate before continuing.");
            return;
        }

        booking.rate = selectedRate.value;
        updateSummary();
        showStep(4);
    });

    document.getElementById("continueToGuestBtn").addEventListener("click", () => showStep(5));

    document.getElementById("guestDetailsForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const fields = {
            firstName: document.getElementById("firstName"),
            lastName: document.getElementById("lastName"),
            email: document.getElementById("guestEmail"),
            phone: document.getElementById("guestPhone"),
            country: document.getElementById("guestCountry")
        };
        let valid = true;

        Object.values(fields).forEach(clearFieldError);

        valid = validateRequiredField(fields.firstName, "Please enter your first name.") && valid;
        valid = validateRequiredField(fields.lastName, "Please enter your last name.") && valid;
        valid = validateRequiredField(fields.email, "Please enter a valid email address.", validateEmail) && valid;
        valid = validateRequiredField(fields.phone, "Please enter a valid phone number.", validatePhone) && valid;
        valid = validateRequiredField(fields.country, "Please enter your country.") && valid;

        if (!valid) {
            return;
        }

        booking.guest = {
            firstName: fields.firstName.value.trim(),
            lastName: fields.lastName.value.trim(),
            email: fields.email.value.trim(),
            phone: fields.phone.value.trim(),
            country: fields.country.value.trim()
        };
        saveBooking(booking);
        updatePaymentSummary();
        showStep(6);
    });

    document.getElementById("paymentForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const cardholder = document.getElementById("cardholderName");
        const cardNumber = document.getElementById("cardNumber");
        const expiry = document.getElementById("cardExpiry");
        const cvv = document.getElementById("cardCvv");
        const confirmation = document.getElementById("paymentConfirmation");
        const payButton = document.getElementById("payConfirmBtn");
        const numericCard = cardNumber.value.replace(/\D/g, "");
        const expiryMatch = expiry.value.trim().match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/);
        const now = new Date();
        const expiryIsCurrent = expiryMatch
            ? new Date(2000 + Number(expiryMatch[2]), Number(expiryMatch[1]), 0) >= new Date(now.getFullYear(), now.getMonth(), 1)
            : false;
        let valid = true;

        [cardholder, cardNumber, expiry, cvv].forEach(clearFieldError);
        setStatus(confirmation, "");

        if (!cardholder.value.trim()) { setFieldError(cardholder, "Please enter the cardholder name."); valid = false; } else { markFieldValid(cardholder); }
        if (numericCard.length < 13 || numericCard.length > 19) { setFieldError(cardNumber, "Enter a card number between 13 and 19 digits."); valid = false; } else { markFieldValid(cardNumber); }
        if (!expiryIsCurrent) { setFieldError(expiry, "Enter a current expiry date in MM / YY format."); valid = false; } else { markFieldValid(expiry); }
        if (!/^\d{3,4}$/.test(cvv.value.trim())) { setFieldError(cvv, "Enter a 3 or 4 digit CVV."); valid = false; } else { markFieldValid(cvv); }

        if (!valid || payButton.disabled) {
            return;
        }

        payButton.disabled = true;
        const reference = `VEL-${Math.floor(100000 + Math.random() * 900000)}`;
        setStatus(confirmation, `Your Velora Hotel booking details were completed successfully. Reference: ${reference}. Payment processing will be connected to the backend later.`, "success");
    });

    document.querySelectorAll(".booking-back-btn").forEach((button) => {
        button.addEventListener("click", () => showStep(Number(button.dataset.backStep)));
    });

    progressSteps.forEach((progressStep) => {
        progressStep.setAttribute("role", "button");
        progressStep.setAttribute("tabindex", "0");

        const navigateToStep = () => {
            const targetStep = Number(progressStep.dataset.step);
            const furthestAllowedStep = Math.min(
                Number(booking.maxStepReached) || 1,
                getAvailableStepLimit()
            );

            if (targetStep <= furthestAllowedStep) {
                showStep(targetStep);
            }
        };

        progressStep.addEventListener("click", navigateToStep);
        progressStep.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigateToStep();
            }
        });
    });
}

// Contact and shared page features

function initializeContactForm() {
    const form = document.getElementById("contactForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = document.getElementById("contactName");
        const email = document.getElementById("contactEmail");
        const phone = document.getElementById("contactPhone");
        const subject = document.getElementById("contactSubject");
        const message = document.getElementById("contactMessage");
        const success = document.getElementById("contactSuccess");
        let valid = true;

        clearFormValidation(form);
        setStatus(success, "");

        valid = validateRequiredField(name, "Please enter your name.") && valid;
        valid = validateRequiredField(email, "Please enter a valid email address.", validateEmail) && valid;
        valid = validateRequiredField(phone, "Please enter a valid phone number.", validatePhone) && valid;
        valid = validateRequiredField(subject, "Please enter a subject.") && valid;
        valid = validateRequiredField(message, "Please enter your message.") && valid;

        if (valid) {
            setStatus(success, "Thank you. Your message is ready to be sent.", "success");
        }
    });
}

function initializeGallery() {
    const gallery = document.getElementById("hotelGallery");

    if (!gallery || typeof lightGallery === "undefined") {
        return;
    }

    const plugins = [];
    if (typeof lgZoom !== "undefined") plugins.push(lgZoom);
    if (typeof lgThumbnail !== "undefined") plugins.push(lgThumbnail);

    lightGallery(gallery, {
        selector: ".gallery-item",
        plugins,
        licenseKey: "0000-0000-000-0000",
        speed: 400,
        download: false,
        mobileSettings: {
            controls: true,
            showCloseIcon: true,
            download: false
        }
    });
}

function initializeSmoothLinks() {
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));

            if (target) {
                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
}

function initializeNavbar() {
    const navbar = document.querySelector(".navbar");

    if (!navbar) {
        return;
    }

    const updateNavbar = () => {
        navbar.classList.toggle("navbar-scrolled", window.scrollY > 70);
    };

    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeNavbar();
    initializeQuickSearch();
    initializeBookingSuggestion();
    initializeRoomLinks();
    initializeBookingPage();
    initializeContactForm();
    initializeGallery();
    initializeSmoothLinks();
});
