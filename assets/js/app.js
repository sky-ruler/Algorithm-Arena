import { db, auth } from './firebase-init.js';
import { smartParseLinks } from './utils.js';
import { fetchClanStructure, fetchSystemRoles, addMemberToClan, removeMember, createNewClan, seedDatabase } from './admin.js';
import { collection, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion, query, where, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

console.log("🚀 Warzone System: Booting...");

// =========================================================
// 1. CONFIG & STATE
// =========================================================
let UI_CONFIG = {}; 
let CLAN_DATA = {}; 
let ROLES_DATA = { super_admins: [], general_admins: [], clan_chiefs: {} };
let latestStore = {}; 
let currentUser = null;
let REGISTERED_MEMBERS = new Set(); 

const els = {
    authModal: document.getElementById('authModal'),
    navActions: document.getElementById('navActions'),
    landing: document.getElementById('landing'),
    dashboard: document.getElementById('dashboard'),
    teamsContainer: document.getElementById('teamsContainer'),
    loader: document.getElementById('loader'),
    uploadSelect: document.getElementById('uploadSelect'),
    navbar: document.querySelector('nav')
};

const getIST = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
const getSafeName = (user) => {
    if (!user) return "Unknown";
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1);
    return "Commander";
};

// =========================================================
// 2. INITIALIZATION
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    initPhysics(); 
    initTheme(); 
    await loadSystemConfiguration(); 
    subscribeToRegistry();
    loadSubmissions();
    setupEventListeners();
    onAuthStateChanged(auth, (user) => { currentUser = user; updateUI(user); });
});

async function loadSystemConfiguration() {
    try {
        const uiRef = doc(db, "system_config", "ui_content");
        const uiSnap = await getDoc(uiRef);
        if (uiSnap.exists()) { UI_CONFIG = uiSnap.data(); applyModularContent(); }
        CLAN_DATA = await fetchClanStructure();
        ROLES_DATA = await fetchSystemRoles(); 
    } catch (e) { console.error("Config Load Error:", e); }
}

function applyModularContent() {
    if(!UI_CONFIG) return;
    if(UI_CONFIG.appTitle) document.title = `${UI_CONFIG.appTitle} | ${UI_CONFIG.appSubtitle}`;
    const navT = document.getElementById('navTitle'); if(navT) navT.innerText = UI_CONFIG.appTitle || "Algorithm";
    const navS = document.getElementById('navSubtitle'); if(navS) navS.innerText = UI_CONFIG.appSubtitle || "Arena";
    const heroH = document.getElementById('heroHeadline'); if(heroH) heroH.innerHTML = UI_CONFIG.heroHeadline || "WELCOME";
    const heroSub = document.getElementById('heroSubtext'); if(heroSub) heroSub.innerText = UI_CONFIG.heroSubtext || "";
    // Only set HERO button text here, NOT Navbar
    const loginBtn = document.getElementById('heroLoginBtn'); if(loginBtn) loginBtn.innerText = UI_CONFIG.loginBtnText || "ENTER";
    const badgesContainer = document.getElementById('heroBadges'); if(badgesContainer && UI_CONFIG.badges) badgesContainer.innerHTML = UI_CONFIG.badges.map(b => `<span>${b}</span>`).join('');
    const guide = document.getElementById('formatGuideList'); if(guide && UI_CONFIG.formatGuide) guide.innerHTML = UI_CONFIG.formatGuide.map(g => `<li class="flex items-center gap-3"><span class="text-emerald-500">✓</span> ${g}</li>`).join('');
}

// =========================================================
// 3. UI LOGIC (Fixed Username Color & Icon)
// =========================================================

function getUserRoleLabel(email, displayName) {
    if (!email) return "Guest";
    const lowerEmail = email.toLowerCase();
    
    // 1. Super Admins (Checks Array)
    if (ROLES_DATA.super_admins.some(e => e.toLowerCase() === lowerEmail)) return "Super Admin";
    
    // 2. General Admins (Checks Array)
    if (ROLES_DATA.general_admins.some(e => e.toLowerCase() === lowerEmail)) return "General Admin";
    
    // 3. Clan Chiefs (UPDATED LOGIC)
    // Old: Key was Email. New: Value is Email.
    // We look for an entry where the VALUE matches the user's email.
    const chiefEntry = Object.entries(ROLES_DATA.clan_chiefs).find(([clanName, chiefEmail]) => 
        chiefEmail.toLowerCase() === lowerEmail
    );

    if (chiefEntry) {
        // chiefEntry[0] is now "Clan 1" (The Key)
        return `${chiefEntry[0]} Chief`; 
    }
    
    // 4. Member (Fallback)
    for (const [clan, members] of Object.entries(CLAN_DATA)) { 
        if (members.includes(displayName)) return `${clan} Member`; 
    }
    return "Member";
}

function updateUI(user) {
    if (!els.navActions) return;
    
    if (user) {
        // LOGGED IN
        const displayName = getSafeName(user);
        const roleLabel = getUserRoleLabel(user.email, displayName);
        const isOwner = roleLabel.includes("Admin");
        els.landing.classList.add('hidden');
        els.dashboard.classList.remove('hidden');
        
        // 🛡️ FIX: Added badge-role class to prevent wrapping
        els.navActions.innerHTML = `
            <div class="flex flex-col items-end mr-4">
                <span class="text-xs font-bold text-theme tracking-wide">${displayName}</span>
                <span class="badge-role">${roleLabel}</span>
            </div>
            ${isOwner ? '<button id="btnOpenSuper" class="btn btn-primary btn-sm h-9 w-9 p-0 flex items-center justify-center">⚡</button>' : ''}
            <button id="btnLogout" class="btn btn-danger btn-sm h-8 text-[10px]">LOGOUT</button>
        `;
        document.getElementById('btnLogout').addEventListener('click', async () => { await signOut(auth); window.location.reload(); });
        if(isOwner && document.getElementById('btnOpenSuper')) document.getElementById('btnOpenSuper').addEventListener('click', () => document.getElementById('superuserPanel').classList.toggle('hidden'));
        document.getElementById('welcomeMsg').innerText = `Greetings, ${displayName}`;
        populateUploadDropdown(user, roleLabel);
        renderUI(latestStore);

    } else {
        // LOGGED OUT
        els.landing.classList.remove('hidden');
        els.dashboard.classList.add('hidden');
        // 🛠️ FIXED: Hardcoded "LOGIN" so it doesn't duplicate Hero text
        els.navActions.innerHTML = `<button id="btnLoginOpen" class="btn btn-primary btn-sm px-4 shadow-lg shadow-indigo-500/20">LOGIN</button>`;
        document.getElementById('btnLoginOpen').addEventListener('click', () => window.toggleModal('authModal', true));
    }
}

// 🛠️ RENDER ENGINE
// 🛠️ RENDER ENGINE (Fixed Deletion Log Visibility)
function renderUI(store) {
    const c = els.teamsContainer; if(!c) return; c.innerHTML = '';
    const sorted = Object.entries(CLAN_DATA).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
    
    let myClan = null;
    if (currentUser) {
        const displayName = getSafeName(currentUser);
        const role = getUserRoleLabel(currentUser.email, displayName);
        if (role.includes("Chief")) myClan = role.replace(" Chief", "").replace("CLAN ", "Clan ");
        else { for (const [cl, ms] of Object.entries(CLAN_DATA)) { if (ms.includes(displayName)) { myClan = cl; break; } } }
    }
    if (myClan) {
        const idx = sorted.findIndex(x => x[0] === myClan);
        if (idx > -1) { const [t] = sorted.splice(idx, 1); sorted.unshift(t); }
    }

    for (const [t, m] of sorted) {
        const email = currentUser ? currentUser.email.toLowerCase() : "";
        const role = getUserRoleLabel(email);
        const isOwner = role.includes("Admin");
        const isChiefOfThisClan = role === `${t} Chief`;
        const canManage = isOwner || isChiefOfThisClan;

        const d = document.createElement('div');
        d.innerHTML = `
            <div class="flex items-center gap-4 mb-8 px-2 fade-up">
                <div class="h-8 w-1.5 rounded-full bg-gradient-to-b from-brand-primary to-brand-secondary shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                <h2 class="text-3xl font-black tracking-tighter text-theme italic uppercase">${t}</h2>
            </div>
            <div class="grid-cols-custom" id="grid-${t.replace(/\s/g,'')}"></div>`;
        
        const g = d.querySelector(`div[id*="grid-"]`);
        
        m.forEach(mem => {
            if (mem.includes("Chief") || mem.toLowerCase().includes("admin")) return;
            const h = (store[mem] || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            const card = document.createElement('div'); card.className = "glass-card group";
            card.innerHTML = `
                <div class="card-header p-5 flex justify-between items-center transition-colors group-hover:bg-white/5">
                    <h3 class="text-lg font-bold text-theme">${mem}</h3>
                    ${canManage ? `<button class="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition uppercase" onclick="removeMemberGlobal('${t}','${mem}')">REMOVE</button>` : ''}
                </div>
                <div class="card-body custom-scroll space-y-3 p-4"></div>`;
            const l = card.querySelector('.card-body');

            if (h.length === 0) l.innerHTML = '<div class="h-full flex flex-col items-center justify-center opacity-30"><div class="text-4xl mb-2">💤</div><div class="text-[10px] font-bold uppercase tracking-widest text-theme">No Activity</div></div>';

            h.forEach((e, idx) => {
                if (e.deletedBy && !canManage) return;
                const isDel = !!e.deletedBy;
                const canEdit = (canManage || (currentUser && currentUser.displayName === mem)) && !isDel;
                const safeLinks = encodeURIComponent(JSON.stringify(e.links));
                const safeId = e.id || e.timestamp;
                
                const r = document.createElement('div');
                r.className = `submission-item ${isDel ? 'border-red-500/30 bg-red-500/5' : ''}`;
                
                let html = `<div class="flex justify-between items-center mb-2">`;
                html += isDel ? `<span class="text-[9px] font-bold text-red-400 border border-red-500/30 px-1.5 rounded">DELETED</span>` : `<span class="item-badge">${e.day}</span>`;
                html += `<div class="flex gap-2">`;
                if (canEdit) html += `<button onclick="window.openEditModal('${mem}','${safeId}','${e.day}','${safeLinks}','${e.review||''}')" class="icon-box w-6 h-6 text-xs flex items-center justify-center">✎</button>`;
                if (canManage && !isDel) html += `<button onclick="window.deleteSubmissionGlobal('${mem}','${safeId}')" class="icon-box w-6 h-6 text-xs flex items-center justify-center">🗑</button>`;
                html += `</div></div>`;

                if (!isDel) {
                    e.links.forEach(k => { html += `<a href="${k.url}" target="_blank" class="item-link"><span class="opacity-60">🔗</span> ${k.label}</a>`; });
                    if(e.review) html += `<div class="mt-2 text-xs text-secondary italic pl-2 border-l-2 border-brand-primary opacity-80">"${e.review}"</div>`;
                }

                // 🕵️ AUDIT LOG LOGIC (Fixed)
                const posted = e.authorName || e.author || "Unknown";
                const edited = e.lastEditedByName;
                
                // Fallback Logic for Deletion Info
                let deletedDisplay = e.deletedByName;
                if (!deletedDisplay && e.deletedBy) deletedDisplay = e.deletedBy.split('@')[0]; // Use email prefix if name missing

                html += `<div class="audit-log">`;
                html += `<div class="audit-row"><strong>CREATED:</strong> <span>${posted} • ${e.createdAtIST}</span></div>`;
                
                if(edited) {
                    html += `<div class="audit-row text-amber-500/80"><strong>EDITED:</strong> <span>${edited} • ${e.lastEditedAtIST}</span></div>`;
                }
                
                // CRITICAL FIX: Check if deletedBy exists (truthy), then show row
                if(e.deletedBy) {
                    html += `<div class="audit-row" style="color: #FF3B30;"><strong>DELETED:</strong> <span>${deletedDisplay || 'Admin'} • ${e.deletedAtIST || 'Unknown Time'}</span></div>`;
                }
                
                html += `</div>`;
                
                r.innerHTML = html;
                l.appendChild(r);
            });
            g.appendChild(card);
        });
        
        c.appendChild(d);
    }
}

// =========================================================
// 4. ACTIONS & HELPERS
// =========================================================

async function handleSaveEdit() {
    const m = document.getElementById('editMemberName').value;
    const id = document.getElementById('editTimestamp').value;
    if(!m || !id) return showToast("Error: Missing ID", "error");
    const ref = doc(db, "submissions", m);
    const s = await getDoc(ref); if (!s.exists()) return;
    let h = s.data().history;
    const i = h.findIndex(x => String(x.id) === String(id) || String(x.timestamp) === String(id));
    if (i > -1) {
        h[i].day = document.getElementById('editDay').value;
        h[i].review = document.getElementById('editReview').value;
        h[i].links = smartParseLinks(document.getElementById('editLinksRaw').value);
        h[i].lastEditedBy = currentUser.email;
        h[i].lastEditedByName = getSafeName(currentUser);
        h[i].lastEditedAtIST = getIST();
        await updateDoc(ref, { history: h }); window.toggleModal('editModal', false); showToast("Edit Saved", "success");
    } else { showToast("Error: Entry not found", "error"); }
}

async function parseAndUpload() {
    if(!currentUser) return showToast("Login Required", "error");
    const btn = document.getElementById('btnUpload');
    const m = els.uploadSelect.value;
    const t = document.getElementById('rawInput').value;
    const r = document.getElementById('uploadReview').value;
    if(!m || !t) return showToast("Missing Info", "error");
    btn.disabled = true; btn.innerText = "Processing...";
    try {
        const entry = {
            id: Date.now().toString(), day: t.split('\n')[0].replace(/http.*/,'').trim() || "Update", links: smartParseLinks(t), review: r, timestamp: new Date().toISOString(),
            author: currentUser.email, authorName: getSafeName(currentUser), authorTitle: getUserRoleLabel(currentUser.email, getSafeName(currentUser)), createdAtIST: getIST()
        };
        const ref = doc(db, "submissions", m); const s = await getDoc(ref);
        if(s.exists()) await updateDoc(ref, { history: arrayUnion(entry) }); else await setDoc(ref, { history: [entry] });
        showToast("Uploaded", "success"); document.getElementById('rawInput').value = "";
    } catch(e) { showToast(e.message, "error"); }
    btn.disabled = false; btn.innerText = "UPLOAD UPDATE";
}

async function handleDeleteSubmission(member, id) {
    if(!confirm("Logged Deletion. Proceed?")) return;
    const ref = doc(db, "submissions", member); const s = await getDoc(ref); if(!s.exists()) return;
    let h = s.data().history; const i = h.findIndex(x => String(x.id) === String(id) || String(x.timestamp) === String(id));
    if(i > -1) { h[i].deletedBy = currentUser.email; h[i].deletedByName = getSafeName(currentUser); h[i].deletedAtIST = getIST(); await updateDoc(ref, { history: h }); showToast("Deleted", "success"); }
}

function populateUploadDropdown(user, roleLabel) {
    const s = els.uploadSelect; s.innerHTML = '';
    const isOwner = roleLabel.includes("Admin"); const isChief = roleLabel.includes("Chief");
    if (isOwner) { s.innerHTML = '<option value="">-- Select Member --</option>'; for(const[t,m] of Object.entries(CLAN_DATA)) { const g = document.createElement('optgroup'); g.label = t; m.forEach(x => { if(!x.includes("Chief")) g.appendChild(new Option(x,x)); }); s.appendChild(g); } } 
    else if (isChief) { const myClan = roleLabel.replace(" Chief", "").replace("CLAN ", "Clan "); s.innerHTML = `<option value="">-- Select ${myClan} Member --</option>`; (CLAN_DATA[myClan]||[]).forEach(x => { if(!x.includes("Chief")) s.add(new Option(x,x)); }); } 
    else { s.add(new Option(user.displayName, user.displayName)); }
}

function showToast(msg, type = 'info') { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = `toast ${type}`; t.innerHTML = `<span>${type==='success'?'✅':(type==='error'?'⚠️':'ℹ️')}</span> <span>${msg}</span>`; c.appendChild(t); setTimeout(() => { t.style.animation='slideOut 0.4s forwards'; setTimeout(()=>t.remove(),400); }, 4000); }

window.toggleModal = (id, show) => { const el=document.getElementById(id); if(show){el.classList.remove('hidden');setTimeout(()=>el.classList.add('active'),10)}else{el.classList.remove('active');setTimeout(()=>el.classList.add('hidden'),300)} };
window.saveEdit = handleSaveEdit;
window.removeMemberGlobal = async (c, m) => { if(await removeMember(c, m)) window.location.reload(); };
window.deleteSubmissionGlobal = (m, id) => handleDeleteSubmission(m, id);
window.openEditModal = (member, id, day, linksEncoded, review) => {
    document.getElementById('editMemberName').value = member;
    document.getElementById('editTimestamp').value = id;
    document.getElementById('editDay').value = day;
    document.getElementById('editReview').value = review;
    
    try {
        const links = JSON.parse(decodeURIComponent(linksEncoded));
        
        // 🛠️ GAP FIX APPLIED: .join('\n\n') adds a full empty line between items
        document.getElementById('editLinksRaw').value = links.map(x => {
            // If the label is generic/smart, just show URL to keep it clean
            if(x.label.includes("🔗") || x.label.includes("Problem") || x.label.includes("Video")) {
                return x.url;
            }
            // If it was a custom label, preserve the format "Label - URL"
            return `${x.label} - ${x.url}`;
        }).join('\n\n'); 
        
    } catch(e) {
        document.getElementById('editLinksRaw').value = "";
    }
    
    window.toggleModal('editModal', true);
};

function initPhysics() { const canvas = document.getElementById('cosmos-canvas'); if(!canvas) return; const ctx = canvas.getContext('2d'); let stars = []; const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }; window.addEventListener('resize', resize); resize(); class Star { constructor() { this.reset(); } reset() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.z = Math.random() * 2; this.o = Math.random(); } update() { this.y -= 0.5; if(this.y < 0) this.reset(); this.o = Math.random(); } draw() { ctx.fillStyle = `rgba(255,255,255,${this.o})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.z, 0, Math.PI*2); ctx.fill(); } } stars = Array.from({ length: 150 }, () => new Star()); const loop = () => { ctx.clearRect(0,0,canvas.width,canvas.height); stars.forEach(s => {s.update(); s.draw();}); requestAnimationFrame(loop); }; loop(); }

// 🌗 THEME ICON TOGGLE FIX
function initTheme() { 
    const btn = document.getElementById('themeToggle'); 
    if(btn) {
        // Set initial icon
        const current = localStorage.getItem('theme') || 'dark';
        btn.querySelector('span').innerText = current === 'dark' ? '🌑' : '☀️';
        
        btn.addEventListener('click', () => { 
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; 
            document.documentElement.setAttribute('data-theme', next); 
            localStorage.setItem('theme', next);
            // Toggle Icon
            btn.querySelector('span').innerText = next === 'dark' ? '🌑' : '☀️';
        }); 
    }
}

function subscribeToRegistry() { onSnapshot(collection(db, "users"), (snap) => { REGISTERED_MEMBERS = new Set(); snap.forEach((doc) => { const d = doc.data(); if (d.displayName && d.email) REGISTERED_MEMBERS.add(d.displayName); }); initDropdowns(); }); }
function initDropdowns() { const s = document.getElementById('signupName'); if(s) { s.innerHTML = '<option value="">-- Select Identity --</option>'; for(const [t,m] of Object.entries(CLAN_DATA).sort()) { const g = document.createElement('optgroup'); g.label = t; let has = false; m.forEach(x => { if (!x.includes("Chief") && !REGISTERED_MEMBERS.has(x)) { g.appendChild(new Option(x, x)); has = true; } }); if (has) s.appendChild(g); } } }
function loadSubmissions() { onSnapshot(collection(db, "submissions"), (s) => { const st = {}; s.forEach(d => st[d.id] = d.data().history || []); latestStore = st; els.loader.classList.add('hidden'); els.teamsContainer.classList.remove('hidden'); renderUI(st); }); }
function setupEventListeners() {
    document.getElementById('tabLogin')?.addEventListener('click', (e) => switchTab(e, 'login'));
    document.getElementById('tabSignup')?.addEventListener('click', (e) => switchTab(e, 'signup'));
    document.querySelector('#loginForm button')?.addEventListener('click', async () => { try { await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value); window.toggleModal('authModal', false); showToast("Authenticated", "success"); } catch(e) { showToast(e.message, "error"); } });
    document.querySelector('#signupForm button')?.addEventListener('click', performSignup);
    document.getElementById('btnUpload')?.addEventListener('click', parseAndUpload);
    if(document.getElementById('superuserPanel')) { document.getElementById('btnAddClan')?.addEventListener('click', () => { const n=prompt("Name?"); if(n) createNewClan(n); }); document.getElementById('btnAddMember')?.addEventListener('click', () => { const c=prompt("Clan?"); const m=prompt("Name?"); if(c&&m) addMemberToClan(c,m); }); document.getElementById('btnSeedDatabase')?.addEventListener('click', seedDatabase); }
}
async function performSignup() {
    const n = document.getElementById('signupName').value; 
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPass').value;

    if(!n || !email || !pass) return showToast("Missing Info", "error");

    try { 
        // 1. Create Auth User
        const credential = await createUserWithEmailAndPassword(auth, email, pass); 
        await updateProfile(credential.user, {displayName: n}); 

        // 2. Find the correct Clan for this user to build the ID
        let clanPrefix = "";
        for(const [clan, members] of Object.entries(CLAN_DATA)) {
            if(members.includes(n)) {
                clanPrefix = clan;
                break;
            }
        }

        // 3. Construct the ID used in the database (e.g., "Clan 7_Ritesh Kumar")
        const docId = `${clanPrefix}_${n}`;
        
        // 4. Update the existing placeholder document instead of creating a new random one
        await setDoc(doc(db, "users", docId), {
            displayName: n, 
            email: credential.user.email, // Claim the account
            clan: clanPrefix,
            role: "Member", 
            claimedAt: new Date().toISOString()
        }, { merge: true }); // Merge ensures we don't overwrite existing fields if any

        window.location.reload(); 
    } catch(e) { 
        showToast(e.message, "error"); 
    } 
}
function switchTab(e, mode) { document.querySelectorAll('#authModal button[id^="tab"]').forEach(b => b.className="flex-1 py-2 text-sm text-secondary hover:text-primary transition"); e.target.className="flex-1 py-2 text-sm font-bold bg-white text-black rounded-md shadow"; document.getElementById('loginForm').classList.toggle('hidden', mode !== 'login'); document.getElementById('signupForm').classList.toggle('hidden', mode !== 'signup'); }