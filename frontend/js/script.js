"use strict";

/*
    Collect all buttons that contain data-page.

    Example:
    data-page="signin"
*/
const navigationButtons = document.querySelectorAll("[data-page]");

/*
    Collect all three pages:
    landingPage, signinPage and signupPage.
*/
const pages = document.querySelectorAll(".page");

/*
    Shows the selected page and hides the others.
*/
function showPage(pageName) {
    pages.forEach(function (page) {
        page.classList.remove("active");
    });

    const selectedPage = document.getElementById(pageName + "Page");

    if (selectedPage) {
        selectedPage.classList.add("active");
    }

    clearMessages();
}

/*
    Give every navigation button a click event.
*/
navigationButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const targetPage = button.dataset.page;
        showPage(targetPage);
    });
});

/*
    Show or hide the password.
*/
const passwordButtons =
    document.querySelectorAll("[data-password]");

passwordButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const inputId = button.dataset.password;
        const passwordInput = document.getElementById(inputId);

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            button.textContent = "Hide";
        } else {
            passwordInput.type = "password";
            button.textContent = "Show";
        }
    });
});

/*
    Moves the input label when there is a value.
*/
const inputs = document.querySelectorAll(".input-container input");

inputs.forEach(function (input) {
    input.addEventListener("input", function () {
        const container = input.parentElement;

        if (input.value.trim() !== "") {
            container.classList.add("has-value");
        } else {
            container.classList.remove("has-value");
        }

        input.classList.remove("invalid");
    });
});

/*
    Removes previous messages when changing pages.
*/
function clearMessages() {
    const messages = document.querySelectorAll(".message");

    messages.forEach(function (message) {
        message.textContent = "";
        message.className = "message";
    });

    inputs.forEach(function (input) {
        input.classList.remove("invalid");
    });
}

/*
    Displays an error or success message.
*/
function displayMessage(element, text, messageType) {
    element.textContent = text;
    element.className = "message " + messageType;
}

/*
    Checks the email and password.
*/
function validateForm(form, messageElement) {
    const formInputs = form.querySelectorAll("input");
    let formIsValid = true;

    formInputs.forEach(function (input) {
        if (!input.checkValidity()) {
            input.classList.add("invalid");
            formIsValid = false;
        } else {
            input.classList.remove("invalid");
        }
    });

    if (!formIsValid) {
        displayMessage(
            messageElement,
            "Enter a valid email and a password with at least 6 characters.",
            "error"
        );
    }

    return formIsValid;
}

/*
    Sign-up form submission.
*/
const signupForm = document.getElementById("signupForm");
const signupMessage = document.getElementById("signupMessage");

signupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!validateForm(signupForm, signupMessage)) {
        return;
    }

    displayMessage(
        signupMessage,
        "Account details are ready for backend registration.",
        "success"
    );
});

/*
    Sign-in form submission.
*/
const signinForm = document.getElementById("signinForm");
const signinMessage = document.getElementById("signinMessage");

signinForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!validateForm(signinForm, signinMessage)) {
        return;
    }

    displayMessage(
        signinMessage,
        "Sign-in information successfully validated.",
        "success"
    );
});