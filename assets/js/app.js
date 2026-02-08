import { db, auth } from './firebase-init.js';
import { OWNER_EMAIL, GENERAL_ADMINS, CLAN_CAPTAINS } from './api-keys.js';
import { smartParseLinks } from './utils.js';
import { fetchClanStructure, addMemberToClan, removeMember, createNewClan, seedDatabase } from './admin.js';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// --- GLOBAL STATE ---
let CLAN_DATA = {}; 
let latestStore = {}; 
let currentUser = null;
let isAdmin = false; // Used ONLY for UI buttons (Delete/Edit), NOT for Dropdown logic

const els = {
    authModal: document.getElementById('authModal'),
    editModal: document.getElementById('editModal'),
    landing: document.getElementById('landing'),
    superPanel: document.getElementById('superuserPanel'),
    navActions: document.getElementById('navActions'),
    dashboard: document.getElementById('dashboard'),
    teamsContainer: document.getElementById('teamsContainer'),
    loader: document.getElementById('loader'),
    uploadSelect: document.getElementById('uploadSelect')
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 System Online | VERSION: 3.0 FIXED"); // Look for this in Console!
    
    // 1. ALWAYS LOAD DATA
    CLAN_DATA = await fetchClanStructure();
    initDropdowns();
    loadData(); 
    setupEventListeners();
    
    // 2. CHECK AUTH
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateUI(user);
    });
});

function setupEventListeners() {
    // Auth Triggers
    document.getElementById('btnLoginOpen')?.addEventListener('click', () => toggleModal(els.authModal, true));
    document.querySelector('#authModal button.absolute')?.addEventListener('click', () => toggleModal(els.authModal, false));
    document.getElementById('tabLogin')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tabSignup')?.addEventListener('click', () => switchAuthTab('signup'));
    
    // Core Actions
    document.querySelector('#loginForm button')?.addEventListener('click', performLogin);
    document.querySelector('#signupForm button')?.addEventListener('click', performSignup);
    document.getElementById('btnUpload')?.addEventListener('click', parseAndUpload);
    document.querySelector('#editModal button.bg-indigo-600')?.addEventListener('click', saveEdit);
    document.querySelector('#editModal button.text-slate-400')?.addEventListener('click', () => toggleModal(els.editModal, false));

    // Superuser Panel
    if(els.superPanel) {
        document.getElementById('btnAddClan')?.addEventListener('click', handleAddClan);
        document.getElementById('btnAddMember')?.addEventListener('click', handleAddMember);
        document.getElementById('btnSeedDatabase')?.addEventListener('click', seedDatabase);
    }
}

// ==========================================
// 🛡️ AUTH & UI LOGIC
// ==========================================

function updateUI(user) {
    if (!els.navActions) return;

    if (user) {
        // --- LOGGED IN ---
        const email = user.email.toLowerCase(); // Force lowercase for safety
        
        // 1. CALCULATE PERMISSIONS
        const isOwner = (email === OWNER_EMAIL.toLowerCase());
        const isGeneral = GENERAL_ADMINS.some(admin => admin.toLowerCase() === email);
        const managedClan = CLAN_CAPTAINS[email]; // Check specific clan map
        
        // "isAdmin" controls DELETE/EDIT buttons. 
        // Everyone in the hierarchy gets this, but Dropdown logic is separate!
        isAdmin = isOwner || isGeneral || !!managedClan;

        // 2. UI Updates
        els.landing.classList.add('hidden');
        els.dashboard.classList.remove('hidden');
        
        // 3. Build Navbar
        let roleBadge = '';
        if (isOwner) roleBadge = '<span class="text-[10px] bg-indigo-900 text-indigo-300 px-2 py-1 rounded border border-indigo-500">OWNER</span>';
        else if (isGeneral) roleBadge = '<span class="text-[10px] bg-purple-900 text-purple-300 px-2 py-1 rounded border border-purple-500">GENERAL</span>';
        else if (managedClan) roleBadge = `<span class="text-[10px] bg-slate-800 text-indigo-300 px-2 py-1 rounded border border-indigo-900/50">${managedClan} CAPTAIN</span>`;

        els.navActions.innerHTML = `
            <div class="flex gap-3 items-center">
                ${isOwner ? '<button id="btnOpenSuper" class="text-xs bg-indigo-900 text-indigo-400 px-3 py-1 rounded hover:bg-indigo-800 transition">SUPER</button>' : ''}
                <span class="text-xs text-slate-400 hidden sm:inline">${user.email}</span>
                ${roleBadge}
                <button id="btnLogout" class="text-xs text-red-400 px-3 py-1 rounded border border-red-900 hover:bg-red-900/20 transition">LOGOUT</button>
            </div>`;
            
        document.getElementById('btnLogout').addEventListener('click', performLogout);
        
        if(isOwner) {
            document.getElementById('btnOpenSuper').addEventListener('click', () => els.superPanel.classList.toggle('hidden'));
        }
        
        document.getElementById('welcomeMsg').innerText = `Welcome, ${user.displayName || 'Warrior'}`;
        
        // 4. CRITICAL: Setup Dropdown based on strict roles
        setupUploadDropdown();
        
        // 5. Refresh List (to show Delete buttons if applicable)
        renderUI(latestStore);

    } else {
        // --- LOGGED OUT ---
        isAdmin = false;
        currentUser = null;
        
        els.landing.classList.remove('hidden');
        els.dashboard.classList.add('hidden');
        els.superPanel?.classList.add('hidden');
        
        els.navActions.innerHTML = `<button id="btnLoginOpen" class="bg-slate-800 text-white px-4 py-2 rounded text-xs">LOGIN</button>`;
        document.getElementById('btnLoginOpen').addEventListener('click', () => toggleModal(els.authModal, true));
        
        renderUI(latestStore);
    }
}

// ==========================================
// 💧 THE FIXED DROPDOWN LOGIC
// ==========================================
function setupUploadDropdown() {
    const s = els.uploadSelect; if(!s) return; s.innerHTML = '';
    
    if (!currentUser) return;

    const email = currentUser.email.toLowerCase();
    
    // RE-CALCULATE ROLES LOCALLY (Do not trust global variables)
    const isOwner = (email === OWNER_EMAIL.toLowerCase());
    const isGeneral = GENERAL_ADMINS.some(admin => admin.toLowerCase() === email);
    // Important: 'CLAN_CAPTAINS' keys must match exactly.
    // Ideally, ensure your api-keys.js emails are lowercase too.
    const myClan = CLAN_CAPTAINS[email] || CLAN_CAPTAINS[currentUser.email]; 

    console.log(`Dropdown Debug -> User: ${email} | Owner: ${isOwner} | General: ${isGeneral} | Captain of: ${myClan}`);

    if (isOwner || isGeneral) {
        // CASE A: GOD MODE (Show Everyone)
        s.innerHTML = '<option value="">-- Select Any Member --</option>';
        for(const [t,m] of Object.entries(CLAN_DATA)) { 
            const g = document.createElement('optgroup'); g.label = t; 
            m.forEach(x => g.appendChild(new Option(x, x)));
            s.appendChild(g);
        }
    } 
    else if (myClan) {
        // CASE B: CLAN CAPTAIN (Show Only My Clan)
        s.innerHTML = `<option value="">-- Select ${myClan} Member --</option>`;
        const members = CLAN_DATA[myClan] || [];
        const g = document.createElement('optgroup'); g.label = myClan;
        members.forEach(x => g.appendChild(new Option(x, x)));
        s.appendChild(g);
    } 
    else if (currentUser.displayName) {
        // CASE C: STUDENT (Show Only Self)
        s.add(new Option(currentUser.displayName, currentUser.displayName)); 
        s.disabled = true; 
    }
}

// ==========================================
// 🔒 SECURE UPLOAD FUNCTION
// ==========================================
async function parseAndUpload() {
    if(!currentUser) return alert("Login required");
    
    const btn = document.getElementById('btnUpload');
    const m = els.uploadSelect.value;
    const t = document.getElementById('rawInput').value;
    const r = document.getElementById('uploadReview').value;
    
    if(!m || !t) return alert("Missing Data");

    // --- SECURITY CHECK START ---
    const email = currentUser.email.toLowerCase();
    let targetClan = "";
    
    // Find Target's Clan
    for (const [cName, members] of Object.entries(CLAN_DATA)) {
        if (members.includes(m)) { targetClan = cName; break; }
    }

    const isSelf = (currentUser.displayName === m);
    const isOwner = (email === OWNER_EMAIL.toLowerCase());
    const isGeneral = GENERAL_ADMINS.some(x => x.toLowerCase() === email);
    const managedClan = CLAN_CAPTAINS[email] || CLAN_CAPTAINS[currentUser.email];
    const isCaptain = (managedClan === targetClan);

    if (!isSelf && !isOwner && !isGeneral && !isCaptain) {
        alert(`⛔ PERMISSION DENIED.\nYou cannot upload for members of ${targetClan}.`);
        return;
    }
    // --- SECURITY CHECK END ---

    btn.disabled = true; btn.innerText = "⏳ UPLOADING..."; btn.classList.add("opacity-50", "cursor-not-allowed");

    try {
        const links = smartParseLinks(t);
        if (links.length === 0 && !confirm("No links found. Upload anyway?")) throw new Error("Cancelled by user");
        
        const day = t.split('\n')[0].replace(/http.*/,'').trim() || "Update";
        const entry = { 
            id: Date.now().toString(), 
            day, links, review: r, 
            timestamp: new Date().toISOString(), 
            author: currentUser.email 
        };
        
        const ref = doc(db, "submissions", m);
        const s = await getDoc(ref);
        
        if(s.exists()) await updateDoc(ref, { history: arrayUnion(entry) });
        else await setDoc(ref, { history: [entry] });
        
        alert("✅ Success!"); 
        document.getElementById('rawInput').value = "";
        document.getElementById('uploadReview').value = "";

    } catch(err) {
        if (err.message !== "Cancelled by user") alert("Error: " + err.message);
    } finally {
        btn.disabled = false; btn.innerText = "UPLOAD UPDATE"; btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
}

// ==========================================
// CORE DATA & RENDERING
// ==========================================
function loadData() {
    if (!db) return;
    onSnapshot(collection(db, "submissions"), (snap) => {
        const store = {};
        snap.forEach(doc => store[doc.id] = doc.data().history || []);
        latestStore = store; 
        renderUI(store);
        if(els.loader) els.loader.classList.add('hidden');
        if(els.teamsContainer) els.teamsContainer.classList.remove('hidden');
    });
}

function renderUI(store) {
    const c = els.teamsContainer; if(!c) return; c.innerHTML = '';
    
    // Sort Clans
    const sortedClans = Object.entries(CLAN_DATA).sort((a, b) => {
        const numA = parseInt(a[0].replace(/\D/g, '')) || 0;
        const numB = parseInt(b[0].replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    // Resolve Permissions for Buttons
    const email = currentUser ? currentUser.email.toLowerCase() : "";
    const isOwner = (email === OWNER_EMAIL.toLowerCase());
    const isGeneral = GENERAL_ADMINS.some(x => x.toLowerCase() === email);
    const managedClan = CLAN_CAPTAINS[email] || CLAN_CAPTAINS[currentUser?.email];

    for (const [t, m] of sortedClans) {
        // Can this user manage THIS clan?
        const canManageClan = isOwner || isGeneral || (managedClan === t);

        const d = document.createElement('div');
        d.innerHTML = `<div class="flex items-center gap-4 mb-6"><div class="bg-indigo-600 w-1 h-8 rounded-r"></div><h2 class="text-2xl font-bold text-white">${t}</h2><div class="h-px bg-slate-800 flex-grow"></div></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="grid-${t.replace(/\s/g,'')}"></div>`;
        const g = d.querySelector(`div[id*="grid-"]`);
        
        m.forEach(mem => {
            const h = (store[mem] || []).reverse();
            const card = document.createElement('div');
            card.className = "glass rounded-xl overflow-hidden flex flex-col h-[500px]";
            
            // REMOVE MEMBER BUTTON
            card.innerHTML = `<div class="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between"><h3 class="font-bold text-white">${mem}</h3>${canManageClan ? `<button class="text-[10px] text-red-400" onclick="window.removeMemberGlobal('${t}','${mem}')">✕</button>` : ''}</div><div class="p-4 overflow-y-auto custom-scroll flex-grow"></div>`;
            const l = card.querySelector('.custom-scroll');

            if (h.length === 0) {
                l.innerHTML = '<div class="text-center py-8 opacity-50"><div class="text-2xl mb-2">⚔️</div><div class="text-xs text-slate-400 font-mono">No battles fought yet.</div></div>';
            }

            h.forEach(e => {
                // VISIBILITY: Hide deleted posts from Students
                if (e.deletedBy && !canManageClan) return;

                const isDeleted = !!e.deletedBy;
                const bgClass = isDeleted ? "bg-red-900/10 border-red-900/50 grayscale opacity-70" : "bg-slate-900/80 border-slate-700";
                
                const r = document.createElement('div');
                r.className = `${bgClass} p-3 mb-3 rounded border relative group transition-all`;
                
                // BUTTON PERMISSIONS
                const canEdit = (canManageClan || (currentUser && currentUser.displayName === mem)) && !isDeleted;
                const canDelete = canManageClan && !isDeleted;

                let headerHTML = `<div class="flex justify-between mb-2">`;
                if (isDeleted) {
                    headerHTML += `<span class="text-red-400 font-bold text-[10px] uppercase">🗑️ BY: ${e.deletedBy.split('@')[0]}</span>`;
                } else {
                    headerHTML += `<span class="text-indigo-400 font-bold text-[10px] uppercase">${e.day}</span>`;
                }

                headerHTML += `<div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">`;
                
                // EDIT BUTTON
                if (canEdit) {
                    const safeLinks = encodeURIComponent(JSON.stringify(e.links));
                    headerHTML += `<button onclick="window.openEditModal('${mem}','${e.id||e.timestamp}','${e.day}','${safeLinks}','${e.review||''}')" class="text-blue-400 text-xs hover:text-white">✎</button>`;
                }
                // DELETE BUTTON
                if (canDelete) {
                    headerHTML += `<button onclick="window.deleteSubmissionGlobal('${mem}','${e.id||e.timestamp}')" class="text-red-500 text-xs hover:text-red-300">🗑️</button>`;
                }
                
                headerHTML += `</div></div>`;
                r.innerHTML = headerHTML;

                // LINKS
                if (!isDeleted) {
                    e.links.forEach(link => {
                        r.innerHTML += `<a href="${link.url}" target="_blank" class="block text-xs text-slate-300 hover:text-white truncate transition-colors">>> ${link.label}</a>`;
                    });
                } else {
                    r.innerHTML += `<div class="text-[10px] text-red-300/50 italic">Hidden</div>`;
                }
                l.appendChild(r);
            });
            g.appendChild(card);
        });
        c.appendChild(d);
    }
}

// ==========================================
// HELPERS & MODALS
// ==========================================
async function performLogin() {
    try { await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value); toggleModal(els.authModal, false); } 
    catch (err) { alert(err.message); }
}
async function performSignup() {
    const name = document.getElementById('signupName').value;
    if(!name) return alert("Select Identity");
    try {
        const cred = await createUserWithEmailAndPassword(auth, document.getElementById('signupEmail').value, document.getElementById('signupPass').value);
        await updateProfile(cred.user, { displayName: name });
        window.location.reload();
    } catch (err) { alert(err.message); }
}
async function performLogout() { await signOut(auth); window.location.reload(); }

async function handleAddClan() {
    const name = prompt("Enter New Clan Name:");
    if(name) { await createNewClan(name); window.location.reload(); }
}
async function handleAddMember() {
    const c = prompt("Clan Name:"); const m = prompt("Member Name:");
    if(c && m) { if(await addMemberToClan(c, m)) window.location.reload(); else alert("Failed"); }
}

async function saveEdit() {
    const m = document.getElementById('editMemberName').value;
    const id = document.getElementById('editTimestamp').value;
    const ref = doc(db, "submissions", m);
    try {
        const s = await getDoc(ref);
        const h = s.data().history;
        const i = h.findIndex(x => x.id === id || x.timestamp === id);
        if(i > -1) {
            h[i].day = document.getElementById('editDay').value;
            h[i].review = document.getElementById('editReview').value;
            h[i].links = smartParseLinks(document.getElementById('editLinksRaw').value);
            await updateDoc(ref, { history: h });
            toggleModal(els.editModal, false);
            alert("Updated!");
        }
    } catch(e) { alert("Update failed: " + e.message); }
}

function initDropdowns() {
    const s = document.getElementById('signupName'); if(!s) return; s.innerHTML = '<option value="">-- Identity --</option>';
    for(const [t,m] of Object.entries(CLAN_DATA)) { const g=document.createElement('optgroup'); g.label=t; m.forEach(x=>{const o=new Option(x,x); g.appendChild(o); s.appendChild(o);}); }
}
function toggleModal(m,s) { s ? m.classList.remove('hidden') : m.classList.add('hidden'); }
function switchAuthTab(mode) {
    const l = mode==='login';
    document.getElementById('loginForm').classList.toggle('hidden', !l);
    document.getElementById('signupForm').classList.toggle('hidden', l);
}

// WINDOW GLOBALS
window.openEditModal = (m, id, day, l, r) => {
    document.getElementById('editMemberName').value = m;
    document.getElementById('editTimestamp').value = id;
    document.getElementById('editDay').value = day;
    document.getElementById('editReview').value = r;
    const links = JSON.parse(decodeURIComponent(l));
    document.getElementById('editLinksRaw').value = links.map(x => `${x.label} - ${x.url}`).join('\n');
    toggleModal(els.editModal, true);
};
window.removeMemberGlobal = async (c, m) => { if(await removeMember(c, m)) window.location.reload(); };
window.deleteSubmissionGlobal = async (memberName, submissionId) => {
    if(!confirm("⚠️ Are you sure? This will hide the post and log your name.")) return;
    const ref = doc(db, "submissions", memberName);
    try {
        const s = await getDoc(ref);
        if (!s.exists()) return;
        let h = s.data().history;
        const i = h.findIndex(x => (x.id === submissionId || x.timestamp === submissionId));
        if(i > -1) {
            h[i].deletedBy = currentUser.email; 
            h[i].deletedAt = new Date().toISOString();
            await updateDoc(ref, { history: h });
            alert("🗑️ Post deleted.");
        }
    } catch(e) { console.error(e); alert("Delete failed: " + e.message); }
};