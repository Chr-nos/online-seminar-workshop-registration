import { watchAuthState } from "./auth.js";
import { getEventById } from "./events.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { registerParticipantForEvent, unregisterParticipantFromEvent, showRegistrationFeedback } from "./registration.js";

const loadingNode = document.getElementById("event-details-loading");
const contentNode = document.getElementById("event-details-content");
const pageTitle = document.getElementById("page-title");
const footerAvatar = document.getElementById("footer-avatar");
const footerName = document.getElementById("footer-name");

let currentUser = null;
let currentEvent = null;
let alreadyRegistered = false;

function statusPill(status) {
  return `<span class="status ${status}"><span class="dot"></span>${status}</span>`;
}

function capacityInline(registered, capacity) {
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
  const highClass = pct >= 90 ? " high" : "";
  return `
    <span class="progress-inline">
      <span class="capacity-bar"><span class="capacity-fill${highClass}" style="width:${pct}%"></span></span>
      <span class="mono">${registered}/${capacity}</span>
    </span>
  `;
}

function renderEvent() {
  if (!currentEvent) return;

  pageTitle.textContent = currentEvent.title;
  loadingNode.hidden = true;
  contentNode.hidden = false;

  const isFull = Number(currentEvent.capacity || 0) > 0 && Number(currentEvent.registeredCount || 0) >= Number(currentEvent.capacity);

  contentNode.innerHTML = `
    <div class="panel-body">
      <div class="event-title" style="font-size:24px; margin-bottom:8px;">${currentEvent.title}</div>
      <div class="event-card-meta" style="margin-bottom:16px;">
        <span class="mono">${currentEvent.category || "seminar"}</span>
        <span>${currentEvent.startDate || "TBD"}</span>
        ${capacityInline(currentEvent.registeredCount || 0, currentEvent.capacity || 0)}
        ${statusPill(currentEvent.status || "open")}
      </div>
      <div class="note" style="margin-bottom:16px;">${currentEvent.description || "Join this session to learn more about the topic and connect with the organizer."}</div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><span class="panel-title">About this session</span></div>
          <div class="panel-body">
            <p style="margin:0; color:var(--text-mid); line-height:1.6;">${currentEvent.description || "More details will be added by the organizer soon."}</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">Registration</span></div>
          <div class="panel-body">
            <div class="empty-row" style="margin-bottom:12px;">${alreadyRegistered ? "You are already registered for this event." : isFull ? "This event has reached capacity." : "Reserve your spot for this upcoming session."}</div>
            <button class="btn ${alreadyRegistered ? "secondary" : "primary"}" id="register-btn" ${alreadyRegistered || isFull ? "disabled" : ""}>${alreadyRegistered ? "Unregister" : isFull ? "Full" : "Register now"}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const registerBtn = document.getElementById("register-btn");
  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      if (alreadyRegistered) {
        unregisterForCurrentEvent();
      } else {
        registerForCurrentEvent();
      }
    });
  }
}

async function checkRegistrationStatus() {
  if (!currentUser || !currentEvent) return;

  const q = query(collection(db, "registrations"), where("userId", "==", currentUser.uid), where("eventId", "==", currentEvent.id));
  const snapshot = await getDocs(q);
  alreadyRegistered = !snapshot.empty;
  renderEvent();
}

async function registerForCurrentEvent() {
  if (!currentUser || !currentEvent) return;

  const result = await registerParticipantForEvent({ db, user: currentUser, event: currentEvent });

  if (result.success) {
    await loadEvent();
    showRegistrationFeedback("Registration saved successfully.", "success");
  } else {
    showRegistrationFeedback(result.error || "Registration failed. Please try again.", "error");
  }
}

async function unregisterForCurrentEvent() {
  if (!currentUser || !currentEvent) return;

  const result = await unregisterParticipantFromEvent({ db, user: currentUser, event: currentEvent });

  if (result.success) {
    await loadEvent();
    showRegistrationFeedback("Registration cancelled successfully.", "success");
  } else {
    showRegistrationFeedback(result.error || "Unable to cancel registration.", "error");
  }
}

async function loadEvent() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("id");

  if (!eventId) {
    loadingNode.innerHTML = '<div class="empty-row">No event selected.</div>';
    return;
  }

  const result = await getEventById(eventId);
  if (!result.success) {
    loadingNode.innerHTML = `<div class="empty-row">${result.error}</div>`;
    return;
  }

  currentEvent = result.event;
  renderEvent();
  if (currentUser) {
    checkRegistrationStatus();
  }
}

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
  loadEvent();
});
