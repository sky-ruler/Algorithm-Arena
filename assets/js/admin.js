import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// --- THE DATA TO SEED ---
const STARTER_DATA = {
    "Clan 1": ["Nishant Kumar", "Nirakar Patel", "Piyush Kumar", "Omm Prakash Rout", "Jiru Pranita Krishna Reddy", "Kriti Sreyasha Parida", "Shobhini Upadhyay", "Shreya Patel", "Akash Pattnaik"],
    "Clan 2": ["G Jaganmohan Achary", "Jitesh Choudhury", "Rajshree Balsamant", "Anish Sahoo", "Subh Ranjan Mishra", "Rounak Kumar Mahato", "Rashmi Anand", "Sashwat Mishra", "Sahil Saha"],
    "Clan 3": ["Mrinall Samal", "Asmit Gupta", "K.Rohan Achary", "Mandeep Ray", "Riddhima Singh", "Vivek Kumar", "Shradha Shrivastava", "Nikhil Kumar", "Sritam Das"],
    "Clan 4": ["Ahana De", "Amaresh Swain", "Sayak Mondal", "Kalyan Jyoti Mishra", "Sanyukt Kumar Rai", "Chitreshwar Choudhury", "Priyanka Rath", "Rohit Kumar", "Aastha Singh"],
    "Clan 5": ["Ankita Mohapatra", "Riya Patnaik", "Nandita Sahoo", "Yash Agrawal", "Soham Banerjee", "Renesha Goswami", "Rishav Singh", "Siddhant Satyajeet Jena", "Miraj Patra"],
    "Clan 6": ["Arman Panda", "Ayush Kumar Singh", "Sanket Nayak", "Rajanyak Das", "Ayan Bhattacharjee", "Sneha Maurya", "Bharat Bhusan Mohanta", "Jitesh Mohanty", "Aslesha Brahma"],
    "Clan 7": ["Ritesh Kumar", "Amrit Arya", "Priyanshu Chandra", "Nandish Sinha", "Sukanya Beuria", "Swayansh Prusty", "Debasis Das", "Nandini Mishra", "Harsh Kumar"],
    "Clan 8": ["Srideep Kundu", "Sampriti Biswas", "Manya Bhardwaj", "Ashutosh Padhi", "Arpit Kumar Maurya", "Atharv Sunil Patole", "Abdul Naved Ul Haq", "Anil Kumar Jena", "Anshuman Nayak"],
    "Clan 9": ["Mili Gupta", "Barsha Pradhan", "Jayita Mondal", "Subham Pattnaik", "Tanisha Dash", "Partho Prateem Satapathy", "Debayan Kar", "Waiz Alam", "Sushruta Kar"]
};

// 1. SEED FUNCTION (Run this via Button)
export async function seedDatabase() {
    if(!confirm("⚠️ This will overwrite the CLAN LIST in the database. Continue?")) return;
    
    try {
        await setDoc(doc(db, "settings", "clanConfig"), { clans: STARTER_DATA }, { merge: true });
        alert("✅ SUCCESS: Database has been seeded! Refreshing page...");
        window.location.reload();
    } catch (e) {
        console.error("Seeding Error:", e);
        alert("Error: " + e.message);
    }
}

// 2. FETCH
export async function fetchClanStructure() {
    try {
        const docRef = doc(db, "settings", "clanConfig");
        const snap = await getDoc(docRef);
        return snap.exists() ? (snap.data().clans || {}) : {};
    } catch (e) {
        console.error("Fetch Error:", e);
        return {};
    }
}

// 3. EDIT FUNCTIONS
export async function addMemberToClan(clanName, memberName) {
    if (!clanName || !memberName) return false;
    const docRef = doc(db, "settings", "clanConfig");
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(docRef);
            if (!docSnap.exists()) throw "Config missing";
            const structure = docSnap.data().clans || {};
            if (!structure[clanName]) structure[clanName] = [];
            if (!structure[clanName].includes(memberName)) {
                structure[clanName].push(memberName);
                t.update(docRef, { clans: structure });
            }
        });
        return true;
    } catch(e) { console.error(e); return false; }
}

export async function removeMember(clanName, memberName) {
    if (!confirm(`Remove ${memberName}?`)) return false;
    const docRef = doc(db, "settings", "clanConfig");
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(docRef);
            const structure = docSnap.data().clans || {};
            if (structure[clanName]) {
                structure[clanName] = structure[clanName].filter(m => m !== memberName);
                if (structure[clanName].length === 0) delete structure[clanName];
                t.update(docRef, { clans: structure });
            }
        });
        return true;
    } catch(e) { console.error(e); return false; }
}

export async function createNewClan(clanName) {
    const docRef = doc(db, "settings", "clanConfig");
    await setDoc(docRef, { clans: { [clanName]: [] } }, { merge: true });
    return true;
}