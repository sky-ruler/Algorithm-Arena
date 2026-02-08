export const firebaseConfig = {
    apiKey: "AIzaSyCqZpgqePSvTs_TJKSYKeYU0uCHx-jAZSk",
    authDomain: "soa-clan7-tracker.firebaseapp.com",
    projectId: "soa-clan7-tracker",
    storageBucket: "soa-clan7-tracker.firebasestorage.app",
    messagingSenderId: "123867489518",
    appId: "1:123867489518:web:5f5a18c546c43f1c9bbfff",
    measurementId: "G-SLEYZ0FGQ2"
};

// 👑 TIER 1: OWNER (You)
// Full Access + Super Button + Database Reset
export const OWNER_EMAIL = "skyruler3281@gmail.com"; 

// ⚔️ TIER 2: GENERAL ADMINS
// Can Edit/Delete ANYONE (But no Super Button)
export const GENERAL_ADMINS = [
    "co.lead@college.edu",
    "faculty.lead@college.edu"
];

// 🛡️ TIER 3: CLAN CAPTAINS
// Can ONLY edit/delete members of their specific Clan
// Format: "email": "Clan Name"
export const CLAN_CAPTAINS = {
    "captain1@gmail.com": "Clan 1",
    "captain2@gmail.com": "Clan 2",
    "captain3@gmail.com": "Clan 3",
    "captain4@gmail.com": "Clan 4",
    "captain5@gmail.com": "Clan 5",
    "captain6@gmail.com": "Clan 6",
    "ritesh.kumar@gmail.com": "Clan 7", // Example: Ritesh only manages Clan 7
    "captain8@gmail.com": "Clan 8",
    "captain9@gmail.com": "Clan 9"
};