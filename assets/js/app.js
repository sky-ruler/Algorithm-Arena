import { db, auth } from './firebase-init.js';
import { ADMIN_EMAIL, OWNER_EMAIL } from './api-keys.js';
import { smartParseLinks } from './utils.js';
import { fetchClanStructure, addMemberToClan, removeMember, createNewClan, seedDatabase } from './admin.js';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

let CLAN_DATA = {}; 
let latestStore = {}; // <--- ADD THIS LINE (Stores the data)
let currentUser = null;
let isAdmin = false;

const els = {
    authModal: document.getElementById('authModal'),
    editModal: document.getElementById('editModal'),
    landing: document.getElementById('landing'), // NEW HERO SECTION
    superPanel: document.getElementById('superuserPanel'),
    navActions: document.getElementById('navActions'),
    dashboard: document.getElementById('dashboard'),
    teamsContainer: document.getElementById('teamsContainer'),
    loader: document.getElementById('loader'),
    uploadSelect: document.getElementById('uploadSelect')
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 System Online");
    
    // 1. ALWAYS LOAD DATA (Public Read is enabled!)
    CLAN_DATA = await fetchClanStructure();
    initDropdowns();
    loadData(); // Start loading the feed immediately for everyone
    setupEventListeners();
    
    // 2. CHECK AUTH
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateUI(user);
    });
});

function setupEventListeners() {
    // Auth
    document.getElementById('btnLoginOpen')?.addEventListener('click', () => toggleModal(els.authModal, true));
    document.querySelector('#authModal button.absolute')?.addEventListener('click', () => toggleModal(els.authModal, false));
    document.getElementById('tabLogin')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tabSignup')?.addEventListener('click', () => switchAuthTab('signup'));
    
    // Actions
    document.querySelector('#loginForm button')?.addEventListener('click', performLogin);
    document.querySelector('#signupForm button')?.addEventListener('click', performSignup);
    document.getElementById('btnUpload')?.addEventListener('click', parseAndUpload);
    document.querySelector('#editModal button.bg-indigo-600')?.addEventListener('click', saveEdit);
    document.querySelector('#editModal button.text-slate-400')?.addEventListener('click', () => toggleModal(els.editModal, false));

    // Superuser
    if(els.superPanel) {
        document.getElementById('btnAddClan')?.addEventListener('click', handleAddClan);
        document.getElementById('btnAddMember')?.addEventListener('click', handleAddMember);
        document.getElementById('btnSeedDatabase')?.addEventListener('click', seedDatabase);
    }
}

// ==========================================
// AUTH & UI LOGIC (Updated for Hero Section)
// ==========================================

function updateUI(user) {
    if (!els.navActions) return;

    if (user) {
        // --- LOGGED IN ---
        
        // 1. Check Permissions
        isAdmin = ADMIN_EMAIL.includes(user.email);
        const isOwner = (user.email === OWNER_EMAIL); 
        
        // 2. UI Updates
        els.landing.classList.add('hidden');
        els.dashboard.classList.remove('hidden');
        
        // 3. Navbar
        els.navActions.innerHTML = `
            <div class="flex gap-3 items-center">
                ${isOwner ? '<button id="btnOpenSuper" class="text-xs bg-indigo-900 text-indigo-400 px-3 py-1 rounded hover:bg-indigo-800 transition">SUPER</button>' : ''}
                <span class="text-xs text-slate-400 hidden sm:inline">${user.email}</span>
                <button id="btnLogout" class="text-xs text-red-400 px-3 py-1 rounded border border-red-900 hover:bg-red-900/20 transition">LOGOUT</button>
            </div>`;
            
        document.getElementById('btnLogout').addEventListener('click', performLogout);
        
        if(isOwner) {
            document.getElementById('btnOpenSuper').addEventListener('click', () => els.superPanel.classList.toggle('hidden'));
        }
        
        document.getElementById('welcomeMsg').innerText = `Welcome, ${user.displayName || 'Warrior'}`;
        setupUploadDropdown();

        // 4. *** FORCE RE-RENDER ***
        // This is the magic line that makes the Delete buttons appear instantly!
        renderUI(latestStore); 

    } else {
        // --- LOGGED OUT (VISITOR) ---
        isAdmin = false;
        
        els.landing.classList.remove('hidden');
        els.dashboard.classList.add('hidden');
        els.superPanel?.classList.add('hidden');
        
        els.navActions.innerHTML = `<button id="btnLoginOpen" class="bg-slate-800 text-white px-4 py-2 rounded text-xs">LOGIN</button>`;
        document.getElementById('btnLoginOpen').addEventListener('click', () => toggleModal(els.authModal, true));

        // Force re-render to hide buttons if they were visible
        renderUI(latestStore);
    }
}

// ... (KEEP ALL OTHER FUNCTIONS EXACTLY THE SAME: performLogin, performSignup, loadData, renderUI, etc.) ...
// For brevity, assume the rest of the file below is identical to the previous version
// COPY-PASTE THE REST OF THE FUNCTIONS FROM THE PREVIOUS TURN HERE
// (performLogin, performSignup, performLogout, loadData, parseAndUpload, saveEdit, renderUI, window globals, helpers)

// --- SUPERUSER ---
async function handleAddClan() {
    const name = prompt("Enter New Clan Name:");
    if(name) { await createNewClan(name); window.location.reload(); }
}
async function handleAddMember() {
    const c = prompt("Clan Name:"); const m = prompt("Member Name:");
    if(c && m) { if(await addMemberToClan(c, m)) window.location.reload(); else alert("Failed"); }
}
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

function loadData() {
    if (!db) return;
    onSnapshot(collection(db, "submissions"), (snap) => {
        const store = {};
        snap.forEach(doc => store[doc.id] = doc.data().history || []);
        
        latestStore = store; // <--- ADD THIS LINE (Save data globally)
        
        renderUI(store);
        if(els.loader) els.loader.classList.add('hidden');
        if(els.teamsContainer) els.teamsContainer.classList.remove('hidden');
    });
}

async function parseAndUpload() {
    // 1. Basic Checks
    if(!currentUser) return alert("Login required");
    
    const btn = document.getElementById('btnUpload'); // Get the button
    const m = els.uploadSelect.value;
    const t = document.getElementById('rawInput').value;
    const r = document.getElementById('uploadReview').value;
    
    if(!m || !t) return alert("Missing Data");

    // 2. LOCK THE BUTTON (Prevents Double Click)
    btn.disabled = true;
    btn.innerText = "⏳ UPLOADING...";
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";

    try {
        // 3. YOUR ORIGINAL PARSING LOGIC (Untouched)
        const links = smartParseLinks(t);
        console.log("Parsed:", links);

        if (links.length === 0 && !confirm("No links found. Upload anyway?")) {
            // If user cancels, we must unlock the button before returning!
            throw new Error("Cancelled by user");
        }
        
        const day = t.split('\n')[0].replace(/http.*/,'').trim() || "Update";
        const entry = { 
            id: Date.now().toString(), 
            day, 
            links, 
            review: r, 
            timestamp: new Date().toISOString(), 
            author: currentUser.email 
        };
        
        // 4. UPLOAD
        const ref = doc(db, "submissions", m);
        const s = await getDoc(ref);
        
        if(s.exists()) await updateDoc(ref, { history: arrayUnion(entry) });
        else await setDoc(ref, { history: [entry] });
        
        alert("Upload Successful"); 
        document.getElementById('rawInput').value = "";
        document.getElementById('uploadReview').value = "";

    } catch(err) {
        // Ignore "Cancelled by user" error, alert others
        if (err.message !== "Cancelled by user") {
            alert("Error: " + err.message);
        }
    } finally {
        // 5. ALWAYS UNLOCK BUTTON (Even if error or success)
        btn.disabled = false;
        btn.innerText = "UPLOAD UPDATE";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    }
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

// REPLACE THE OLD function renderUI(store) WITH THIS:
function renderUI(store) {
    const c = els.teamsContainer; if(!c) return; c.innerHTML = '';
    
    // 1. Sort Clans Logic
    const sortedClans = Object.entries(CLAN_DATA).sort((a, b) => {
        const numA = parseInt(a[0].replace(/\D/g, '')) || 0;
        const numB = parseInt(b[0].replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    for (const [t, m] of sortedClans) {
        // 2. Create Clan Section
        const d = document.createElement('div');
        d.innerHTML = `<div class="flex items-center gap-4 mb-6"><div class="bg-indigo-600 w-1 h-8 rounded-r"></div><h2 class="text-2xl font-bold text-white">${t}</h2><div class="h-px bg-slate-800 flex-grow"></div></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="grid-${t.replace(/\s/g,'')}"></div>`;
        const g = d.querySelector(`div[id*="grid-"]`);
        
        m.forEach(mem => {
            const h = (store[mem] || []).reverse();
            const card = document.createElement('div');
            card.className = "glass rounded-xl overflow-hidden flex flex-col h-[500px]";
            
            // 3. Card Header
            card.innerHTML = `<div class="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between"><h3 class="font-bold text-white">${mem}</h3>${isAdmin ? `<button class="text-[10px] text-red-400" onclick="window.removeMemberGlobal('${t}','${mem}')">✕</button>` : ''}</div><div class="p-4 overflow-y-auto custom-scroll flex-grow"></div>`;
            const l = card.querySelector('.custom-scroll');

            // 4. "No Data" State
            if (h.length === 0) {
                l.innerHTML = '<div class="text-center py-8 opacity-50"><div class="text-2xl mb-2">⚔️</div><div class="text-xs text-slate-400 font-mono">No battles fought yet.</div></div>';
            }

            // 5. Render Each Post
            h.forEach(e => {
                // FILTER: Hide deleted posts from normal users
                if (e.deletedBy && !isAdmin) return;

                // STYLE: Red background if deleted
                const isDeleted = !!e.deletedBy;
                const bgClass = isDeleted ? "bg-red-900/10 border-red-900/50 grayscale opacity-70" : "bg-slate-900/80 border-slate-700";
                
                const r = document.createElement('div');
                r.className = `${bgClass} p-3 mb-3 rounded border relative group transition-all`;
                
                const safeLinks = encodeURIComponent(JSON.stringify(e.links));
                
                // PERMISSIONS: Can Edit/Delete?
                const canEdit = (isAdmin || (currentUser && currentUser.displayName === mem)) && !isDeleted;
                const canDelete = isAdmin && !isDeleted;

                // HEADER HTML
                let headerHTML = `<div class="flex justify-between mb-2">`;
                
                if (isDeleted) {
                    // Show WHO deleted it (Only Admins see this)
                    const deleterName = e.deletedBy.split('@')[0];
                    headerHTML += `<span class="text-red-400 font-bold text-[10px] uppercase">🗑️ DELETED BY: ${deleterName}</span>`;
                } else {
                    headerHTML += `<span class="text-indigo-400 font-bold text-[10px] uppercase">${e.day}</span>`;
                }

                // ACTION BUTTONS (Edit / Delete)
                headerHTML += `<div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">`;
                if (canEdit) {
                    headerHTML += `<button onclick="window.openEditModal('${mem}','${e.id||e.timestamp}','${e.day}','${safeLinks}','${e.review||''}')" class="text-blue-400 text-xs hover:text-white">✎</button>`;
                }
                if (canDelete) {
                    // THE NEW DELETE BUTTON
                    headerHTML += `<button onclick="window.deleteSubmissionGlobal('${mem}','${e.id||e.timestamp}')" class="text-red-500 text-xs hover:text-red-300">🗑️</button>`;
                }
                headerHTML += `</div></div>`;
                
                r.innerHTML = headerHTML;

                // LINKS CONTENT
                if (!isDeleted) {
                    e.links.forEach(link => {
                        r.innerHTML += `<a href="${link.url}" target="_blank" class="block text-xs text-slate-300 hover:text-white truncate transition-colors">>> ${link.label}</a>`;
                    });
                } else {
                    r.innerHTML += `<div class="text-[10px] text-red-300/50 italic">Content hidden from students</div>`;
                }

                l.appendChild(r);
            });
            g.appendChild(card);
        });
        c.appendChild(d);
    }
}

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

function initDropdowns() {
    const s = document.getElementById('signupName'); if(!s) return; s.innerHTML = '<option value="">-- Identity --</option>';
    for(const [t,m] of Object.entries(CLAN_DATA)) { const g=document.createElement('optgroup'); g.label=t; m.forEach(x=>{const o=new Option(x,x); g.appendChild(o); s.appendChild(o);}); }
}
function setupUploadDropdown() {
    const s = els.uploadSelect; if(!s) return; s.innerHTML = '';
    if(isAdmin) { s.innerHTML='<option value="">-- Select Member --</option>'; for(const [t,m] of Object.entries(CLAN_DATA)) { const g=document.createElement('optgroup'); g.label=t; m.forEach(x=>{const o=new Option(x,x); g.appendChild(o); s.appendChild(o);}); } }
    else if(currentUser?.displayName) { s.add(new Option(currentUser.displayName, currentUser.displayName)); s.disabled=true; }
}
function toggleModal(m,s) { s ? m.classList.remove('hidden') : m.classList.add('hidden'); }
function switchAuthTab(mode) {
    const l = mode==='login';
    document.getElementById('loginForm').classList.toggle('hidden', !l);
    document.getElementById('signupForm').classList.toggle('hidden', l);
}

// PASTE THIS AT THE VERY BOTTOM OF THE FILE
window.deleteSubmissionGlobal = async (memberName, submissionId) => {
    if(!confirm("⚠️ Are you sure? This will hide the post and log your name.")) return;

    // Use the member's name (which is the document ID)
    const ref = doc(db, "submissions", memberName);
    
    try {
        const s = await getDoc(ref);
        if (!s.exists()) return;

        let h = s.data().history;
        
        // Find the exact post by ID or Timestamp
        const i = h.findIndex(x => (x.id === submissionId || x.timestamp === submissionId));
        
        if(i > -1) {
            // SOFT DELETE: Mark it instead of removing it!
            h[i].deletedBy = currentUser.email; 
            h[i].deletedAt = new Date().toISOString();
            
            await updateDoc(ref, { history: h });
            alert("🗑️ Post deleted. Logged as deleted by you.");
        } else {
            alert("Error: Could not find that post.");
        }
    } catch(e) { 
        console.error(e);
        alert("Delete failed: " + e.message); 
    }
};