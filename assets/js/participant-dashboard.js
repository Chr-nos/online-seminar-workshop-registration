// participant-dashboard.js
// Participant-facing dashboard for browsing and registering for events.

import { logOut, watchAuthState } from "./auth.js";
import { getAllEvents } from "./events.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { registerParticipantForEvent, unregisterParticipantFromEvent, showRegistrationFeedback } from "./registration.js";

const eventList = document.getElementById("event-list");
const registeredCount = document.getElementById("registered-count");
const upcomingCount = document.getElementById("upcoming-count");
const logoutBtn = document.getElementById("logout-btn");
const navCertificates = document.getElementById("nav-certificates");
const footerAvatar = document.getElementById("footer-avatar");
const footerName = document.getElementById("footer-name");

let currentUser = null;
let allEvents = [];
let myRegistrations = [];
let myRegistration = null;

function statusPill(status) {
  return `<span class="status ${status}"><span class="dot"></span>${status}</span>`;
}

function capacityInline(registered, capacity) {
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
  return `
    <span class="progress-inline">
      <span class="capacity-bar"><span class="capacity-fill" style="width:${pct}%"></span></span>
      <span class="mono">${registered}/${capacity}</span>
    </span>
  `;
}

function renderEvents(events) {
  if (!events.length) {
    eventList.innerHTML = '<div class="empty-row">No events are available right now.</div>';
    return;
  }

  const categoryOrder = ["Seminar", "Workshop"];
  const grouped = new Map();

  events.forEach((ev) => {
    let category = (ev.category || "Other").trim();
    const normalized = category.toLowerCase();

    if (normalized.includes("seminar")) category = "Seminar";
    else if (normalized.includes("workshop")) category = "Workshop";
    else if (!category || category === "General") category = "Other";

    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(ev);
  });

  const sections = [...grouped.entries()]
    .sort(([a], [b]) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);

      if (indexA !== -1 || indexB !== -1) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }

      return a.localeCompare(b);
    })
    .map(([category, categoryEvents]) => {
      const cards = categoryEvents.map((ev) => {
        const registeredEntry = myRegistrations.find((item) => item.eventId === ev.id);
        const isRegistered = !!registeredEntry;
        const statusText = registeredEntry?.status || ev.status || "open";

        return `
          <div class="event-card">
            <div class="event-thumb"></div>
            <div class="event-card-body">
              <div class="event-title">${ev.title}</div>
              <div class="event-card-meta">
                <span class="mono">${ev.category || category}</span>
                <span>${ev.startDate}</span>
                ${capacityInline(ev.registeredCount || 0, ev.capacity)}
                ${statusPill(statusText)}
              </div>
            </div>
            <div class="event-card-actions" style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
              <a href="event-details.html?id=${ev.id}"><button class="btn small" type="button">View details</button></a>
              <button class="btn ${isRegistered ? "secondary" : "primary"}" data-event-id="${ev.id}" data-action="register" ${isRegistered ? "disabled" : ""}>${isRegistered ? "Registered" : "Register"}</button>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="event-section">
          <div class="event-section-header">${category}</div>
          <div class="event-section-list">${cards}</div>
        </div>
      `;
    }).join("");

  eventList.innerHTML = `<div class="event-category-grid">${sections}</div>`;
}

async function loadEvents() {
  const result = await getAllEvents();
  if (result.success) {
    allEvents = result.events;
    renderEvents(allEvents);
  } else {
    eventList.innerHTML = `<div class="empty-row">Couldn't load events: ${result.error}</div>`;
  }
}

async function loadMyRegistration() {
  if (!currentUser) return;

  const q = query(collection(db, "registrations"), where("userId", "==", currentUser.uid), orderBy("registeredAt", "desc"));
  const snapshot = await getDocs(q);
  myRegistrations = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  myRegistration = myRegistrations[0] || null;

  registeredCount.textContent = String(myRegistrations.length);
  upcomingCount.textContent = String(myRegistrations.length);
  renderEvents(allEvents);
}

async function refreshDashboardData() {
  if (!currentUser) return;

  await Promise.all([
    loadEvents(),
    loadMyRegistration()
  ]);
}

async function registerForEvent(eventId) {
  if (!currentUser) return;

  const event = allEvents.find((item) => item.id === eventId);
  if (!event) return;

  const result = await registerParticipantForEvent({ db, user: currentUser, event });

  if (result.success) {
    await loadEvents();
    await loadMyRegistration();
    showRegistrationFeedback("Registration saved successfully.", "success");
  } else {
    showRegistrationFeedback(result.error || "Registration failed. Please try again.", "error");
  }
}

eventList.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-event-id]");
  if (!button || button.disabled) return;

  registerForEvent(button.getAttribute("data-event-id"));
});

if (navCertificates) {
  navCertificates.addEventListener("click", () => {
    window.location.href = "certificate.html";
  });
}

logoutBtn.addEventListener("click", async () => {
  const result = await logOut();
  if (result.success) {
    window.location.href = "login.html";
  }
});

watchAuthState((user, role) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (role !== "participant") {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  footerName.textContent = user.email;
  footerAvatar.textContent = user.email.slice(0, 2).toUpperCase();
  refreshDashboardData();
});