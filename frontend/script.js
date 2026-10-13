
const {
    emptyBooking, loadBooking, saveBooking, byId, all,
    getTodayValue, calculateNights, formatCurrency, formatDate, getRoom,
    getRate, loadCatalogData,
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

async function postJson(url, data) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error);
    }

    return result;
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

        const datesValid = validateDates(arrivalInput, departureInput);
        const guestsValid = validateRequiredField(guestsInput, "Please select the number of guests.");

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

            booking.room = selectedRoom.id;
            booking.rate = null;
            booking.subtotal = 0;
            booking.total = 0;
            booking.currentStep = hasValidBookingSearch() ? 3 : 1;
            saveBooking(booking);
        });
    });
}

function calculateBookingTotal() {
    const selectedRoom = getRoom(booking.room);
    const selectedRate = getRate(booking.room, booking.rate);

    if (!selectedRoom || !selectedRate || booking.nights < 1) {
        booking.subtotal = 0;
        booking.total = 0;
        return;
    }

    booking.subtotal = (selectedRoom.price + selectedRate.extra) * booking.nights;
    booking.total = booking.subtotal;
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
    const searchMessage = byId("bookingSearchMessage");
    const roomMessage = byId("roomSelectionMessage");
    const guestForm = byId("guestDetailsForm");
    const paymentForm = byId("paymentForm");
    const paymentMessage = byId("paymentConfirmation");
    const payButton = byId("payConfirmBtn");
    let availableRoomCodes = null;

    function resetFieldValidation(field, statusElement = null) {
        const reset = () => {
            clearFieldError(field);
            field.classList.remove("is-valid");
            if (statusElement) setStatus(statusElement, "");
            if (field.closest("#paymentForm")) payButton.disabled = false;
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

    // The furthest step the current booking data allows.
    function getAvailableStepLimit() {
        if (!hasValidBookingSearch()) return 1;

        const selectedRoom = getRoom(booking.room);
        if (!selectedRoom || selectedRoom.maxGuests < getTotalGuests()) return 2;
        if (!getRate(booking.room, booking.rate)) return 3;
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

        all(".show-rates-btn").forEach((button) => {
            const room = getRoom(button.dataset.room);
            const exceedsCapacity = !room || room.maxGuests < totalGuests;
            const bookedOut = availableRoomCodes !== null && !availableRoomCodes.has(button.dataset.room);
            const unavailable = exceedsCapacity || bookedOut;

            if (!unavailable) {
                availableRooms += 1;
            }

            button.disabled = unavailable;
            button.textContent = unavailable ? "Not Available" : "Show Rates";
            button.closest(".booking-room-option").classList.toggle("room-unavailable", unavailable);
        });

        if (totalGuests > 0 && availableRooms === 0) {
            setStatus(roomMessage, `No rooms are available for ${totalGuests} guests and the selected dates.`);
        }
    }

    function updateRateStep() {
        const selectedRoom = getRoom(booking.room);

        if (!selectedRoom) {
            return;
        }

        const roomOnlyRate = getRate(selectedRoom.id, "room-only");
        const breakfastRate = getRate(selectedRoom.id, "breakfast");

        byId("rateSelectedRoom").textContent = selectedRoom.name;
        byId("rateSelectedRoomImage").src = selectedRoom.image;
        byId("rateSelectedRoomImage").alt = `Selected ${selectedRoom.name}`;
        byId("rateSelectedDates").textContent = `${formatDate(booking.arrival)} – ${formatDate(booking.departure)} · ${booking.nights} night${booking.nights === 1 ? "" : "s"}`;
        byId("roomOnlyPrice").innerHTML = `${formatCurrency(selectedRoom.price + (roomOnlyRate?.extra || 0))} <small>/ night</small>`;
        byId("breakfastPrice").innerHTML = `${formatCurrency(selectedRoom.price + (breakfastRate?.extra || 0))} <small>/ night</small>`;

        all('input[name="rateType"]').forEach((input) => {
            input.checked = input.value === booking.rate;
        });
    }

    function updateSummary() {
        const selectedRoom = getRoom(booking.room);
        const selectedRate = getRate(booking.room, booking.rate);
        const children = Number(booking.teens) + Number(booking.children);

        calculateBookingTotal();
        byId("summaryRoom").textContent = selectedRoom ? selectedRoom.name : "Not selected";
        byId("summaryArrival").textContent = formatDate(booking.arrival);
        byId("summaryDeparture").textContent = formatDate(booking.departure);
        byId("summaryNights").textContent = booking.nights;
        byId("summaryGuests").textContent = `${booking.adults} adult${Number(booking.adults) === 1 ? "" : "s"} / ${children} children`;
        byId("summaryRate").textContent = selectedRate ? selectedRate.name : "Not selected";
        byId("summarySubtotal").textContent = formatCurrency(booking.subtotal);
        byId("summaryTotal").textContent = formatCurrency(booking.total);
        saveBooking(booking);
    }

    function updatePaymentSummary() {
        const selectedRoom = getRoom(booking.room);
        const selectedRate = getRate(booking.room, booking.rate);
        byId("paymentRoom").textContent = selectedRoom ? selectedRoom.name : "Not selected";
        byId("paymentDates").textContent = `${formatDate(booking.arrival, true)} – ${formatDate(booking.departure, true)}`;
        byId("paymentRate").textContent = selectedRate ? selectedRate.name : "Not selected";
        byId("paymentTotal").textContent = formatCurrency(booking.total);
    }

    async function fetchAvailableRoomCodes() {
        const query = new URLSearchParams({
            arrival: booking.arrival,
            departure: booking.departure,
            adults: booking.adults,
            teens: booking.teens,
            children: booking.children
        });
        const response = await fetch(`../backend/api/availability.php?${query}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        return new Set(result.rooms.map((room) => room.code));
    }

    function isExpiryCurrent(value) {
        const match = value.trim().match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/);

        if (!match) {
            return false;
        }

        const now = new Date();
        const lastDayOfExpiryMonth = new Date(2000 + Number(match[2]), Number(match[1]), 0);
        return lastDayOfExpiryMonth >= new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Restore the saved booking into the page.

    setDateRestrictions(arrivalInput, departureInput);
    arrivalInput.value = booking.arrival;
    departureInput.value = booking.departure;
    adultInput.value = booking.adults;
    teenInput.value = booking.teens;
    childInput.value = booking.children;
    departureInput.min = booking.arrival || getTodayValue();

    if (booking.guest) {
        byId("firstName").value = booking.guest.firstName || "";
        byId("lastName").value = booking.guest.lastName || "";
        byId("guestEmail").value = booking.guest.email || "";
        byId("guestPhone").value = booking.guest.phone || "";
        byId("guestCountry").value = booking.guest.country || "";
    }

    updateSearchSummary();
    updateRoomAvailability();
    updateRateStep();
    updateSummary();
    updatePaymentSummary();
    showStep(Math.min(Number(booking.currentStep) || 1, getAvailableStepLimit()), false);

    [arrivalInput, departureInput, adultInput, teenInput, childInput]
        .forEach((field) => resetFieldValidation(field, searchMessage));
    guestForm.querySelectorAll("input").forEach((field) => resetFieldValidation(field));
    paymentForm.querySelectorAll("input").forEach((field) => resetFieldValidation(field, paymentMessage));

    const expiryInput = byId("cardExpiry");
    expiryInput.addEventListener("input", (event) => {
        const digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
        const isDeleting = event.inputType?.startsWith("delete");

        if (digits.length < 2 || (isDeleting && digits.length === 2)) {
            expiryInput.value = digits;
            return;
        }

        expiryInput.value = `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    });

    // Step 1: search

    byId("bookingSearchForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        setStatus(searchMessage, "");
        setStatus(roomMessage, "");

        const datesValid = validateDates(arrivalInput, departureInput);
        const adults = Number(adultInput.value);

        if (adults < 1) {
            setFieldError(adultInput, "At least one adult is required.");
        } else {
            markFieldValid(adultInput);
        }

        if (!datesValid || adults < 1) {
            setStatus(searchMessage, "Please correct the highlighted search details.");
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
        booking.total = 0;
        booking.guest = null;
        booking.maxStepReached = 2;

        const searchButton = byId("searchRoomsBtn");
        searchButton.disabled = true;
        setStatus(searchMessage, "Checking room availability...", "success");

        try {
            availableRoomCodes = await fetchAvailableRoomCodes();
            setStatus(searchMessage, "");
        } catch (error) {
            setStatus(searchMessage, error.message || "Unable to check room availability.");
            return;
        } finally {
            searchButton.disabled = false;
        }

        const selectedRoom = getRoom(booking.room);

        if (selectedRoom && (selectedRoom.maxGuests < getTotalGuests() || !availableRoomCodes.has(selectedRoom.id))) {
            booking.room = null;
            setStatus(roomMessage, "Your previous room is unavailable. Please choose another room.");
        }

        updateSearchSummary();
        updateRoomAvailability();
        saveBooking(booking);
        showStep(2);
    });

    // Step 2: room

    all(".show-rates-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const selectedRoom = getRoom(button.dataset.room);

            if (!selectedRoom || selectedRoom.maxGuests < getTotalGuests()) {
                setStatus(roomMessage, `This room accommodates a maximum of ${selectedRoom ? selectedRoom.maxGuests : 0} guests.`);
                return;
            }

            setStatus(roomMessage, "");
            booking.room = selectedRoom.id;
            booking.rate = null;
            updateRateStep();
            saveBooking(booking);
            showStep(3);
        });
    });

    // Step 3: rate

    all('input[name="rateType"]').forEach((input) => {
        input.addEventListener("change", () => {
            booking.rate = input.value;
            calculateBookingTotal();
            saveBooking(booking);
            setStatus(byId("rateSelectionMessage"), "");
        });
    });

    byId("continueToSummaryBtn").addEventListener("click", () => {
        const selectedRate = document.querySelector('input[name="rateType"]:checked');

        if (!selectedRate) {
            setStatus(byId("rateSelectionMessage"), "Please select a rate before continuing.");
            return;
        }

        booking.rate = selectedRate.value;
        updateSummary();
        showStep(4);
    });

    // Step 4: summary

    byId("continueToGuestBtn").addEventListener("click", () => showStep(5));

    // Step 5: guest details

    guestForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const fields = {
            firstName: byId("firstName"),
            lastName: byId("lastName"),
            email: byId("guestEmail"),
            phone: byId("guestPhone"),
            country: byId("guestCountry")
        };
        let valid = true;

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

    // Step 6: payment

    paymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setStatus(paymentMessage, "");

        const cardDigits = byId("cardNumber").value.replace(/\D/g, "");
        let valid = true;

        valid = validateRequiredField(byId("cardholderName"), "Please enter the cardholder name.") && valid;
        valid = validateRequiredField(byId("cardNumber"), "Enter a card number between 13 and 19 digits.",
            () => cardDigits.length >= 13 && cardDigits.length <= 19) && valid;
        valid = validateRequiredField(byId("cardExpiry"), "Enter a current expiry date in MM / YY format.", isExpiryCurrent) && valid;
        valid = validateRequiredField(byId("cardCvv"), "Enter a 3 or 4 digit CVV.", (value) => /^\d{3,4}$/.test(value)) && valid;

        if (!valid) {
            return;
        }

        payButton.disabled = true;
        setStatus(paymentMessage, "Confirming your booking...", "success");

        try {
            const selectedRate = getRate(booking.room, booking.rate);

            if (!selectedRate) {
                throw new Error("The selected room rate was not found.");
            }

            // Reused on retries so the server never creates the same booking twice.
            if (!booking.requestToken) {
                booking.requestToken = typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                saveBooking(booking);
            }

            const result = await postJson("../backend/api/bookings.php", {
                requestToken: booking.requestToken,
                arrival: booking.arrival,
                departure: booking.departure,
                adults: Number(booking.adults),
                teens: Number(booking.teens),
                children: Number(booking.children),
                roomTypeId: selectedRate.roomTypeId,
                rateId: selectedRate.id,
                guest: booking.guest
            });

            byId("successGuestName").textContent = `${booking.guest.firstName}.`;
            byId("successBookingReference").textContent = result.reference;
            byId("successRoom").textContent = result.room;
            byId("successDates").textContent = `${formatDate(booking.arrival, true)} – ${formatDate(booking.departure, true)}`;
            byId("successTotal").textContent = formatCurrency(result.total);
            byId("paymentStepHeading").hidden = true;
            byId("paymentStepContent").hidden = true;
            byId("bookingSuccessPanel").hidden = false;

            booking = { ...emptyBooking };
            availableRoomCodes = null;
            saveBooking(booking);
        } catch (error) {
            setStatus(paymentMessage, error.message || "The booking could not be confirmed.");
            payButton.disabled = false;
        }
    });

    // Navigation

    all(".booking-back-btn").forEach((button) => {
        button.addEventListener("click", () => showStep(Number(button.dataset.backStep)));
    });

    byId("startNewBookingBtn").addEventListener("click", () => window.location.reload());

    progressSteps.forEach((progressStep) => {
        progressStep.setAttribute("role", "button");
        progressStep.setAttribute("tabindex", "0");

        const navigateToStep = () => {
            const targetStep = Number(progressStep.dataset.step);
            const furthestAllowedStep = Math.min(Number(booking.maxStepReached) || 1, getAvailableStepLimit());

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
    const form = byId("contactForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const status = byId("contactSuccess");
        const submitButton = form.querySelector('button[type="submit"]');
        const fields = {
            name: byId("contactName"),
            email: byId("contactEmail"),
            phone: byId("contactPhone"),
            subject: byId("contactSubject"),
            message: byId("contactMessage")
        };
        let valid = true;

        clearFormValidation(form);
        setStatus(status, "");

        valid = validateRequiredField(fields.name, "Please enter your name.") && valid;
        valid = validateRequiredField(fields.email, "Please enter a valid email address.", validateEmail) && valid;
        valid = validateRequiredField(fields.phone, "Please enter a valid phone number.", validatePhone) && valid;
        valid = validateRequiredField(fields.subject, "Please enter a subject.") && valid;
        valid = validateRequiredField(fields.message, "Please enter your message.") && valid;

        if (!valid) {
            return;
        }

        submitButton.disabled = true;
        setStatus(status, "Sending your message...", "success");

        try {
            const result = await postJson("../backend/api/contact.php", {
                name: fields.name.value.trim(),
                email: fields.email.value.trim(),
                phone: fields.phone.value.trim(),
                subject: fields.subject.value.trim(),
                message: fields.message.value.trim()
            });

            setStatus(status, result.message, "success");
            form.reset();
            clearFormValidation(form);
        } catch (error) {
            setStatus(status, error.message || "Unable to send your message.");
        } finally {
            submitButton.disabled = false;
        }
    });
}

function initializeGallery() {
    const gallery = byId("hotelGallery");

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
    all('a[href^="#"]:not([href="#"])').forEach((link) => {
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

document.addEventListener("DOMContentLoaded", async () => {
    initializeNavbar();

    try {
        await loadCatalogData();
    } catch (error) {
        console.error(error);
        setStatus(byId("bookingSearchMessage"), "Unable to load rooms and rates. Please try again.");
    }

    initializeQuickSearch();
    initializeBookingSuggestion();
    initializeRoomLinks();
    initializeBookingPage();
    initializeContactForm();
    initializeGallery();
    initializeSmoothLinks();
});
