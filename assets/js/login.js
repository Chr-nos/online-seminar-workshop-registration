// login.js
// Page-glue for login.html. No Firestore/Auth calls of its own — delegates to auth.js.

import { logIn, getUserRole } from "./auth.js";

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("visible");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("visible");
}

/**
 * Send a logged-in user to the right dashboard for their role.
 * Falls back to login if the role is missing or unrecognized —
 * this shouldn't normally happen since signUp always writes a role.
 */
function redirectByRole(role) {
  if (role === "admin") {
    window.location.href = "admin-dashboard.html";
  } else if (role === "organizer") {
    window.location.href = "organizer-dashboard.html";
  } else if (role === "participant") {
    window.location.href = "participant-dashboard.html";
  } else {
    showError("Your account doesn't have a role assigned. Contact an admin.");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  const identifier = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const result = await logIn(identifier, password);

  if (!result.success) {
    showError("Couldn't log in. Check your name/email and password and try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
    return;
  }

  const role = await getUserRole(result.user.uid);
  redirectByRole(role);
});

window.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".auth-card");

  if (!card) return; // safety check

  // Force visible after load
  requestAnimationFrame(() => {
    card.classList.add("show");
  });

  // Focus email
  const emailInput = document.querySelector("#email");
  if (emailInput) {
    setTimeout(() => emailInput.focus(), 300);
  }
});