// organizer-dashboard.js
// Organizer-facing dashboard for managing events, participants, and attendance.

import { logOut, watchAuthState } from "./auth.js";
import { getAllEvents } from "./events.js";
import { db } from "./firebase-config.js";
import { getVisibleEventsForOrganizer } from "./organizer-dashboard-utils.mjs";
import {
  collection,
  deleteDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  orderBy,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const eventList = document.getElementById("event-list");
const attendanceSummary = document.getElementById("attendance-summary");
const registeredCount = document.getElementById("registered-count");
const checkedInCount = document.getElementById("checked-in-count");
const pendingCount = document.getElementById("pending-count");
const eventsCount = document.getElementById("events-count");
const logoutBtn = document.getElementById("logout-btn");
const footerAvatar = document.getElementById("footer-avatar");
const footerName = document.getElementById("footer-name");
const navAttendance = document.getElementById("nav-attendance");
const navEvents = document.getElementById("nav-events");
const attendanceView = document.getElementById("attendance-view");
const eventsView = document.getElementById("events-view");

let currentUser = null;
let managedEvents = [];
let registrations = [];

function statusPill(status) {
  return `<span class="status ${status}"><span class="dot"></span>${status}</span>`;
}

function renderEvents(events) {
  if (!events.length) {
    eventList.innerHTML = '<div class="empty-row">No events assigned to you yet.</div>';
    return;
  }

  const grouped = new Map();
  events.forEach((ev) => {
    const category = ev.category || "other";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(ev);
  });

  const orderedCategories = ["seminar", "workshop", "other"];
  const orderedEntries = [...grouped.entries()].sort(([a], [b]) => {
    const aIndex = orderedCategories.indexOf(a);
    const bIndex = orderedCategories.indexOf(b);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return safeA - safeB;
  });

  eventList.innerHTML = orderedEntries.map(([category, categoryEvents]) => {
    const title = category.charAt(0).toUpperCase() + category.slice(1);

    return `
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-head">
          <span class="panel-title">${title}</span>
          <span class="nav-count">${categoryEvents.length}</span>
        </div>
        <div class="panel-body">
          ${categoryEvents.map((ev) => `
            <div class="event-card">
              <div class="event-thumb"></div>
              <div class="event-card-body">
                <div class="event-title">${ev.title}</div>
                <div class="event-card-meta">
                  <span class="mono">${ev.category}</span>
                  <span>${ev.startDate}</span>
                  ${statusPill(ev.status)}
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderAttendanceSummary(items) {
  if (!items.length) {
    attendanceSummary.innerHTML = '<div class="empty-row">No registrations for your managed events yet.</div>';
    return;
  }

  const grouped = new Map();
  items.forEach((item) => {
    const key = item.eventId || item.eventTitle || "Unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  attendanceSummary.innerHTML = Array.from(grouped.entries()).map(([eventId, groupItems]) => {
    const groupTitle = groupItems[0]?.eventTitle || "Event";
    const checkedInCountInGroup = groupItems.filter((item) => item.status === "checked-in").length;

    return `
      <div class="panel" style="margin-bottom:12px;">
        <div class="panel-head">
          <span class="panel-title">${groupTitle}</span>
          <span class="nav-count">${checkedInCountInGroup}/${groupItems.length}</span>
        </div>
        <div class="panel-body">
          ${groupItems.map((item) => `
            <div class="reg-row compact">
              <div class="reg-info">
                <div class="reg-title">${item.userName || item.userEmail || "Participant"}</div>
                <div class="reg-meta">${item.userEmail || "No email listed"}</div>
              </div>
              <div class="panel-actions" style="gap:8px;">
                <span class="pill ${item.status === "checked-in" ? "pill-confirmed" : "pill-pending"}">${item.status || "pending"}</span>
                <button class="btn small" data-id="${item.id}" data-status="${item.status}" data-action="toggle-status">
                  ${item.status === "checked-in" ? "Undo check-in" : "Mark check-in"}
                </button>
                <button class="btn small" data-id="${item.id}" data-action="remove-participant" style="border-color: rgba(241, 101, 92, 0.25); color: var(--danger);">Kick</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

async function loadManagedData() {
  if (!currentUser) return;

  const eventsResult = await getAllEvents();
  if (eventsResult.success) {
    managedEvents = getVisibleEventsForOrganizer(eventsResult.events, currentUser.uid);
    renderEvents(managedEvents);
    eventsCount.textContent = managedEvents.length;
  }

  const q = query(collection(db, "registrations"), orderBy("registeredAt", "desc"));
  const snapshot = await getDocs(q);
  const allRegistrations = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const managedEventIds = new Set(managedEvents.map((event) => event.id));
  registrations = allRegistrations.filter((item) => managedEventIds.has(item.eventId));

  renderAttendanceSummary(registrations);

  registeredCount.textContent = registrations.length;
  checkedInCount.textContent = registrations.filter((item) => item.status === "checked-in").length;
  pendingCount.textContent = registrations.filter((item) => item.status === "pending" || item.status === "confirmed").length;
}

function setActiveView(view) {
  attendanceView.hidden = view !== "attendance";
  eventsView.hidden = view !== "events";

  navAttendance.classList.toggle("active", view === "attendance");
  navEvents.classList.toggle("active", view === "events");
}

navAttendance.addEventListener("click", () => setActiveView("attendance"));
navEvents.addEventListener("click", () => setActiveView("events"));

async function handleRegistrationAction(button) {
  const id = button.getAttribute("data-id");
  const action = button.getAttribute("data-action");

  if (action === "remove-participant") {
    const registrationDoc = await getDoc(doc(db, "registrations", id));
    if (!registrationDoc.exists()) return;

    const registration = registrationDoc.data();
    const eventId = registration.eventId;
    await deleteDoc(doc(db, "registrations", id));

    if (eventId) {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const currentValue = Number(eventSnap.data()?.registeredCount || 0);
        await updateDoc(eventRef, { registeredCount: Math.max(currentValue - 1, 0) });
      }
    }

    await loadManagedData();
    return;
  }

  const currentStatus = button.getAttribute("data-status") || "pending";
  const nextStatus = currentStatus === "checked-in" ? "confirmed" : "checked-in";

  await updateDoc(doc(db, "registrations", id), { status: nextStatus });
  await loadManagedData();
}

attendanceSummary.addEventListener("click", async (e) => {
  const button = e.target.closest("button[data-id]");
  if (!button) return;
  await handleRegistrationAction(button);
});

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

  if (role !== "organizer") {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  footerName.textContent = user.email;
  footerAvatar.textContent = user.email.slice(0, 2).toUpperCase();
  loadManagedData();
});
