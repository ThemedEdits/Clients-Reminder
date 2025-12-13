// Secure Credentials - Admin
const ADMIN_CREDENTIALS = {
    userId: 'hammadahmed',
    name: 'Hammad Ahmed',
    password: 'hammad2004ahmed',
    role: 'admin'
};

// Client Credentials - You'll add these when creating clients
// Format: { userId: 'client123', name: 'Client Name', password: 'clientpass', email: 'client@example.com', role: 'client' }
let CLIENT_CREDENTIALS = {};

// Configuration
const CONFIG = {
    firebase: {
        apiKey: "AIzaSyB-7NaRb8feupfLnpBu0_DB5ilnTrUZ-T4",
        databaseURL: "https://client-app-406fb-default-rtdb.firebaseio.com"
    },
    emailjs: {
        serviceId: "clients-payment-app",
        templateId: "template_4ef3ula",
        publicKey: "dlTAzaXJt9czMLHsa"
    }
};

let currentUser = null;
let editingClientId = null;
let checkInterval;
let inactivityTimer;
let lastActivityTime = Date.now();

// Initialize EmailJS
emailjs.init(CONFIG.emailjs.publicKey);

// Check if user is logged in
function checkAuth() {
    const session = sessionStorage.getItem('userSession');
    if (!session) {
        return false;
    }

    try {
        const sessionData = JSON.parse(session);
        const currentTime = Date.now();

        // Check if session is still valid (not expired)
        if (currentTime - sessionData.loginTime > 24 * 60 * 60 * 1000) {
            logout();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Initialize auth on page load
function initAuth() {
    const session = sessionStorage.getItem('userSession');
    if (session) {
        try {
            const sessionData = JSON.parse(session);
            currentUser = sessionData;
            showMainApp(sessionData);
        } catch (error) {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
}

// Login Form Handler
function handleLogin(e) {
    e.preventDefault();

    const userId = document.getElementById('loginUserId').value.trim();
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Check if admin
    if (userId === ADMIN_CREDENTIALS.userId &&
        name === ADMIN_CREDENTIALS.name &&
        password === ADMIN_CREDENTIALS.password) {

        const sessionData = {
            userId: userId,
            name: name,
            role: 'admin',
            loginTime: Date.now()
        };

        sessionStorage.setItem('userSession', JSON.stringify(sessionData));
        currentUser = sessionData;
        showLoginAlert('Login successful as Administrator!', 'success');

        setTimeout(() => {
            showMainApp(sessionData);
        }, 500);
    }
    // Check if client
    else if (CLIENT_CREDENTIALS[userId] &&
        name === CLIENT_CREDENTIALS[userId].name &&
        password === CLIENT_CREDENTIALS[userId].password) {

        const sessionData = {
            userId: userId,
            name: name,
            role: 'client',
            clientEmail: CLIENT_CREDENTIALS[userId].email,
            loginTime: Date.now()
        };

        sessionStorage.setItem('userSession', JSON.stringify(sessionData));
        currentUser = sessionData;
        showLoginAlert('Login successful!', 'success');

        setTimeout(() => {
            showMainApp(sessionData);
        }, 500);
    }
    else {
        showLoginAlert('Invalid credentials. Please try again.', 'error');
    }
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').classList.remove('active');
    stopInactivityMonitor();
}

function showMainApp(sessionData) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.add('active');

    // Update user info display
    document.getElementById('displayName').innerHTML = `${sessionData.name} <span class="role-badge ${sessionData.role === 'admin' ? 'badge-admin' : 'badge-client'}">${sessionData.role}</span>`;
    document.getElementById('displayUserId').textContent = `ID: ${sessionData.userId}`;

    // Show appropriate dashboard based on role
    if (sessionData.role === 'admin') {
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('clientDashboard').style.display = 'none';
        loadClients();
        startReminderCheck();
    } else {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('clientDashboard').style.display = 'block';
        loadClientDetails(sessionData.clientEmail);
    }

    startInactivityMonitor();
}

function logout() {
    sessionStorage.removeItem('userSession');
    document.getElementById('loginForm').reset();
    currentUser = null;
    showLoginScreen();
}

function togglePassword() {
    const input = document.getElementById('loginPassword');
    const btn = event.target.closest('.password-toggle');
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// Generate client credentials from email
function generateClientCredentials(email) {
    const emailParts = email.split('@')[0];
    const userId = emailParts.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(1000 + Math.random() * 9000);
    const password = Math.random().toString(36).slice(-8) + Math.floor(10 + Math.random() * 90);

    return { userId, password };
}

// Update client credentials in form
function updateClientCredentials() {
    const email = document.getElementById('clientEmail').value;
    if (email) {
        const credentials = generateClientCredentials(email);
        document.getElementById('clientUserId').value = credentials.userId;
        document.getElementById('clientPassword').value = credentials.password;
    }
}

// Inactivity Monitor (2 minutes = 120000ms)
function startInactivityMonitor() {
    lastActivityTime = Date.now();

    // Reset activity timer on any user interaction
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });

    // Check for screen visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check inactivity every 10 seconds
    inactivityTimer = setInterval(() => {
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > 120000) { // 2 minutes
            logout();
            showAlert('Session expired due to inactivity', 'warning');
        }
    }, 10000);
}

function stopInactivityMonitor() {
    if (inactivityTimer) {
        clearInterval(inactivityTimer);
    }
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
    });
    document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function resetInactivityTimer() {
    lastActivityTime = Date.now();
}

let hiddenTime = 0;
function handleVisibilityChange() {
    if (document.hidden) {
        hiddenTime = Date.now();
    } else {
        if (hiddenTime > 0) {
            const timeHidden = Date.now() - hiddenTime;
            if (timeHidden > 120000) { // 2 minutes
                logout();
                showAlert('Session expired due to screen being off', 'warning');
            }
        }
    }
}

function showLoginAlert(message, type) {
    const container = document.getElementById('loginAlert');
    const icon = type === 'success' ? 'check-circle' : 'exclamation-triangle';
    container.innerHTML = `<div class="alert alert-${type}"><i class="fas fa-${icon}"></i> ${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 4000);
}

// Client Management Functions
function togglePaymentFields() {
    const type = document.getElementById('paymentType').value;
    document.getElementById('monthlyFields').style.display =
        type === 'monthly' ? 'block' : 'none';
}

function openModal(clientId = null) {
    if (!checkAuth() || currentUser.role !== 'admin') return;

    editingClientId = clientId;
    const modal = document.getElementById('clientModal');
    const form = document.getElementById('clientForm');

    // Auto-generate credentials when email changes
    document.getElementById('clientEmail').addEventListener('input', updateClientCredentials);

    if (clientId) {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit Client';
        document.getElementById('submitBtnText').textContent = 'Update Client';
        loadClientData(clientId);
    } else {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add New Client';
        document.getElementById('submitBtnText').textContent = 'Save Client';
        form.reset();
        updateClientCredentials();
    }

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('clientModal').classList.remove('active');
    document.getElementById('clientForm').reset();
    editingClientId = null;
}

async function loadClientData(clientId) {
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`);
        const client = await response.json();

        document.getElementById('clientName').value = client.name;
        document.getElementById('clientEmail').value = client.email;
        document.getElementById('clientPhone').value = client.phone || '';
        document.getElementById('paymentType').value = client.paymentType;
        document.getElementById('clientAmount').value = client.amount;
        document.getElementById('clientNotes').value = client.notes || '';

        if (client.paymentType === 'monthly') {
            document.getElementById('reminderDay').value = client.reminderDay;
            togglePaymentFields();
        }

        // Load client credentials if they exist
        const clientUserId = client.clientCredentials?.userId || generateClientCredentials(client.email).userId;
        const clientPassword = client.clientCredentials?.password || generateClientCredentials(client.email).password;

        document.getElementById('clientUserId').value = clientUserId;
        document.getElementById('clientPassword').value = clientPassword;
    } catch (error) {
        showAlert('Error loading client data', 'error');
    }
}

document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!checkAuth() || currentUser.role !== 'admin') return;

    const clientData = {
        name: document.getElementById('clientName').value,
        email: document.getElementById('clientEmail').value,
        phone: document.getElementById('clientPhone').value,
        paymentType: document.getElementById('paymentType').value,
        amount: parseFloat(document.getElementById('clientAmount').value),
        notes: document.getElementById('clientNotes').value,
        clientCredentials: {
            userId: document.getElementById('clientUserId').value,
            password: document.getElementById('clientPassword').value
        },
        createdAt: editingClientId ? undefined : new Date().toISOString()
    };

    if (clientData.paymentType === 'monthly') {
        clientData.reminderDay = parseInt(document.getElementById('reminderDay').value);
        clientData.lastReminderSent = null;
        clientData.reminderCount = 0;
    }

    try {
        const url = editingClientId
            ? `${CONFIG.firebase.databaseURL}/clients/${editingClientId}.json`
            : `${CONFIG.firebase.databaseURL}/clients.json`;

        const method = editingClientId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });

        const result = await response.json();

        // Update CLIENT_CREDENTIALS object
        if (editingClientId) {
            // Update existing credentials
            CLIENT_CREDENTIALS[clientData.clientCredentials.userId] = {
                name: clientData.name,
                password: clientData.clientCredentials.password,
                email: clientData.email,
                role: 'client'
            };
        } else {
            // Add new credentials
            CLIENT_CREDENTIALS[clientData.clientCredentials.userId] = {
                name: clientData.name,
                password: clientData.clientCredentials.password,
                email: clientData.email,
                role: 'client'
            };
        }

        showAlert(editingClientId ? 'Client updated successfully!' : 'Client added successfully!', 'success');
        closeModal();
        loadClients();
    } catch (error) {
        showAlert('Error saving client', 'error');
    }
});

async function loadClients() {
    if (!checkAuth() || currentUser.role !== 'admin') return;

    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const clients = await response.json();

        const container = document.getElementById('clientsContainer');

        if (!clients) {
            container.innerHTML = `
                        <div class="empty-state" style="grid-column: 1/-1;">
                            <div class="empty-state-icon"><i class="fas fa-users"></i></div>
                            <h3>No clients yet</h3>
                            <p>Add your first client to get started</p>
                        </div>
                    `;
            updateStats(null);
            return;
        }

        // Update CLIENT_CREDENTIALS from loaded clients
        Object.values(clients).forEach(client => {
            if (client.clientCredentials) {
                CLIENT_CREDENTIALS[client.clientCredentials.userId] = {
                    name: client.name,
                    password: client.clientCredentials.password,
                    email: client.email,
                    role: 'client'
                };
            }
        });

        container.innerHTML = Object.entries(clients).map(([id, client]) => `
                    <div class="client-card">
                        <div class="client-header">
                            <div class="client-name">
                                <i class="fas fa-user"></i> ${client.name}
                            </div>
                            <span class="payment-badge ${client.paymentType === 'monthly' ? 'badge-monthly' : 'badge-project'}">
                                <i class="fas ${client.paymentType === 'monthly' ? 'fa-calendar-alt' : 'fa-project-diagram'}"></i>
                                ${client.paymentType === 'monthly' ? 'Monthly' : 'Project'}
                            </span>
                        </div>
                        <div class="client-info">
                            <div class="client-info-item">
                                <i class="fas fa-envelope"></i>
                                <div ><strong>Email:</strong> ${client.email}</div>
                            </div>
                            ${client.phone ? `
                                <div class="client-info-item">
                                    <i class="fas fa-phone"></i>
                                    <div><strong>Phone:</strong> ${client.phone}</div>
                                </div>
                            ` : ''}
                            <div class="client-info-item">
                                <i class="fas fa-money-bill"></i>
                                <div><strong>Amount:</strong> Rs. ${client.amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            ${client.paymentType === 'monthly' ? `
                                <div class="client-info-item">
                                    <i class="fas fa-calendar-day"></i>
                                    <div><strong>Reminder Day:</strong> ${client.reminderDay} of each month</div>
                                </div>
                            ` : ''}
                            <div class="client-info-item">
                                <i class="fas fa-user-shield"></i>
                                <div><strong>Client Login ID:</strong> ${client.clientCredentials?.userId || 'Not set'}</div>
                            </div>
                            ${client.notes ? `
                                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                                    <div class="client-info-item">
                                        <i class="fas fa-sticky-note"></i>
                                        <div><strong>Notes:</strong> ${client.notes}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="client-actions">
                            <button class="btn btn-success btn-small" onclick="sendManualReminder('${id}')">
                                <i class="fas fa-envelope"></i> Send Email
                            </button>
                            <button class="btn btn-primary btn-small" onclick="openModal('${id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-danger btn-small" onclick="deleteClient('${id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `).join('');

        updateStats(clients);
    } catch (error) {
        showAlert('Error loading clients', 'error');
    }
}

// Load client details for client role
async function loadClientDetails(clientEmail) {
    if (!checkAuth() || currentUser.role !== 'client') return;

    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const clients = await response.json();

        const container = document.getElementById('clientDetailsContainer');

        if (!clients) {
            container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon"><i class="fas fa-user-slash"></i></div>
                            <h3>No account found</h3>
                            <p>Your account details could not be found. Please contact support.</p>
                        </div>
                    `;
            return;
        }

        // Find the client by email
        const clientEntry = Object.entries(clients).find(([id, client]) => client.email === clientEmail);

        if (!clientEntry) {
            container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon"><i class="fas fa-user-slash"></i></div>
                            <h3>Account not found</h3>
                            <p>No account found with email: ${clientEmail}</p>
                            <p>Please contact the administrator if you believe this is an error.</p>
                        </div>
                    `;
            return;
        }

        const [id, client] = clientEntry;

        container.innerHTML = `
                    <div class="client-card" style="border-color: var(--info-color);">
                        <div class="client-header">
                            <div class="client-name">
                                <i class="fas fa-user-circle"></i> ${client.name}
                            </div>
                            <span class="payment-badge ${client.paymentType === 'monthly' ? 'badge-monthly' : 'badge-project'}">
                                <i class="fas ${client.paymentType === 'monthly' ? 'fa-calendar-alt' : 'fa-project-diagram'}"></i>
                                ${client.paymentType === 'monthly' ? 'Monthly Payment' : 'Project Based'}
                            </span>
                        </div>
                        <div class="client-info">
                            <div class="client-info-item">
                                <i class="fas fa-envelope"></i>
                                <div><strong>Email:</strong> ${client.email}</div>
                            </div>
                            ${client.phone ? `
                                <div class="client-info-item">
                                    <i class="fas fa-phone"></i>
                                    <div><strong>Phone:</strong> ${client.phone}</div>
                                </div>
                            ` : ''}
                            <div class="client-info-item">
                                <i class="fas fa-money-bill"></i>
                                <div><strong>Payment Amount:</strong> Rs. ${client.amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            ${client.paymentType === 'monthly' ? `
                                <div class="client-info-item">
                                    <i class="fas fa-calendar-day"></i>
                                    <div><strong>Payment Reminder Day:</strong> ${client.reminderDay} of each month</div>
                                </div>
                            ` : ''}
                            ${client.notes ? `
                                <div class="client-info-item">
                                    <i class="fas fa-sticky-note"></i>
                                    <div><strong>Notes:</strong> ${client.notes}</div>
                                </div>
                            ` : ''}
                            <div class="client-info-item">
                                <i class="fas fa-info-circle"></i>
                                <div><strong>Account Status:</strong> <span style="color: var(--success-color);">Active</span></div>
                            </div>
                            <div class="client-info-item">
                                <i class="fas fa-clock"></i>
                                <div><strong>Last Updated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                            </div>
                        </div>
                    </div>
                `;
    } catch (error) {
        container.innerHTML = `
                    <div class="alert alert-error">
                        <i class="fas fa-exclamation-triangle"></i> Error loading your account details. Please try again later.
                    </div>
                `;
    }
}

function updateStats(clients) {
    if (!clients) {
        document.getElementById('totalClients').textContent = '0';
        document.getElementById('monthlyClients').textContent = '0';
        document.getElementById('projectClients').textContent = '0';
        document.getElementById('monthlyRevenue').textContent = 'Rs. 0';
        return;
    }

    const clientsArray = Object.values(clients);
    const monthlyClients = clientsArray.filter(c => c.paymentType === 'monthly');
    const projectClients = clientsArray.filter(c => c.paymentType === 'project');
    const monthlyRevenue = monthlyClients.reduce((sum, c) => sum + c.amount, 0);

    document.getElementById('totalClients').textContent = clientsArray.length;
    document.getElementById('monthlyClients').textContent = monthlyClients.length;
    document.getElementById('projectClients').textContent = projectClients.length;
    document.getElementById('monthlyRevenue').textContent = `Rs. ${monthlyRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function deleteClient(id) {
    if (!checkAuth() || currentUser.role !== 'admin') return;
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) return;

    try {
        await fetch(`${CONFIG.firebase.databaseURL}/clients/${id}.json`, { method: 'DELETE' });
        showAlert('Client deleted successfully!', 'success');
        loadClients();
    } catch (error) {
        showAlert('Error deleting client', 'error');
    }
}

async function sendManualReminder(clientId) {
    if (!checkAuth() || currentUser.role !== 'admin') return;

    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`);
        const client = await response.json();

        await sendEmail(client, 1);
        showAlert(`Reminder sent to ${client.name}!`, 'success');
    } catch (error) {
        showAlert('Error sending reminder: ' + error.message, 'error');
    }
}

async function sendEmail(client, reminderNumber) {
    const templateParams = {
        to_name: client.name,
        to_email: client.email,
        client_name: client.name,
        client_email: client.email,
        amount: `Rs. ${client.amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        payment_type: client.paymentType === 'monthly' ? 'Monthly' : 'Per Project',
        reminder_number: reminderNumber,
        reminder_day: client.reminderDay || 'N/A'
    };

    try {
        const response = await emailjs.send(
            CONFIG.emailjs.serviceId,
            CONFIG.emailjs.templateId,
            templateParams
        );
        console.log(`Email sent to ${client.email} (${client.name}) - Reminder ${reminderNumber}`, response);
    } catch (error) {
        console.error('Email error:', error);
        throw error;
    }
}

async function checkReminders() {
    if (!checkAuth() || currentUser.role !== 'admin') return;

    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const clients = await response.json();
        if (!clients) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const [id, client] of Object.entries(clients)) {
            if (client.paymentType !== 'monthly') continue;

            const reminderCount = client.reminderCount || 0;
            if (reminderCount >= 3) continue;

            const baseDate = new Date(today.getFullYear(), today.getMonth(), client.reminderDay);
            const reminderDates = [
                baseDate,
                new Date(baseDate.getTime() + 2 * 86400000),
                new Date(baseDate.getTime() + 4 * 86400000)
            ];

            // Fix month overflow
            reminderDates.forEach(d => {
                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                if (d.getDate() > lastDay) d.setDate(lastDay);
                d.setHours(0, 0, 0, 0);
            });

            const todayStr = today.toISOString().split('T')[0];
            const targetDate = reminderDates[reminderCount];
            const targetStr = targetDate.toISOString().split('T')[0];

            if (todayStr === targetStr) {
                await sendEmail(client, reminderCount + 1);

                await fetch(`${CONFIG.firebase.databaseURL}/clients/${id}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reminderCount: reminderCount + 1,
                        lastReminderSent: todayStr
                    })
                });

                console.log(`Reminder ${reminderCount + 1} sent to ${client.name}`);
            }

            // Reset after cycle
            if (today > reminderDates[2]) {
                await fetch(`${CONFIG.firebase.databaseURL}/clients/${id}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reminderCount: 0 })
                });
            }
        }
    } catch (error) {
        console.error('Reminder check error:', error);
    }
}


function startReminderCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkReminders, 3600000);
    checkReminders();
}

function showAlert(message, type) {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-triangle' :
            type === 'warning' ? 'exclamation-circle' : 'info-circle';

    alert.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;

    container.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Handle page unload (close tab/browser)
window.addEventListener('beforeunload', () => {
    // Session will be cleared automatically since we use sessionStorage
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initAuth();

    // Auto-generate credentials when email is entered in client form
    document.getElementById('clientEmail')?.addEventListener('input', updateClientCredentials);
});