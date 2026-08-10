import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const REGISTRATION_COLLECTION = "registrations";

function showRegistrationFeedback(message, type = "success") {
  if (typeof document === "undefined") return;

  const existing = document.querySelector(".registration-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `registration-toast registration-toast-${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 220);
  }, 2800);
}

async function registerParticipantForEvent({ db, user, event }) {
  if (!db || !user || !event) {
    return { success: false, error: "Missing registration context." };
  }

  try {
    const existingQuery = query(
      collection(db, "registration"),
      where("userId", "==", user.uid),
      where("eventId", "==", event.id)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      return { success: false, error: "You are already registered for this event.", alreadyRegistered: true };
    }

    const eventRef = doc(db, "events", event.id);
    const eventSnapshot = await getDoc(eventRef);
    const eventData = eventSnapshot.exists() ? eventSnapshot.data() : {};
    const capacity = Number(eventData.capacity || 0);
    const currentCount = Number(eventData.registeredCount || 0);

    if (capacity > 0 && currentCount >= capacity) {
      return { success: false, error: "This event is already at full capacity." };
    }

    const registrationQuery = query(
      collection(db, REGISTRATION_COLLECTION),
      where("eventId", "==", event.id)
    );
    const registrationsSnapshot = await getDocs(registrationQuery);

    if (capacity > 0 && registrationsSnapshot.size >= capacity) {
      return { success: false, error: "This event is already at full capacity." };
    }

    const docRef = await addDoc(collection(db, REGISTRATION_COLLECTION), {
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || user.email,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.startDate,
      status: "confirmed",
      registeredAt: serverTimestamp()
    });

    const nextCount = Math.max(registrationsSnapshot.size + 1, 0);
    await updateDoc(eventRef, {
      registeredCount: nextCount
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function unregisterParticipantFromEvent({ db, user, event }) {
  if (!db || !user || !event) {
    return { success: false, error: "Missing registration context." };
  }

  try {
    const existingQuery = query(
      collection(db, REGISTRATION_COLLECTION),
      where("userId", "==", user.uid),
      where("eventId", "==", event.id)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (existingSnapshot.empty) {
      return { success: false, error: "You are not registered for this event." };
    }

    await Promise.all(existingSnapshot.docs.map((registrationDoc) => deleteDoc(registrationDoc.ref)));

    const eventRef = doc(db, "events", event.id);
    const eventSnapshot = await getDoc(eventRef);
    const eventData = eventSnapshot.exists() ? eventSnapshot.data() : {};
    const registrationsQuery = query(
      collection(db, REGISTRATION_COLLECTION),
      where("eventId", "==", event.id)
    );
    const registrationsSnapshot = await getDocs(registrationsQuery);
    const nextCount = Math.max(registrationsSnapshot.size, 0);

    await updateDoc(eventRef, {
      registeredCount: nextCount
    });

    if (eventData.capacity && Number(eventData.capacity) < nextCount) {
      await updateDoc(eventRef, {
        registeredCount: Number(eventData.capacity)
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export { registerParticipantForEvent, unregisterParticipantFromEvent, showRegistrationFeedback };