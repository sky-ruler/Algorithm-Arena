import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ---------------------------------------------------------
// 1. READ OPERATIONS (Fetching Data)
// ---------------------------------------------------------

/**
 * Fetches the Master Clan Roster from Firestore.
 * This contains the 9 Clans and all 81+ members dynamically.
 */
export async function fetchClanStructure() {
    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().structure;
        } else {
            console.warn("⚠️ System Config Missing. Database might be empty.");
            return {}; 
        }
    } catch (error) {
        console.error("CRITICAL: Failed to fetch clan structure.", error);
        return {};
    }
}

/**
 * Fetches the Authority Matrix (Super Admins, Chiefs).
 */
export async function fetchSystemRoles() {
    try {
        const docRef = doc(db, "system_config", "roles");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return { super_admins: [], general_admins: [], clan_chiefs: {} };
        }
    } catch (error) {
        console.error("CRITICAL: Failed to fetch roles.", error);
        return { super_admins: [], general_admins: [], clan_chiefs: {} };
    }
}

// ---------------------------------------------------------
// 2. WRITE OPERATIONS (Modifying the Roster)
// ---------------------------------------------------------

/**
 * Adds a new member to a specific Clan.
 * AUTOMATICALLY creates a "Placeholder" identity for them to claim.
 */
/**
 * Adds a new member to a specific Clan.
 * CORRECTED: Uses "Clan_Name" ID format so users can actually claim this spot.
 */
export async function addMemberToClan(clanName, memberName) {
    if (!clanName || !memberName) return false;
    
    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const structure = docSnap.data().structure;
            if (!structure[clanName]) structure[clanName] = [];
            
            if (!structure[clanName].includes(memberName)) {
                structure[clanName].push(memberName);
                
                // 1. Update Roster
                await updateDoc(docRef, { structure });
                
                // 2. Create Claimable Placeholder (FIXED ID FORMAT)
                // NOW matches the logic in app.js
                const fixedId = `${clanName}_${memberName}`; 
                
                await setDoc(doc(db, "users", fixedId), {
                    displayName: memberName,
                    email: null, // Waiting for claim
                    clan: clanName,
                    role: "Member",
                    createdAt: new Date().toISOString(),
                    isManualAdd: true
                });

                alert(`✅ ${memberName} added to ${clanName} (ID: ${fixedId})`);
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

/**
 * Removes a member from the Clan Roster.
 * Note: This does not delete their submission history, only their roster spot.
 */
export async function removeMember(clanName, memberName) {
    if (!confirm(`⚠️ Are you sure you want to remove ${memberName} from ${clanName}?`)) return false;

    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const structure = docSnap.data().structure;
            
            if (structure[clanName]) {
                // Filter out the member
                structure[clanName] = structure[clanName].filter(m => m !== memberName);
                
                await updateDoc(docRef, { structure });
                return true; // Success (Caller should reload page)
            }
        }
    } catch (e) {
        console.error("Remove Member Error:", e);
        alert("Operation Failed: " + e.message);
    }
    return false;
}

/**
 * Creates a new, empty Clan.
 */
export async function createNewClan(clanName) {
    if (!clanName) return false;

    try {
        const docRef = doc(db, "system_config", "clans");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const structure = docSnap.data().structure;
            
            if (!structure[clanName]) {
                structure[clanName] = []; // Empty array for new clan
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
 * Restores the entire database configuration from the Backup file.
 * Useful if the roster gets corrupted.
 */
export async function seedDatabase() {
    if (!confirm("⚠️ DANGER: This will overwrite the current Clan Roster with the Factory Backup.\n\nAre you sure?")) return;
    
    try {
        const backupRef = doc(db, "system_config", "backup_structure");
        const backupSnap = await getDoc(backupRef);
        
        if (!backupSnap.exists()) {
            alert("❌ Critical Error: No Backup found in Database. Please run the Genesis Script in Console.");
            return;
        }

        const liveRef = doc(db, "system_config", "clans");
        await setDoc(liveRef, { structure: backupSnap.data().structure });
        
        alert("✅ System Restored. The timeline has been reset.");
        window.location.reload();

    } catch (e) {
        console.error("Reset Error:", e);
        alert("Reset Failed. Check console for details.");
    }
}