import { firebaseConfig } from './api-keys.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// 1. Initialize App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. Enable Offline Mode
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Persistence Issue:", err.code);
});

// 3. EXPORTS
export { db, auth };

// 4. *** THE MAGIC KEY ***
// This lets you run scripts in the Console
window.db = db;
window.auth = auth;
console.log("✅ Firebase Connected & Exposed to Console");