import { db, auth } from './firebase-init.js';
import { smartParseLinks } from './utils.js';
import { fetchClanStructure, fetchSystemRoles, addMemberToClan, removeMember, createNewClan, seedDatabase } from './admin.js';
import { collection, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion, query, where, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

console.log("🚀 Warzone System: Online");

// =========================================================
// 1. GLOBAL STATE & UTILS
// =========================================================
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

// 🕒 PRECISE TIMEKEEPING (IST)
const getIST = () => {
    return new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata', 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
    }).toUpperCase();
};

// 🛡️ NAME RESOLVER (Fixes missing names)
const getSafeName = (user) => {
    if (!user) return "Unknown";
    // Priority: Display Name -> Email Prefix -> "Commander"
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1);
    return "Commander";
};

// =========================================================
// 2. GLOBAL HANDLERS (EXPOSED TO WINDOW)
// =========================================================

window.toggleModal = (id, show) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) { el.classList.remove('hidden'); setTimeout(() => el.classList.add('active'), 10); } 
    else { el.classList.remove('active'); setTimeout(() => el.classList.add('hidden'), 300); }
};

window.saveEdit = async () => {
    await handleSaveEdit();
};

window.removeMemberGlobal = async (c, m) => { 
    if(await removeMember(c, m)) window.location.reload(); 
};

window.deleteSubmissionGlobal = async (m, id) => {
    await handleDeleteSubmission(m, id);
};

window.openEditModal = (member, id, day, linksEncoded, review) => {
    // Populate fields
    document.getElementById('editMemberName').value = member;
    document.getElementById('editTimestamp').value = id;
    document.getElementById('editDay').value = day;
    document.getElementById('editReview').value = review;
    
    // Decode Links
    try {
        const links = JSON.parse(decodeURIComponent(linksEncoded));
        document.getElementById('editLinksRaw').value = links.map(x => x.url).join('\n');
    } catch(e) {
        document.getElementById('editLinksRaw').value = "";
    }
    
    window.toggleModal('editModal', true);
};


// =========================================================
// 3. MAIN LOGIC & LISTENERS
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
    initPhysics(); 
    initTheme(); 
    
    try {
        CLAN_DATA = await fetchClanStructure();
        ROLES_DATA = await fetchSystemRoles(); 
    } catch (e) {
        console.warn("⚠️ Config Load Error:", e);
    }
    
    subscribeToRegistry();
    loadSubmissions();
    setupEventListeners();
    
    onAuthStateChanged(auth, (user) => { 
        currentUser = user; 
        updateUI(user); 
    });
});

function getUserRoleLabel(email, displayName) {
    if (!email) return "Guest";
    const lowerEmail = email.toLowerCase();
    
    if (ROLES_DATA.super_admins.some(e => e.toLowerCase() === lowerEmail)) return "SUPER ADMIN";
    if (ROLES_DATA.general_admins.some(e => e.toLowerCase() === lowerEmail)) return "GENERAL ADMIN";
    
    const chiefEntry = Object.entries(ROLES_DATA.clan_chiefs).find(([k, v]) => k.toLowerCase() === lowerEmail);
    if (chiefEntry) return `${chiefEntry[1].toUpperCase()} CHIEF`;
    
    for (const [clan, members] of Object.entries(CLAN_DATA)) {
        if (members.includes(displayName)) return `${clan.toUpperCase()} MEMBER`;
    }
    return "MEMBER";
}

function updateUI(user) {
    if (!els.navActions) return;
    
    if (user) {
        const email = user.email.toLowerCase();
        const displayName = getSafeName(user);
        const roleLabel = getUserRoleLabel(email, displayName);
        const isOwner = roleLabel === "SUPER ADMIN";
        
        if (els.landing) els.landing.classList.add('hidden');
        if (els.dashboard) els.dashboard.classList.remove('hidden');
        
        els.navActions.innerHTML = `
            <div class="flex flex-col items-end mr-4">
                <span class="text-xs font-bold text-white tracking-wide">${displayName}</span>
                <span class="text-[9px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-1.5 rounded mt-0.5 border border-emerald-400/20">${roleLabel}</span>
            </div>
            ${isOwner ? '<button id="btnOpenSuper" class="btn btn-glass btn-sm h-9 w-9 p-0 flex items-center justify-center" title="Admin Console">⚡</button>' : ''}
            <button id="btnLogout" class="btn btn-danger btn-sm h-8 text-[10px]">LOGOUT</button>
        `;
        
        document.getElementById('btnLogout').addEventListener('click', async () => { 
            await signOut(auth); 
            window.location.reload(); 
        });
        
        if(isOwner && document.getElementById('btnOpenSuper')) {
            document.getElementById('btnOpenSuper').addEventListener('click', () => {
                document.getElementById('superuserPanel').classList.toggle('hidden');
            });
        }

        const welcome = document.getElementById('welcomeMsg');
        if(welcome) welcome.innerText = `Welcome Back, ${displayName}`;
        
        populateUploadDropdown(user, roleLabel);
        renderUI(latestStore);

    } else {
        if (els.landing) els.landing.classList.remove('hidden');
        if (els.dashboard) els.dashboard.classList.add('hidden');
        els.navActions.innerHTML = `<button id="btnLoginOpen" class="btn btn-primary h-10 px-6 shadow-lg shadow-indigo-500/20">LOGIN</button>`;
        document.getElementById('btnLoginOpen').addEventListener('click', () => window.toggleModal('authModal', true));
    }
}

function populateUploadDropdown(user, roleLabel) {
    const s = els.uploadSelect; 
    s.innerHTML = '';
    const isOwner = roleLabel === "SUPER ADMIN" || roleLabel === "GENERAL ADMIN";
    const isChief = roleLabel.includes("CHIEF");
    
    if (isOwner) {
         s.innerHTML = '<option value="">-- Select Member --</option>';
         const sorted = sortClans(CLAN_DATA);
         for(const[t,m] of sorted) {
            const g = document.createElement('optgroup'); g.label = t;
            m.forEach(x => { if(!x.includes("Chief")) g.appendChild(new Option(x,x)); });
            s.appendChild(g);
         }
    } else if (isChief) {
         const myClan = roleLabel.replace(" CHIEF", "").replace("CLAN ", "Clan "); 
         s.innerHTML = `<option value="">-- Select ${myClan} Member --</option>`;
         const members = CLAN_DATA[myClan] || [];
         members.forEach(x => { if(!x.includes("Chief")) s.add(new Option(x,x)); });
    } else {
         s.add(new Option(user.displayName, user.displayName)); 
    }
}

// =========================================================
// 4. RENDERING & SAVING LOGIC
// =========================================================

function renderUI(store) {
    const c = els.teamsContainer; if(!c) return; c.innerHTML = '';
    const sorted = sortClans(CLAN_DATA);
    
    let myClan = null;
    if (currentUser) {
        const displayName = getSafeName(currentUser);
        const role = getUserRoleLabel(currentUser.email, displayName);
        if (role.includes("CHIEF")) myClan = role.replace(" CHIEF", "").replace("CLAN ", "Clan ");
        else {
            for (const [cl, ms] of Object.entries(CLAN_DATA)) { if (ms.includes(displayName)) { myClan = cl; break; } }
        }
    }
    if (myClan) {
        const idx = sorted.findIndex(x => x[0] === myClan);
        if (idx > -1) { const [t] = sorted.splice(idx, 1); sorted.unshift(t); }
    }

    for (const [t, m] of sorted) {
        const email = currentUser ? currentUser.email.toLowerCase() : "";
        const role = getUserRoleLabel(email);
        const isOwner = role === "SUPER ADMIN" || role === "GENERAL ADMIN";
        const isChiefOfThisClan = role === `${t.toUpperCase()} CHIEF`;
        const canManage = isOwner || isChiefOfThisClan;

        const d = document.createElement('div');
        d.innerHTML = `
            <div class="flex items-center gap-4 mb-8 px-2 fade-up">
                <div class="h-8 w-1 rounded-full bg-gradient-to-b from-brand-primary to-brand-secondary shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                <h2 class="text-3xl font-black tracking-tighter text-white italic uppercase">${t}</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="grid-${t.replace(/\s/g,'')}"></div>
        `;
        const g = d.querySelector(`div[id*="grid-"]`);
        
        m.forEach(mem => {
            if (mem.includes("Chief") || mem.toLowerCase().includes("admin")) return;

            const h = (store[mem] || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            const card = document.createElement('div'); 
            card.className = "glass-card group";
            
            card.innerHTML = `
                <div class="card-header group-hover:bg-white/5 transition-colors">
                    <h3 class="font-bold text-lg text-white tracking-tight flex items-center gap-2">
                        ${mem}
                        ${h.length > 0 ? '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>' : '<span class="w-2 h-2 rounded-full bg-gray-600"></span>'}
                    </h3>
                    ${canManage ? `<button class="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition" onclick="removeMemberGlobal('${t}','${mem}')">REMOVE</button>` : ''}
                </div>
                <div class="card-body custom-scroll p-4 space-y-4"></div>
            `;
            const l = card.querySelector('.card-body');

            if (h.length === 0) l.innerHTML = '<div class="h-full flex flex-col items-center justify-center opacity-30"><div class="text-4xl mb-2">💤</div><div class="text-[10px] font-bold uppercase tracking-widest">No Activity</div></div>';

            h.forEach((e, idx) => {
                if (e.deletedBy && !canManage) return;
                
                const isDel = !!e.deletedBy;
                const canEdit = (canManage || (currentUser && currentUser.displayName === mem)) && !isDel;
                const safeLinks = encodeURIComponent(JSON.stringify(e.links));
                
                // 🛡️ Data Safety: ID Fallback
                const safeId = e.id || e.timestamp;

                const r = document.createElement('div');
                r.className = `submission-item relative ${isDel ? 'border-red-500/30 bg-red-500/5' : ''}`;
                r.style.animationDelay = `${idx * 50}ms`;
                
                let html = `<div class="flex justify-between items-start mb-2">`;
                html += isDel 
                    ? `<span class="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">DELETED</span>` 
                    : `<span class="item-badge">${e.day}</span>`;
                
                html += `<div class="action-group ml-2">`;
                if (canEdit) html += `<button onclick="window.openEditModal('${mem}','${safeId}','${e.day}','${safeLinks}','${e.review||''}')" class="icon-box icon-edit" title="Edit">✎</button>`;
                if (canManage && !isDel) html += `<button onclick="window.deleteSubmissionGlobal('${mem}','${safeId}')" class="icon-box icon-del" title="Delete">🗑</button>`;
                html += `</div></div>`;

                if (!isDel) {
                    e.links.forEach(k => { html += `<a href="${k.url}" target="_blank" class="item-link"><span class="opacity-50">🔗</span> ${k.label}</a>`; });
                    if(e.review) html += `<div class="item-note">"${e.review}"</div>`;
                }

                // 🔍 NAME RESOLUTION (Fix for "null" names)
                // 1. Try saved authorName
                // 2. Try email prefix
                // 3. Fallback to "Unknown"
                let postedBy = e.authorName;
                if (!postedBy && e.author) postedBy = e.author.split('@')[0];
                if (!postedBy) postedBy = "Unknown";

                let editedBy = e.lastEditedByName;
                if (!editedBy && e.lastEditedBy) editedBy = e.lastEditedBy.split('@')[0];

                let deletedBy = e.deletedByName;
                if (!deletedBy && e.deletedBy) deletedBy = e.deletedBy.split('@')[0];

                html += `<div class="mt-3 pt-2 border-t border-white/5 space-y-1">`;
                
                // Posted Log
                html += `<div class="flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>POSTED:</span> <span title="${postedBy}">${e.createdAtIST || ""}</span>
                </div>`;
                
                // Edited Log
                if (editedBy) {
                    html += `<div class="flex justify-between text-[9px] text-amber-500/80 font-mono">
                        <span>EDITED BY:</span> <span class="font-bold" title="${editedBy}">${editedBy}</span>
                    </div>`;
                }
                
                // Deleted Log
                if (deletedBy) {
                    html += `<div class="flex justify-between text-[9px] text-red-400 font-mono font-bold">
                        <span>DELETED BY:</span> <span>${deletedBy}</span>
                    </div>
                    <div class="text-[9px] text-red-400/60 font-mono text-right">${e.deletedAtIST || 'Unknown Time'}</div>`;
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

async function handleSaveEdit() {
    console.log("💾 Saving Edit...");
    const m = document.getElementById('editMemberName').value;
    const id = document.getElementById('editTimestamp').value;
    
    if(!m || !id) return showToast("Error: Missing ID", "error");

    const ref = doc(db, "submissions", m);
    const s = await getDoc(ref);
    if (!s.exists()) return showToast("Error: Record not found", "error");

    let h = s.data().history;
    
    // 🛡️ CRITICAL FIX: Force String Comparison
    // Some IDs are strings ("17001..."), some numbers (17001...)
    // This logic ensures they match regardless of type.
    const i = h.findIndex(x => String(x.id) === String(id) || String(x.timestamp) === String(id));
    
    if (i > -1) {
        h[i].day = document.getElementById('editDay').value;
        h[i].review = document.getElementById('editReview').value;
        h[i].links = smartParseLinks(document.getElementById('editLinksRaw').value);
        
        // Audit
        const displayName = getSafeName(currentUser);
        h[i].lastEditedBy = currentUser.email;
        h[i].lastEditedByName = displayName; // Save Name
        h[i].lastEditedAtIST = getIST();
        
        await updateDoc(ref, { history: h });
        window.toggleModal('editModal', false);
        showToast("Edit Saved Successfully", "success");
    } else {
        console.error("ID Mismatch. Looking for:", id, "In:", h);
        showToast("Error: Could not find entry to update", "error");
    }
}

async function parseAndUpload() {
    if(!currentUser) return showToast("Login Required", "error");
    const btn = document.getElementById('btnUpload');
    const m = els.uploadSelect.value;
    const t = document.getElementById('rawInput').value;
    const r = document.getElementById('uploadReview').value;
    
    if(!m) return showToast("Select a Member", "error");
    if(!t) return showToast("Please enter content", "error");

    btn.disabled = true; btn.innerText = "Transmitting...";
    
    try {
        const links = smartParseLinks(t);
        const displayName = getSafeName(currentUser);

        const entry = {
            id: Date.now().toString(), 
            day: t.split('\n')[0].replace(/http.*/,'').trim() || "Update", 
            links, 
            review: r, 
            timestamp: new Date().toISOString(),
            author: currentUser.email, 
            authorName: displayName, // Save Name
            authorTitle: getUserRoleLabel(currentUser.email, displayName), 
            createdAtIST: getIST()
        };
        
        const ref = doc(db, "submissions", m);
        const s = await getDoc(ref);
        
        if(s.exists()) await updateDoc(ref, { history: arrayUnion(entry) });
        else await setDoc(ref, { history: [entry] });
        
        showToast("Update Posted Successfully", "success");
        document.getElementById('rawInput').value = "";
    } catch(e) { 
        showToast(e.message, "error"); 
    }
    btn.disabled = false; btn.innerText = "UPLOAD UPDATE";
}

async function handleDeleteSubmission(member, id) {
    if(!confirm("⚠️ CONFIRM DELETION?\nThis action will be logged.")) return;
    
    const ref = doc(db, "submissions", member);
    const s = await getDoc(ref);
    if(!s.exists()) return;

    let h = s.data().history;
    // Force String Comparison here too
    const i = h.findIndex(x => String(x.id) === String(id) || String(x.timestamp) === String(id));
    
    if(i > -1) {
        const displayName = getSafeName(currentUser);
        h[i].deletedBy = currentUser.email;
        h[i].deletedByName = displayName;
        h[i].deletedAtIST = getIST();
        
        await updateDoc(ref, { history: h });
        showToast("Entry Deleted", "success");
    }
}

// ... (Rest of setup code)
function setupEventListeners() {
    document.getElementById('tabLogin')?.addEventListener('click', (e) => switchTab(e, 'login'));
    document.getElementById('tabSignup')?.addEventListener('click', (e) => switchTab(e, 'signup'));
    
    document.querySelector('#loginForm button')?.addEventListener('click', async () => {
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
            window.toggleModal('authModal', false);
            showToast("Authenticated", "success");
        } catch(e) { showToast(e.message, "error"); }
    });

    document.querySelector('#signupForm button')?.addEventListener('click', performSignup);
    document.getElementById('btnUpload')?.addEventListener('click', parseAndUpload);
    
    if(document.getElementById('superuserPanel')) {
        document.getElementById('btnAddClan')?.addEventListener('click', () => { const n=prompt("Name?"); if(n) createNewClan(n); });
        document.getElementById('btnAddMember')?.addEventListener('click', () => { const c=prompt("Clan?"); const m=prompt("Name?"); if(c&&m) addMemberToClan(c,m); });
        document.getElementById('btnSeedDatabase')?.addEventListener('click', seedDatabase);
    }
}

async function performSignup() {
    const n = document.getElementById('signupName').value; 
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPass').value;

    if(!n) return showToast("Select Identity", "error"); 
    if (REGISTERED_MEMBERS.has(n)) return showToast("Identity taken!", "error");

    try { 
        const credential = await createUserWithEmailAndPassword(auth, email, pass); 
        await updateProfile(credential.user, {displayName: n}); 
        
        const q = query(collection(db, "users"), where("displayName", "==", n));
        const check = await getDocs(q);
        if (!check.empty) {
            const d = check.docs[0];
            if(!d.data().email) await deleteDoc(d.ref); 
        }

        await setDoc(doc(db, "users", credential.user.uid), {
            displayName: n, email: credential.user.email, role: "Member", createdAt: new Date().toISOString()
        });

        window.location.reload(); 
    } catch(e) { showToast(e.message, "error"); } 
}

function sortClans(clansObj) { return Object.entries(clansObj).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })); }
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = `toast ${type}`;
    t.innerHTML = `<span>${type==='success'?'✅':(type==='error'?'⚠️':'ℹ️')}</span> <span>${msg}</span>`;
    c.appendChild(t); setTimeout(() => { t.style.animation='slideOut 0.4s forwards'; setTimeout(()=>t.remove(),400); }, 4000);
}
function switchTab(e, mode) {
    document.querySelectorAll('#authModal button[id^="tab"]').forEach(b => b.className="flex-1 py-2 text-sm text-secondary hover:text-primary transition");
    e.target.className="flex-1 py-2 text-sm font-bold bg-white text-black rounded-md shadow";
    document.getElementById('loginForm').classList.toggle('hidden', mode !== 'login');
    document.getElementById('signupForm').classList.toggle('hidden', mode !== 'signup');
}
function subscribeToRegistry() {
    onSnapshot(collection(db, "users"), (snap) => {
        REGISTERED_MEMBERS = new Set();
        snap.forEach((doc) => { const d = doc.data(); if (d.displayName && d.email) REGISTERED_MEMBERS.add(d.displayName); });
        if(currentUser) populateUploadDropdown(currentUser, getUserRoleLabel(currentUser.email, currentUser.displayName || getSafeName(currentUser)));
        else initDropdowns();
    });
}
function initDropdowns() { 
    const signupSelect = document.getElementById('signupName');
    if(signupSelect) {
        signupSelect.innerHTML = '<option value="">-- Select Identity --</option>'; 
        const sorted = sortClans(CLAN_DATA); 
        for(const [t,m] of sorted) { 
            const g = document.createElement('optgroup'); g.label = t; 
            let has = false;
            m.forEach(x => { 
                if (!x.includes("Chief") && !REGISTERED_MEMBERS.has(x)) { g.appendChild(new Option(x, x)); has = true; } 
            });
            if (has) signupSelect.appendChild(g); 
        }
    }
}
function loadSubmissions() {
    onSnapshot(collection(db, "submissions"), (s) => {
        const st = {}; s.forEach(d => st[d.id] = d.data().history || []);
        latestStore = st;
        els.loader.classList.add('hidden'); els.teamsContainer.classList.remove('hidden');
        renderUI(st);
    });
}
function initPhysics() {
    const canvas = document.getElementById('cosmos-canvas'); if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();
    class Star { constructor() { this.reset(); } reset() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.z = Math.random() * 2; this.o = Math.random(); } update() { this.y -= 0.5; if(this.y < 0) this.reset(); this.o = Math.random(); } draw() { ctx.fillStyle = `rgba(255,255,255,${this.o})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.z, 0, Math.PI*2); ctx.fill(); } }
    stars = Array.from({ length: 150 }, () => new Star());
    const loop = () => { ctx.clearRect(0,0,canvas.width,canvas.height); stars.forEach(s => {s.update(); s.draw();}); requestAnimationFrame(loop); };
    loop();
}
function initTheme() {
    const btn = document.getElementById('themeToggle');
    if(btn) btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next); localStorage.setItem('theme', next);
    });
}