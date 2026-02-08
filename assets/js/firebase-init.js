import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getFirestore, 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { firebaseConfig } from './api-keys.js';

// 1. Initialize App
const app = initializeApp(firebaseConfig);

// 2. Initialize Firestore with Modern Multi-Tab Persistence
// This fixes the "failed-precondition" error and the deprecation warning
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager() 
    })
});

// 3. Initialize Auth
const auth = getAuth(app);

// 4. Expose for Debugging (Console Access)
window.db = db;
window.auth = auth;
console.log("✅ Firebase Connected & Exposed to Console");

// 5. Export for App Usage
export { db, auth };