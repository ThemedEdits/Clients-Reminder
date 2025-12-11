// src/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase, ref, push, set, onValue, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/*
  IMPORTANT: Replace the firebaseConfig below with your project's config object
  from the Firebase Console (Register web app -> copy config).
*/
const firebaseConfig = {
  apiKey: "AIzaSyB-7NaRb8feupfLnpBu0_DB5ilnTrUZ-T4",
  authDomain: "client-app-406fb.firebaseapp.com",
  databaseURL: "https://client-app-406fb-default-rtdb.firebaseio.com",
  projectId: "client-app-406fb",
  storageBucket: "client-app-406fb.firebasestorage.app",
  messagingSenderId: "682891835316",
  appId: "1:682891835316:web:8c4ca2928028c7411864e1",
  measurementId: "G-B481W83RQS"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const clientsRef = ref(db, "clients");

const form = document.getElementById("client-form");
const clientsList = document.getElementById("clientsList");
const resetBtn = document.getElementById("resetBtn");

// Listen for DB changes (live UI)
onValue(clientsRef, (snapshot) => {
  const data = snapshot.val() || {};
  renderClients(data);
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = document.getElementById("clientId").value;
  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    billingType: document.getElementById("billingType").value,
    amount: Number(document.getElementById("amount").value || 0),
    dueDay: Number(document.getElementById("dueDay").value || 0),
    nextDueDate: document.getElementById("nextDueDate").value || null,
    notes: document.getElementById("notes").value || "",
    lastReminded: null
  };

  if (id) {
    await update(ref(db, "clients/" + id), payload);
  } else {
    const newRef = push(clientsRef);
    await set(newRef, payload);
  }
  form.reset();
  document.getElementById("clientId").value = "";
});

resetBtn.addEventListener("click", () => {
  form.reset();
  document.getElementById("clientId").value = "";
});

function renderClients(data) {
  clientsList.innerHTML = "";
  Object.entries(data).forEach(([id, client]) => {
    const li = document.createElement("li");
    li.className = "client-item";
    li.innerHTML = `
      <div>
        <div><strong>${escapeHtml(client.name || "")}</strong> <span class="small">(${escapeHtml(client.email || "")})</span></div>
        <div class="small">${escapeHtml(client.billingType || "")} — ${client.amount || 0} — next: ${client.nextDueDate || ("day " + (client.dueDay||"?"))}</div>
      </div>
      <div>
        <button data-id="${id}" class="edit">Edit</button>
        <button data-id="${id}" class="del">Delete</button>
      </div>
    `;
    clientsList.appendChild(li);
  });

  // handlers
  clientsList.querySelectorAll(".edit").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const snap = await get(ref(db, "clients/" + id));
      if (!snap.exists()) return;
      const c = snap.val();
      document.getElementById("clientId").value = id;
      document.getElementById("name").value = c.name || "";
      document.getElementById("email").value = c.email || "";
      document.getElementById("phone").value = c.phone || "";
      document.getElementById("billingType").value = c.billingType || "monthly";
      document.getElementById("amount").value = c.amount || "";
      document.getElementById("dueDay").value = c.dueDay || "";
      if (c.nextDueDate) document.getElementById("nextDueDate").value = c.nextDueDate;
      document.getElementById("notes").value = c.notes || "";
      window.scrollTo({top:0,behavior:"smooth"});
    };
  });

  clientsList.querySelectorAll(".del").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Delete this client?")) return;
      await remove(ref(db, "clients/" + btn.dataset.id));
    };
  });
}

// small helper to escape HTML
function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
