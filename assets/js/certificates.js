import { watchAuthState } from "./auth.js";
import { db } from "./firebase-config.js";
import { getEventById } from "./events.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const certificateCard = document.getElementById("certificate-card");
const printBtn = document.getElementById("print-btn");

let currentUser = null;

function formatDate(value) {
  if (!value) return "TBD";

  const dateValue = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(dateValue.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(dateValue);
}

function getCertificateId(registration, event) {
  const eventToken = (event?.title || registration?.eventTitle || "SEMINAR")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  const uidToken = (currentUser?.uid || "USER").slice(0, 5).toUpperCase();
  const year = new Date().getFullYear();
  return `CERT-${eventToken || "SEMINAR"}-${year}-${uidToken}`;
}

function renderCertificateShell({ participantName, eventName, eventDate, issueDate, certificateId, statusText, note }) {
  certificateCard.innerHTML = `
    <div class="certificate-badge">Official Attendance Certificate</div>
    <div class="certificate-topline">Congistry • Online Seminar Registration</div>
    <h2>Certificate of Attendance</h2>
    <p class="certificate-intro">This is to certify that</p>
    <div class="certificate-name">${participantName}</div>
    <p class="certificate-copy">has successfully attended the seminar</p>
    <div class="certificate-event">${eventName}</div>
    <div class="certificate-meta-row">
      <div>
        <span class="certificate-meta-label">Date</span>
        <strong>${eventDate}</strong>
      </div>
      <div>
        <span class="certificate-meta-label">Issued</span>
        <strong>${issueDate}</strong>
      </div>
      <div>
        <span class="certificate-meta-label">Status</span>
        <strong>${statusText}</strong>
      </div>
    </div>
    <div class="certificate-note">${note}</div>
    <div class="certificate-footer-row">
      <div>
        <div class="signature-line"></div>
        <div class="signature-label">Authorized by</div>
      </div>
      <div class="certificate-id-box">
        <small>Certificate ID</small>
        <strong>${certificateId}</strong>
      </div>
    </div>
  `;
}

async function loadCertificate() {
  if (!currentUser) return;

  const eventId = new URLSearchParams(window.location.search).get("eventId");
  const q = query(
    collection(db, "registrations"),
    where("userId", "==", currentUser.uid),
    orderBy("registeredAt", "desc")
  );

  const snapshot = await getDocs(q);
  const registrations = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const registration = eventId
    ? registrations.find((item) => item.eventId === eventId) || registrations[0] || null
    : registrations[0] || null;

  if (!registration) {
    certificateCard.innerHTML = `
      <div class="empty-row">No certificate is available yet. Register for a seminar and complete attendance to unlock it.</div>
    `;
    return;
  }

  const eventResult = await getEventById(registration.eventId);
  const event = eventResult.success ? eventResult.event : null;
  const eventName = event?.title || registration.eventTitle || "Seminar";
  const eventDate = formatDate(event?.startDate || registration.eventDate || new Date());
  const issueDate = formatDate(new Date());
  const participantName = currentUser.displayName || registration.userName || currentUser.email?.split("@")[0] || "Participant";
  const isVerified = registration.status === "checked-in" || registration.status === "confirmed";

  renderCertificateShell({
    participantName,
    eventName,
    eventDate,
    issueDate,
    certificateId: getCertificateId(registration, event),
    statusText: isVerified ? "Attendance verified" : "Registration confirmed",
    note: isVerified
      ? "This certificate confirms attendance for the scheduled session above."
      : "Attendance is still pending organizer verification before the certificate can be fully approved."
  });
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
  loadCertificate();
});

if (printBtn) {
  printBtn.addEventListener("click", () => window.print());
}
