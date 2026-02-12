import { db, auth } from './firebase-init.js'; // 🛡️ Imported Auth
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ---------------------------------------------------------
// 🔒 SECURITY GATEKEEPER
// ---------------------------------------------------------
async function verifySuperAdmin() {
    const user = auth.currentUser;
    if (!user) {
        alert("⛔ SECURITY ALERT: You are not logged in.");
        return false;
    }

    try {
        const docRef = doc(db, "system_config", "roles");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const admins = docSnap.data().super_admins || [];
            // STRICT CHECK: Is the email in the Super Admin list?
            if (admins.includes(user.email)) {
                return true;
            }
        }
    } catch (e) {
        console.error("Security Check Failed:", e);
    }

    alert("⛔ ACCESS DENIED: You do not have Super Admin clearance.");
    return false;
}

// ---------------------------------------------------------
// 1. READ OPERATIONS (Public - Safe)
// ---------------------------------------------------------

export async function fetchClanStructure() {
    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().structure : {};
    } catch (error) {
        console.error("CRITICAL: Failed to fetch clan structure.", error);
        return {};
    }
}

export async function fetchSystemRoles() {
    try {
        const docRef = doc(db, "system_config", "roles");
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : { super_admins: [], general_admins: [], clan_chiefs: {} };
    } catch (error) {
        console.error("CRITICAL: Failed to fetch roles.", error);
        return { super_admins: [], general_admins: [], clan_chiefs: {} };
    }
}

// ---------------------------------------------------------
// 2. WRITE OPERATIONS (Restricted)
// ---------------------------------------------------------

export async function addMemberToClan(clanName, memberName) {
    if (!clanName || !memberName) return false;
    
    // Note: General Admins CAN add members, so we don't enforce Super Admin check here.
    // Use Firestore Rules if you want to restrict this further.
    
    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const structure = docSnap.data().structure;
            if (!structure[clanName]) structure[clanName] = [];
            
            if (!structure[clanName].includes(memberName)) {
                structure[clanName].push(memberName);
                await updateDoc(docRef, { structure });
                
                // Correct ID Logic from our previous fix
                const fixedId = `${clanName}_${memberName}`; 
                await setDoc(doc(db, "users", fixedId), {
                    displayName: memberName,
                    email: null,
                    clan: clanName,
                    role: "Member",
                    createdAt: new Date().toISOString(),
                    isManualAdd: true
                });

                alert(`✅ Successfully enlisted ${memberName} into ${clanName}.`);
                return true;
            } else {
                alert(`⚠️ ${memberName} is already in the roster.`);
            }
        }
    } catch (e) {
        console.error("Add Member Error:", e);
        alert("Operation Failed: " + e.message);
    }
    return false;
}

export async function removeMember(clanName, memberName) {
    if (!confirm(`⚠️ Are you sure you want to remove ${memberName} from ${clanName}?`)) return false;

    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const structure = docSnap.data().structure;
            if (structure[clanName]) {
                structure[clanName] = structure[clanName].filter(m => m !== memberName);
                await updateDoc(docRef, { structure });
                return true;
            }
        }
    } catch (e) {
        console.error("Remove Member Error:", e);
        alert("Operation Failed: " + e.message);
    }
    return false;
}

/**
 * 🔒 SECURED: Creates a new, empty Clan.
 * ONLY Super Admins can do this.
 */
export async function createNewClan(clanName) {
    // 🛡️ SECURITY CHECK
    if (!await verifySuperAdmin()) return false;

    if (!clanName) return false;

    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const structure = docSnap.data().structure;
            
            if (!structure[clanName]) {
                structure[clanName] = [];
                await updateDoc(docRef, { structure });
                return true;
            } else {
                alert("Clan already exists!");
            }
        }
    } catch (e) {
        console.error("Create Clan Error:", e);
        alert("Operation Failed: " + e.message);
    }
    return false;
}

// ---------------------------------------------------------
// 3. RECOVERY (Disaster Management)
// ---------------------------------------------------------

/**
 * 🔒 SECURED: Restores the entire database.
 * ONLY Super Admins can do this.
 */
export async function seedDatabase() {
    // 🛡️ SECURITY CHECK
    if (!await verifySuperAdmin()) return false;

    if (!confirm("⚠️ DANGER: This will overwrite the current Clan Roster with the Factory Backup.\n\nAre you sure?")) return;
    
    try {
        const backupRef = doc(db, "system_config", "backup_structure");
        const backupSnap = await getDoc(backupRef);
        
        if (!backupSnap.exists()) {
            alert("❌ Critical Error: No Backup found in Database.");
            return;
        }

        const liveRef = doc(db, "system_config", "clans");
        await setDoc(liveRef, { structure: backupSnap.data().structure });
        
        alert("✅ System Restored.");
        window.location.reload();

    } catch (e) {
        console.error("Reset Error:", e);
        alert("Reset Failed. Check console for details.");
    }
}