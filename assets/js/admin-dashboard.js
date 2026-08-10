// admin-dashboard.js
// Page-glue for admin-dashboard.html.
// Wires auth.js (who's logged in) and events.js (event data) to the DOM.
// Does not talk to Firestore directly — that's events.js's job.

import { logOut, watchAuthState } from "./auth.js";
import { createEvent, getAllEvents, updateEvent, deleteEvent } from "./events.js";
import { db } from "./firebase-config.js";
import {
  collection,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
  doc,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const tableBody = document.getElementById("events-table-body");
const navCount = document.getElementById("nav-events-count");
const footerAvatar = document.getElementById("footer-avatar");
const footerName = document.getElementById("footer-name");
const form = document.getElementById("event-form");
const formStatus = document.getElementById("form-status");
const eventIdInput = document.getElementById("event-id");
const eventTitleInput = document.getElementById("event-title");
const eventCategoryInput = document.getElementById("event-category");
const eventDateInput = document.getElementById("event-date");
const eventCapacityInput = document.getElementById("event-capacity");
const eventDescriptionInput = document.getElementById("event-description");
const eventSubmitBtn = document.getElementById("event-submit-btn");
const eventResetBtn = document.getElementById("event-reset-btn");
const refreshBtn = document.getElementById("refresh-btn");
const refreshUsersBtn = document.getElementById("refresh-users-btn");
const logoutBtn = document.getElementById("logout-btn");
const usersManagementList = document.getElementById("users-management-list");
const registrationsManagementList = document.getElementById("registrations-management-list");
const eventsView = document.getElementById("events-view");
const usersView = document.getElementById("users-view");
const registrationsView = document.getElementById("registrations-view");
const navEvents = document.getElementById("nav-events");
const navUsers = document.getElementById("nav-users");
const navRegistrations = document.getElementById("nav-registrations");

let currentUser = null;
let editingEventId = null;

function resetEventForm() {
  editingEventId = null;
  eventIdInput.value = "";
  form.reset();
  eventSubmitBtn.textContent = "Create event";
  formStatus.textContent = "";
}

function fillEventForm(event) {
  editingEventId = event.id;
  eventIdInput.value = event.id;
  eventTitleInput.value = event.title || "";
  eventCategoryInput.value = event.category || "seminar";
  eventDateInput.value = event.startDate || "";
  eventCapacityInput.value = event.capacity || "";
  eventDescriptionInput.value = event.description || "";
  eventSubmitBtn.textContent = "Save changes";
  formStatus.textContent = "Editing existing event";
}

/**
 * Turn a status string into the pill markup used across the whole app.
 */
function statusPill(status) {
  return `<span class="status ${status}"><span class="dot"></span>${status}</span>`;
}

/**
 * Turn registeredCount/capacity into the capacity bar + fraction markup.
 */
function capacityCell(registered, capacity) {
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
  const highClass = pct >= 90 ? " high" : "";
  return `
    <span class="capacity-bar"><span class="capacity-fill${highClass}" style="width:${pct}%"></span></span>
    <span class="mono">${registered}/${capacity}</span>
  `;
}

/**
 * Render the events array into the table. Called after every fetch.
 */
function renderEvents(events) {
  navCount.textContent = events.length;

  if (events.length === 0) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="6">No events yet — create one to get started.</td></tr>`;
    return;
  }

  tableBody.innerHTML = events.map((ev) => `
    <tr>
      <td>
        <div class="event-title">${ev.title}</div>
        <div class="event-sub mono">${ev.id}</div>
      </td>
      <td class="mono">${ev.category}</td>
      <td class="mono">${ev.startDate}</td>
      <td>${capacityCell(ev.registeredCount || 0, ev.capacity)}</td>
      <td>${statusPill(ev.status)}</td>
      <td>
        <div class="panel-actions" style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
          <button class="btn small" data-action="edit" data-event-id="${ev.id}">Edit</button>
          <button class="btn small" data-action="delete" data-event-id="${ev.id}">Delete</button>
          <button class="btn small" data-action="close" data-event-id="${ev.id}">${ev.status === "closed" ? "Reopen" : "Close"}</button>
          <select class="role-select" data-event-id="${ev.id}" data-organizer-id="${ev.organizerId || ""}">
            <option value="">Unassigned</option>
          </select>
        </div>
      </td>
    </tr>
  `).join("");
}

/**
 * Fetch events from Firestore and render them.
 */
async function loadEvents() {
  tableBody.innerHTML = `<tr class="empty-row"><td colspan="6">Loading events…</td></tr>`;
  const result = await getAllEvents();
  if (result.success) {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const organizerUsers = usersSnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((user) => user.role === "organizer");

    renderEvents(result.events);
    populateOrganizerSelects(result.events, organizerUsers);
  } else {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="6">Couldn't load events: ${result.error}</td></tr>`;
  }
}

function populateOrganizerSelects(events, organizerUsers) {
  const selects = tableBody.querySelectorAll("select[data-event-id]");
  selects.forEach((select) => {
    const eventId = select.getAttribute("data-event-id");
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const currentOrganizerId = event.organizerId || "";
    select.innerHTML = '<option value="">Unassigned</option>';

    organizerUsers.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = user.name || user.email || user.id;
      if (user.id === currentOrganizerId) option.selected = true;
      select.appendChild(option);
    });
  });
}

async function loadUsersForManagement() {
  try {
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50));
    const usersSnapshot = await getDocs(usersQuery);
    const users = usersSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    const groupedUsers = {
      admin: [],
      organizer: [],
      participant: []
    };

    users.forEach((user) => {
      const role = user.role || "participant";
      if (groupedUsers[role]) {
        groupedUsers[role].push(user);
      } else {
        groupedUsers.participant.push(user);
      }
    });

    const roleOrder = [
      { key: "admin", label: "Admins" },
      { key: "organizer", label: "Organizers" },
      { key: "participant", label: "Participants" }
    ];

    usersManagementList.innerHTML = users.length
      ? roleOrder.map(({ key, label }) => {
          const groupUsers = groupedUsers[key] || [];
          if (!groupUsers.length) return "";

          const rows = groupUsers.map((user) => {
            const role = user.role || "participant";
            const initials = (user.name || user.email || "U")
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0] || "")
              .join("")
              .toUpperCase();

            return `
              <div class="user-row compact">
                <div class="user-chip">
                  <div class="user-avatar">${initials}</div>
                  <div>
                    <div class="user-chip-name">${user.name || user.email || "Unnamed user"}</div>
                    <div class="user-chip-meta">${user.email || "No email"}</div>
                  </div>
                </div>
                <div class="panel-actions">
                  <select class="role-select" data-user-id="${user.id}" data-role="${role}">
                    <option value="participant" ${role === "participant" ? "selected" : ""}>Participant</option>
                    <option value="organizer" ${role === "organizer" ? "selected" : ""}>Organizer</option>
                    <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
                  </select>
                </div>
              </div>
            `;
          }).join("");

          return `
            <div class="user-role-section">
              <div class="user-role-header">${label}</div>
              ${rows}
            </div>
          `;
        }).join("")
      : '<div class="empty-row">No users yet</div>';
  } catch (error) {
    usersManagementList.innerHTML = '<div class="empty-row">Could not load users</div>';
  }
}

async function loadRegistrationsForManagement() {
  try {
    const registrationsQuery = query(collection(db, "registrations"), orderBy("registeredAt", "desc"), limit(50));
    const registrationsSnapshot = await getDocs(registrationsQuery);
    const registrations = registrationsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    const grouped = new Map();
    registrations.forEach((reg) => {
      const eventKey = reg.eventTitle || reg.eventId || "Unassigned event";
      if (!grouped.has(eventKey)) grouped.set(eventKey, []);
      grouped.get(eventKey).push(reg);
    });

    registrationsManagementList.innerHTML = registrations.length
      ? [...grouped.entries()].map(([eventLabel, eventRegistrations]) => {
          const rows = eventRegistrations.map((reg) => {
            const status = reg.status || "pending";
            const statusClass = status === "confirmed" || status === "checked-in" ? "pill-confirmed" : "pill-pending";
            const label = status === "checked-in" ? "Checked in" : status.charAt(0).toUpperCase() + status.slice(1);
            const userLabel = reg.userName || reg.userEmail || "Guest";

            return `
              <div class="registration-row compact">
                <div class="reg-info">
                  <div class="reg-title">${userLabel}</div>
                  <div class="reg-meta">${reg.userEmail || "No email"}</div>
                </div>
                <div class="registration-actions">
                  <span class="pill ${statusClass}">${label}</span>
                  <button class="btn small danger" data-registration-id="${reg.id}" data-event-id="${reg.eventId || ""}" data-action="nullify-registration">Nullify</button>
                </div>
              </div>
            `;
          }).join("");

          return `
            <div class="registration-group">
              <div class="registration-group-header">${eventLabel}</div>
              ${rows}
            </div>
          `;
        }).join("")
      : '<div class="empty-row">No registrations yet</div>';
  } catch (error) {
    registrationsManagementList.innerHTML = '<div class="empty-row">Could not load registrations</div>';
  }
}

async function loadSidebarData() {
  try {
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(6));
    await getDocs(usersQuery);
  } catch (error) {
    // Sidebar summary cards removed; no-op retained for compatibility.
  }
}

/**
 * Handle the "New event" form submit.
 */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const eventData = {
    title: eventTitleInput.value.trim(),
    category: eventCategoryInput.value,
    startDate: eventDateInput.value,
    capacity: eventCapacityInput.value,
    description: eventDescriptionInput.value.trim()
  };

  if (!eventData.title || !eventData.startDate || !eventData.capacity) {
    formStatus.textContent = "Please fill in the title, date, and capacity.";
    return;
  }

  if (editingEventId) {
    formStatus.textContent = "Saving…";
    const result = await updateEvent(editingEventId, {
      title: eventData.title,
      category: eventData.category,
      startDate: eventData.startDate,
      capacity: Number(eventData.capacity),
      description: eventData.description
    });

    if (result.success) {
      formStatus.textContent = "Event updated.";
      resetEventForm();
      await loadEvents();
    } else {
      formStatus.textContent = "Error: " + result.error;
    }
    return;
  }

  formStatus.textContent = "Creating…";
  const result = await createEvent(eventData, currentUser ? currentUser.uid : null);

  if (result.success) {
    formStatus.textContent = "Event created.";
    resetEventForm();
    await loadEvents();
  } else {
    formStatus.textContent = "Error: " + result.error;
  }
});

eventResetBtn.addEventListener("click", resetEventForm);

refreshBtn.addEventListener("click", loadEvents);
refreshUsersBtn.addEventListener("click", loadUsersForManagement);

navEvents.addEventListener("click", () => {
  navEvents.classList.add("active");
  navUsers.classList.remove("active");
  navRegistrations.classList.remove("active");
  eventsView.hidden = false;
  usersView.hidden = true;
  registrationsView.hidden = true;
});

navUsers.addEventListener("click", () => {
  navUsers.classList.add("active");
  navEvents.classList.remove("active");
  navRegistrations.classList.remove("active");
  eventsView.hidden = true;
  usersView.hidden = false;
  registrationsView.hidden = true;
  loadUsersForManagement();
});

navRegistrations.addEventListener("click", () => {
  navRegistrations.classList.add("active");
  navEvents.classList.remove("active");
  navUsers.classList.remove("active");
  eventsView.hidden = true;
  usersView.hidden = true;
  registrationsView.hidden = false;
  loadRegistrationsForManagement();
});

tableBody.addEventListener("click", async (e) => {
  const button = e.target.closest("button[data-event-id]");
  if (!button) return;

  const eventId = button.getAttribute("data-event-id");
  const action = button.getAttribute("data-action");

  if (action === "edit") {
    const event = (await getAllEvents()).events.find((item) => item.id === eventId);
    if (event) {
      fillEventForm(event);
      formStatus.textContent = "Editing existing event";
    }
    return;
  }

  if (action === "delete") {
    const result = await deleteEvent(eventId);
    if (result.success) {
      formStatus.textContent = "Event deleted.";
      await loadEvents();
    } else {
      formStatus.textContent = "Error: " + result.error;
    }
    return;
  }

  const currentStatus = button.textContent.includes("Reopen") ? "closed" : "open";
  const nextStatus = currentStatus === "closed" ? "open" : "closed";

  await updateDoc(doc(db, "events", eventId), { status: nextStatus });
  await loadEvents();
});

tableBody.addEventListener("change", async (e) => {
  const select = e.target.closest("select[data-event-id]");
  if (!select) return;

  const eventId = select.getAttribute("data-event-id");
  const organizerId = select.value;

  await updateDoc(doc(db, "events", eventId), { organizerId: organizerId || null });
  await loadEvents();
});

usersManagementList.addEventListener("change", async (e) => {
  const select = e.target.closest("select[data-user-id]");
  if (!select) return;

  const userId = select.getAttribute("data-user-id");
  const nextRole = select.value;

  await updateDoc(doc(db, "users", userId), { role: nextRole });
  await loadSidebarData();
  await loadUsersForManagement();
});

registrationsManagementList.addEventListener("click", async (e) => {
  const button = e.target.closest("button[data-registration-id]");
  if (!button) return;

  const registrationId = button.getAttribute("data-registration-id");
  const eventId = button.getAttribute("data-event-id");

  if (!registrationId) return;

  try {
    await deleteDoc(doc(db, "registrations", registrationId));

    if (eventId) {
      const eventQuery = query(collection(db, "registrations"), where("eventId", "==", eventId));
      const eventSnapshot = await getDocs(eventQuery);
      await updateDoc(doc(db, "events", eventId), {
        registeredCount: eventSnapshot.size
      });
    }

    await loadRegistrationsForManagement();
    await loadEvents();
  } catch (error) {
    console.error("Could not nullify registration:", error);
  }
});

logoutBtn.addEventListener("click", async () => {
  const result = await logOut();
  if (result.success) {
    window.location.href = "login.html";
  } else {
    formStatus.textContent = "Couldn't log out. Please try again.";
  }
});

/**
 * Auth guard: only admins get to see this page.
 * Everyone else gets redirected to login.
 */
watchAuthState((user, role) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  footerName.textContent = user.email;
  footerAvatar.textContent = user.email.slice(0, 2).toUpperCase();

  loadEvents();
  loadSidebarData();
  loadUsersForManagement();
  loadRegistrationsForManagement();
});

function tick() {
  const now = new Date();
  const el = document.getElementById("clock");
  if (el) {
    el.textContent = now.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }
}
tick();
setInterval(tick, 1000 * 30);