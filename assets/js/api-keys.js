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
export const OWNER_EMAIL = "super@admin.com"; 

// ⚔️ TIER 2: GENERAL ADMINS
// Can Edit/Delete ANYONE (But no Super Button)
export const GENERAL_ADMINS = [
    "skyruler3281@gmail.com",
    "riteshcsw@gmail.com"
];

// 🛡️ TIER 3: CLAN CAPTAINS
// Can ONLY edit/delete members of their specific Clan
// Format: "email": "Clan Name"
export const CLAN_CAPTAINS = {
    "admin@clan1.com": "Clan 1",
    "admin@clan2.com": "Clan 2",
    "admin@clan3.com": "Clan 3",
    "admin@clan4.com": "Clan 4",
    "admin@clan5.com": "Clan 5",
    "admin@clan6.com": "Clan 6",
    "admin@clan7.com": "Clan 7", // Example: Ritesh only manages Clan 7
    "admin@clan8.com": "Clan 8",
    "admin@clan9.com": "Clan 9"
};