import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ⚠️ SECURITY & CONFIGURATION
// These are the exact keys for project: soa-clan7-tracker
const firebaseConfig = {
    apiKey: "AIzaSyCqZpgqePSvTs_TJKSYKeYU0uCHx-jAZSk",
    authDomain: "soa-clan7-tracker.firebaseapp.com",
    projectId: "soa-clan7-tracker",
    storageBucket: "soa-clan7-tracker.firebasestorage.app",
    messagingSenderId: "123867489518",
    appId: "1:123867489518:web:5f5a18c546c43f1c9bbfff",
    measurementId: "G-SLEYZ0FGQ2"
};

// 🚀 INITIALIZATION
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export for use in app.js and admin.js
export { db, auth };