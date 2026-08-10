// auth.js
// Handles signup, login, logout, and role checking.
// Depends on firebase-config.js already initializing the app.

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { db } from "./firebase-config.js"; // reuse your existing initialized app

const auth = getAuth();

async function persistSession() {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (error) {
    console.warn("Could not set auth persistence:", error);
  }
}

/**
 * Sign up a new user.
 * Creates the Firebase Auth account AND a matching document in the
 * `users` collection (uid, name, email, role, createdAt) per the ERD.
 *
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {string} role - "participant" | "organizer" | "admin"
 */
async function signUp(name, email, password, role = "participant") {
  try {
    await persistSession();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create matching Firestore user doc (matches ERD: users table)
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: name,
      email: email,
      role: role,
      createdAt: serverTimestamp()
    });

    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function resolveLoginIdentifier(identifier) {
  const trimmed = (identifier || "").trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    return trimmed;
  }

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const match = usersSnapshot.docs.find((userDoc) => {
      const data = userDoc.data();
      const storedName = (data.name || "").toString().trim().toLowerCase();
      return storedName === trimmed.toLowerCase();
    });

    return match ? (match.data().email || null) : null;
  } catch (error) {
    console.warn("Could not resolve login identifier:", error);
    return null;
  }
}

/**
 * Log in an existing user.
 */
async function logIn(identifier, password) {
  try {
    await persistSession();
    const email = await resolveLoginIdentifier(identifier);

    if (!email) {
      return { success: false, error: "No account found for that name or email." };
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Log out the current user.
 */
async function logOut() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch the role of a given uid from the `users` collection.
 * Used to decide what a logged-in user is allowed to see/do
 * (Admin / Organizer / Participant from the Use Case Diagram).
 */
async function getUserRole(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    return userDoc.data().role;
  }
  return null;
}

/**
 * Listen for auth state changes (call this on every protected page).
 * Runs `callback(user, role)` whenever login state changes.
 * If not logged in, role will be null.
 *
 * Example usage on dashboard.html:
 *   watchAuthState((user, role) => {
 *     if (!user) window.location.href = "login.html";
 *     if (role === "admin") showAdminPanel();
 *   });
 */
function watchAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const role = await getUserRole(user.uid);
      callback(user, role);
    } else {
      callback(null, null);
    }
  });
}

export { signUp, logIn, logOut, getUserRole, watchAuthState };