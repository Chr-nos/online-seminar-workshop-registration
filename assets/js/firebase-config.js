// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCqWrW99eFRpWH93xS5x91UyOXebUJZfgM",
  authDomain: "onlineseminarregistration-fin.firebaseapp.com",
  projectId: "onlineseminarregistration-fin",
  storageBucket: "onlineseminarregistration-fin.firebasestorage.app",
  messagingSenderId: "677712869737",
  appId: "1:677712869737:web:edda63f88725723a5d65f8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };