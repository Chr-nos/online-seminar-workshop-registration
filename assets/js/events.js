// events.js
// Data layer for the `events` collection (per ERD: eventId, title, description,
// category, startDate, endDate, location, organizerId, capacity, status).
// This file only talks to Firestore — it doesn't know which page called it.

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

/**
 * Create a new event. Defaults status to "open" and registeredCount to 0
 * so capacity bars have something to read from day one.
 *
 * @param {object} eventData - { title, category, startDate, capacity }
 * @param {string} organizerId - uid of the admin/organizer creating it
 */
async function createEvent(eventData, organizerId) {
  try {
    const docRef = await addDoc(collection(db, "events"), {
      title: eventData.title,
      category: eventData.category,
      startDate: eventData.startDate,
      capacity: Number(eventData.capacity),
      description: eventData.description || "",
      registeredCount: 0,
      organizerId: organizerId || null,
      status: "open",
      createdAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/*
 * Fetch all events, most recently created first.
 * Returns an array of event objects with their Firestore doc id attached.
 */
async function getAllEvents() {
  try {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const events = [];
    snapshot.forEach((docSnap) => {
      events.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { success: true, events };
  } catch (error) {
    return { success: false, error: error.message, events: [] };
  }
}

async function getEventById(eventId) {
  try {
    const docSnap = await getDoc(doc(db, "events", eventId));
    if (!docSnap.exists()) {
      return { success: false, error: "Event not found", event: null };
    }
    return { success: true, event: { id: docSnap.id, ...docSnap.data() } };
  } catch (error) {
    return { success: false, error: error.message, event: null };
  }
}

/**
 * Update an existing event (e.g. change status, capacity, assign organizer).
 * @param {string} eventId
 * @param {object} updates - partial fields to update
 */
async function updateEvent(eventId, updates) {
  try {
    await updateDoc(doc(db, "events", eventId), updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete an event.
 * Note: this does NOT cascade-delete related registrations/attendance —
 * that cleanup would need to happen separately if you want it.
 */
async function deleteEvent(eventId) {
  try {
    await deleteDoc(doc(db, "events", eventId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export { createEvent, getAllEvents, getEventById, updateEvent, deleteEvent };