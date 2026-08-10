// register.js
// Page-glue for register.html. No Firestore/Auth calls of its own — delegates to auth.js.

import { signUp } from "./auth.js";

const form = document.getElementById("register-form");
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  // Public registration is participant-only. Organizer and admin
  // accounts are created manually (Firestore console) or via an
  // admin-only promotion flow — not through this form.
  const result = await signUp(name, email, password, "participant");

  if (!result.success) {
    showError(friendlyError(result.error));
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
    return;
  }

  window.location.href = "participant-dashboard.html";
});

/**
 * Turn raw Firebase Auth error strings into something readable,
 * since result.error from auth.js is just error.message straight from Firebase.
 */
function friendlyError(message) {
  if (message.includes("email-already-in-use")) {
    return "That email is already registered. Try logging in instead.";
  }
  if (message.includes("weak-password")) {
    return "Password should be at least 6 characters.";
  }
  if (message.includes("invalid-email")) {
    return "That email address doesn't look right.";
  }
  return "Couldn't create your account. Please try again.";
}

window.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".auth-card");
  const fields = document.querySelectorAll(".field");
  const button = document.querySelector(".btn");

  // Show card first
  setTimeout(() => {
    card.classList.add("show");
  }, 200);

  // Animate fields one by one
  fields.forEach((field, index) => {
    setTimeout(() => {
      field.classList.add("show");
    }, 500 + index * 200);
  });

  // Show button last
  setTimeout(() => {
    button.classList.add("show");
  }, 500 + fields.length * 200);
});