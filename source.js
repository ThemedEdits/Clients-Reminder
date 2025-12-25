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

// Admin Credentials
const ADMIN_CREDENTIALS = {
    userId: 'hammadahmed',
    name: 'Hammad Ahmed',
    password: 'hammad2004ahmed',
    role: 'admin'
};

// Global Variables
let currentUser = null;
let editingClientId = null;
let checkInterval;
let inactivityTimer;
let lastActivityTime = Date.now();
let hiddenTime = 0;

// DOM Elements
const DOM = {
    loginScreen: document.getElementById('loginScreen'),
    mainApp: document.getElementById('mainApp'),
    adminDashboard: document.getElementById('adminDashboard'),
    clientDashboard: document.getElementById('clientDashboard'),
    loginForm: document.getElementById('loginForm'),
    clientForm: document.getElementById('clientForm'),
    paymentForm: document.getElementById('paymentForm'),
    clientsContainer: document.getElementById('clientsContainer'),
    clientDetailsContainer: document.getElementById('clientDetailsContainer'),
    alertContainer: document.getElementById('alertContainer'),
    loginAlert: document.getElementById('loginAlert')
};

// EmailJS Initialization
emailjs.init(CONFIG.emailjs.publicKey);

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initEventListeners();
});

// Authentication Functions
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

function initEventListeners() {
    // Login form
    DOM.loginForm.addEventListener('submit', handleLogin);
    
    // Client form
    DOM.clientForm.addEventListener('submit', handleClientFormSubmit);
    
    // Payment form
    DOM.paymentForm.addEventListener('submit', handlePaymentFormSubmit);
    
    // Email input for auto-generating credentials
    document.getElementById('clientEmail')?.addEventListener('input', updateClientCredentials);
    
}

// Login Handler
async function handleLogin(e) {
    e.preventDefault();
    
    const userId = document.getElementById('loginUserId').value.trim();
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // Check admin credentials
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
        return;
    }
    
    // Check client credentials
    await authenticateClientFromFirebase(userId, name, password);
}


async function authenticateClientFromFirebase(userId, name, password) {
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const clients = await response.json();
        
        if (!clients) {
            showLoginAlert('No clients found.', 'error');
            return;
        }
        
        const client = Object.values(clients).find(c =>
            c.clientCredentials &&
            c.clientCredentials.userId === userId &&
            c.clientCredentials.password === password &&
            c.name === name
        );
        
        if (!client) {
            showLoginAlert('Invalid credentials. Please try again.', 'error');
            return;
        }
        
        const sessionData = {
            userId: userId,
            name: client.name,
            role: 'client',
            clientEmail: client.email,
            loginTime: Date.now()
        };
        
        sessionStorage.setItem('userSession', JSON.stringify(sessionData));
        currentUser = sessionData;
        showLoginAlert('Login successful!', 'success');
        
        setTimeout(() => {
            showMainApp(sessionData);
        }, 500);
        
    } catch (error) {
        console.error('Login error:', error);
        showLoginAlert('Login error. Please try again later.', 'error');
    }
}

function showLoginScreen() {
    DOM.loginScreen.style.display = 'flex';
    DOM.mainApp.classList.remove('active');
}

function showMainApp(sessionData) {
    DOM.loginScreen.style.display = 'none';
    DOM.mainApp.classList.add('active');
    
    // Update user info
    const displayName = document.getElementById('displayName');
    const displayUserId = document.getElementById('displayUserId');
    
    const roleBadgeClass = sessionData.role === 'admin' ? 'admin' : 'client';
    const roleBadge = `<span class="role-badge ${roleBadgeClass}">${sessionData.role}</span>`;
    
    displayName.innerHTML = `${sessionData.name} ${roleBadge}`;
    displayUserId.textContent = `ID: ${sessionData.userId}`;
    
    // Show appropriate dashboard
    if (sessionData.role === 'admin') {
        DOM.adminDashboard.classList.add('active');
        DOM.clientDashboard.classList.remove('active');
        loadClients();
        startReminderCheck();
    } else {
        DOM.adminDashboard.classList.remove('active');
        DOM.clientDashboard.classList.add('active');
        loadClientDetails(sessionData.clientEmail);
    }
}


function logout() {
    sessionStorage.removeItem('userSession');
    DOM.loginForm.reset();
    currentUser = null;
    showLoginScreen();
}

function togglePassword() {
    const input = document.getElementById('loginPassword');
    const btn = event.target.closest('.password-toggle');
    const icon = btn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Client Management
function openModal(clientId = null) {
    if (!checkAuth() || currentUser.role !== 'admin') return;
    
    editingClientId = clientId;
    const modal = document.getElementById('clientModal');
    const title = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('submitBtnText');
    
    if (clientId) {
        title.innerHTML = '<i class="fas fa-user-edit"></i> Edit Client';
        submitBtn.textContent = 'Update Client';
        loadClientData(clientId);
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Add New Client';
        submitBtn.textContent = 'Save Client';
        DOM.clientForm.reset();
        updateClientCredentials();
    }
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('clientModal').classList.remove('active');
    DOM.clientForm.reset();
    editingClientId = null;
}

function togglePaymentFields() {
    const type = document.getElementById('paymentType').value;
    document.getElementById('monthlyFields').style.display = 
        type === 'monthly' ? 'block' : 'none';
}

function generateClientCredentials(email) {
    const emailParts = email.split('@')[0];
    const userId = emailParts.toLowerCase().replace(/[^a-z0-9]/g, '') + 
                   Math.floor(1000 + Math.random() * 9000);
    const password = Math.random().toString(36).slice(-8) + 
                     Math.floor(10 + Math.random() * 90);
    
    return { userId, password };
}

function updateClientCredentials() {
    const email = document.getElementById('clientEmail').value.trim();
    const userIdInput = document.getElementById('clientUserId');
    const passwordInput = document.getElementById('clientPassword');
    
    if (email && !userIdInput.value && !passwordInput.value) {
        const credentials = generateClientCredentials(email);
        userIdInput.value = credentials.userId;
        passwordInput.value = credentials.password;
    }
}

async function loadClientData(clientId) {
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`);
        const client = await response.json();
        
        if (!client) throw new Error('Client not found');
        
        // Fill form fields
        document.getElementById('clientName').value = client.name || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientPhone').value = client.phone || '';
        document.getElementById('paymentType').value = client.paymentType || '';
        document.getElementById('clientAmount').value = client.amount || '';
        document.getElementById('clientNotes').value = client.notes || '';
        
        if (client.paymentType === 'monthly') {
            document.getElementById('reminderDay').value = client.reminderDay || '';
            togglePaymentFields();
        }
        
        // Load credentials
        const userIdInput = document.getElementById('clientUserId');
        const passwordInput = document.getElementById('clientPassword');
        
        if (client.clientCredentials) {
            userIdInput.value = client.clientCredentials.userId;
            passwordInput.value = client.clientCredentials.password;
        } else {
            const credentials = generateClientCredentials(client.email);
            userIdInput.value = credentials.userId;
            passwordInput.value = credentials.password;
        }
        
    } catch (error) {
        console.error('Error loading client data:', error);
        showAlert('Error loading client data', 'error');
    }
}

async function handleClientFormSubmit(e) {
    e.preventDefault();
    
    if (!checkAuth() || currentUser.role !== 'admin') return;
    
    const formData = {
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
        createdAt: editingClientId ? undefined : new Date().toISOString(),
        totalPaid: 0,
        status: 'due',
        lastPaymentDate: null
    };
    
    if (formData.paymentType === 'monthly') {
        formData.reminderDay = parseInt(document.getElementById('reminderDay').value);
        formData.lastReminderSent = null;
        formData.reminderCount = 0;
        formData.lastPaidCycle = null;
    }
    
    try {
        const url = editingClientId
            ? `${CONFIG.firebase.databaseURL}/clients/${editingClientId}.json`
            : `${CONFIG.firebase.databaseURL}/clients.json`;
        
        const method = editingClientId ? 'PATCH' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        await response.json();
        
        showAlert(
            editingClientId ? 'Client updated successfully!' : 'Client added successfully!',
            'success'
        );
        
        closeModal();
        loadClients();
        
    } catch (error) {
        console.error('Error saving client:', error);
        showAlert('Error saving client', 'error');
    }
}

// Client List Management
async function loadClients() {
    if (!checkAuth() || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const clients = await response.json();
        
        // Reset monthly clients if needed
        if (clients) {
            for (const [id, client] of Object.entries(clients)) {
                await resetMonthlyIfNeeded(client, id);
            }
        }
        
        // Refresh clients after reset
        const refreshedResponse = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const refreshedClients = await refreshedResponse.json();
        
        updateClientsGrid(refreshedClients);
        updateStats(refreshedClients);
        
    } catch (error) {
        console.error('Error loading clients:', error);
        showAlert('Error loading clients', 'error');
    }
}

function updateClientsGrid(clients) {
    if (!clients) {
        DOM.clientsContainer.innerHTML = createEmptyState('clients');
        return;
    }
    
    const clientsArray = Object.entries(clients);
    
    if (clientsArray.length === 0) {
        DOM.clientsContainer.innerHTML = createEmptyState('clients');
        return;
    }
    
    DOM.clientsContainer.innerHTML = clientsArray.map(([id, client]) => 
        createClientCard(id, client)
    ).join('');
}

function createClientCard(id, client) {
    const paid = client.totalPaid || 0;
    const remaining = client.amount - paid;
    const statusClass = remaining <= 0 ? 'amount-paid' : 'amount-due';
    const statusText = remaining <= 0 ? 'Paid' : `Due: Rs. ${remaining.toLocaleString('en-PK')}`;
    
    const lastPayment = client.lastPaymentDate ? 
        new Date(client.lastPaymentDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'Not paid yet';
    
    return `
        <div class="client-card">
            <div class="client-card-header" onclick="toggleClientDetails('${id}')">
                <div class="client-name">
                    <i class="fas fa-user"></i> ${client.name}
                </div>
                <span class="payment-badge ${client.paymentType === 'monthly' ? 'badge-monthly' : 'badge-project'}">
                    <i class="fas ${client.paymentType === 'monthly' ? 'fa-calendar-alt' : 'fa-project-diagram'}"></i>
                    ${client.paymentType === 'monthly' ? 'Monthly' : 'Project'}
                </span>
            </div>
            
            <div class="client-card-preview">
                <div class="preview-item">
                    <span class="preview-label">Email</span>
                    <span class="preview-value">${client.email}</span>
                </div>
                
                <div class="preview-item">
                    <span class="preview-label">Total Amount</span>
                    <div class="amount-display">
                        <div class="amount-total">Rs. ${client.amount.toLocaleString('en-PK')}</div>
                        <div class="amount-status ${statusClass}">${statusText}</div>
                    </div>
                </div>
                
                <div class="preview-item">
                    <span class="preview-label">Last Payment</span>
                    <span class="preview-value">${lastPayment}</span>
                </div>
            </div>
            
            <div class="client-actions">
                <button class="btn btn-success btn-small" onclick="sendManualReminder('${id}')">
                    <i class="fas fa-envelope"></i> Email
                </button>
                <button class="btn btn-success btn-small" 
                    onclick="openPaymentModal('${id}', ${remaining})"
                    ${remaining <= 0 ? 'disabled' : ''}>
                    <i class="fas fa-check-circle"></i> Pay
                </button>
                <button class="btn btn-primary btn-small" onclick="openModal('${id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteClient('${id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
            
            <div id="client-details-${id}" class="client-details-content" style="display: none;">
                <!-- Details will be loaded on demand -->
            </div>
        </div>
    `;
}

async function toggleClientDetails(clientId) {
    const detailsDiv = document.getElementById(`client-details-${clientId}`);
    
    if (detailsDiv.style.display === 'none') {
        if (!detailsDiv.hasChildNodes()) {
            await loadClientDetailsForModal(clientId, detailsDiv);
        }
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.style.display = 'none';
    }
}

async function loadClientDetailsForModal(clientId, container) {
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`);
        const client = await response.json();
        
        const paymentsResponse = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}/payments.json`);
        const payments = await paymentsResponse.json();
        
        const paymentsList = payments ? Object.values(payments) : [];
        
        container.innerHTML = `
            <div class="modal-content">
                <div class="client-details-grid">
                    <div class="detail-item">
                        <i class="fas fa-envelope"></i>
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${client.email}</div>
                    </div>
                    
                    ${client.phone ? `
                        <div class="detail-item">
                            <i class="fas fa-phone"></i>
                            <div class="detail-label">Phone</div>
                            <div class="detail-value">${client.phone}</div>
                        </div>
                    ` : ''}
                    
                    <div class="detail-item">
                        <i class="fas fa-money-bill"></i>
                        <div class="detail-label">Total Amount</div>
                        <div class="detail-value">Rs. ${client.amount.toLocaleString('en-PK')}</div>
                    </div>
                    
                    <div class="detail-item">
                        <i class="fas fa-check-circle"></i>
                        <div class="detail-label">Amount Paid</div>
                        <div class="detail-value">Rs. ${(client.totalPaid || 0).toLocaleString('en-PK')}</div>
                    </div>
                    
                    ${client.paymentType === 'monthly' ? `
                        <div class="detail-item">
                            <i class="fas fa-calendar-day"></i>
                            <div class="detail-label">Reminder Day</div>
                            <div class="detail-value">${client.reminderDay} of each month</div>
                        </div>
                    ` : ''}
                    
                    <div class="detail-item">
                        <i class="fas fa-user-shield"></i>
                        <div class="detail-label">Client Login ID</div>
                        <div class="detail-value">${client.clientCredentials?.userId || 'Not set'}</div>
                    </div>
                </div>
                
                ${client.notes ? `
                    <div style="margin-top: var(--spacing-lg);">
                        <h3><i class="fas fa-sticky-note"></i> Notes</h3>
                        <pre class="notes-pre">${client.notes}</pre>
                    </div>
                ` : ''}
                
                ${paymentsList.length > 0 ? `
                    <div style="margin-top: var(--spacing-lg);">
                        <h3><i class="fas fa-history"></i> Payment History</h3>
                        <div style="margin-top: var(--spacing-md);">
                            ${paymentsList.map(payment => `
                                <div style="
                                    background: var(--bg-secondary);
                                    padding: var(--spacing-md);
                                    border-radius: var(--border-radius-sm);
                                    margin-bottom: var(--spacing-sm);
                                    border-left: 3px solid var(--success-color);
                                ">
                                    <div style="display: flex; justify-content: space-between;">
                                        <strong>Rs. ${payment.amount.toLocaleString('en-PK')}</strong>
                                        <span style="color: var(--text-muted); font-size: 0.9rem;">
                                            ${new Date(payment.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    ${payment.note ? `<div style="margin-top: var(--spacing-xs); color: var(--text-muted);">${payment.note}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading client details:', error);
        container.innerHTML = '<div class="alert alert-error">Error loading details</div>';
    }
}

// Client Dashboard
async function loadClientDetails(clientEmail) {
    if (!checkAuth() || currentUser.role !== 'client') return;
    
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients.json`);
        const clients = await response.json();
        
        if (!clients) {
            DOM.clientDetailsContainer.innerHTML = createEmptyState('account');
            return;
        }
        
        const clientEntry = Object.entries(clients).find(([id, client]) => 
            client.email === clientEmail
        );
        
        if (!clientEntry) {
            DOM.clientDetailsContainer.innerHTML = createEmptyState('account');
            return;
        }
        
        const [id, client] = clientEntry;
        
        DOM.clientDetailsContainer.innerHTML = `
            <div class="client-card">
                <div class="client-card-header">
                    <div class="client-name">
                        <i class="fas fa-user-circle"></i> ${client.name}
                    </div>
                    <span class="payment-badge ${client.paymentType === 'monthly' ? 'badge-monthly' : 'badge-project'}">
                        <i class="fas ${client.paymentType === 'monthly' ? 'fa-calendar-alt' : 'fa-project-diagram'}"></i>
                        ${client.paymentType === 'monthly' ? 'Monthly' : 'Project'}
                    </span>
                </div>
                
                <div class="client-card-preview">
                    <div class="preview-item">
                        <span class="preview-label">Email</span>
                        <span class="preview-value">${client.email}</span>
                    </div>
                    
                    ${client.phone ? `
                        <div class="preview-item">
                            <span class="preview-label">Phone</span>
                            <span class="preview-value">${client.phone}</span>
                        </div>
                    ` : ''}
                    
                    <div class="preview-item">
                        <span class="preview-label">Payment Amount</span>
                        <span class="preview-value">Rs. ${client.amount.toLocaleString('en-PK')}</span>
                    </div>
                    
                    <div class="preview-item">
                        <span class="preview-label">Last Payment Date</span>
                        <span class="preview-value">
                            ${client.lastPaymentDate ? 
                                new Date(client.lastPaymentDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                }) : 
                                'No payments yet'}
                        </span>
                    </div>
                    
                    ${client.paymentType === 'monthly' ? `
                        <div class="preview-item">
                            <span class="preview-label">Payment Day</span>
                            <span class="preview-value">${client.reminderDay} of each month</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading client details:', error);
        DOM.clientDetailsContainer.innerHTML = `
            <div class="alert alert-error">
                <i class="fas fa-exclamation-triangle"></i> Error loading account details
            </div>
        `;
    }
}

// Stats and Analytics
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
    const monthlyRevenue = monthlyClients.reduce(
        (sum, c) => sum + Math.min(c.amount, c.totalPaid || 0),
        0
    );
    
    document.getElementById('totalClients').textContent = clientsArray.length;
    document.getElementById('monthlyClients').textContent = monthlyClients.length;
    document.getElementById('projectClients').textContent = projectClients.length;
    document.getElementById('monthlyRevenue').textContent = 
        `Rs. ${monthlyRevenue.toLocaleString('en-PK', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
}

// Payment Management
function openPaymentModal(clientId, amount) {
    document.getElementById('paymentClientId').value = clientId;
    document.getElementById('paymentAmount').value = amount;
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    DOM.paymentForm.reset();
}

async function handlePaymentFormSubmit(e) {
    e.preventDefault();
    
    const clientId = document.getElementById('paymentClientId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const mode = document.getElementById('paymentMode').value;
    const note = document.getElementById('paymentNote').value;
    
    // Get client data
    const clientRes = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`);
    const client = await clientRes.json();
    
    // Create payment record
    const paymentDate = new Date().toISOString();
    const cycle = client.paymentType === 'monthly' ? getBillingCycle(client.reminderDay) : null;
    
    const paymentRecord = {
        amount,
        note,
        date: paymentDate,
        mode,
        cycle
    };
    
    try {
        // Save payment
        await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}/payments.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentRecord)
        });
        
        // Update client
        const newTotalPaid = (client.totalPaid || 0) + amount;
        const updateData = {
            totalPaid: newTotalPaid,
            status: (client.amount - newTotalPaid) <= 0 ? 'paid' : 'due',
            lastPaymentDate: paymentDate
        };
        
        if (client.paymentType === 'monthly') {
            updateData.lastPaidCycle = cycle;
        }
        
        await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        closePaymentModal();
        loadClients();
        showAlert('Payment recorded successfully!', 'success');
        
    } catch (error) {
        console.error('Error recording payment:', error);
        showAlert('Error recording payment', 'error');
    }
}

// Helper Functions
function getBillingCycle(reminderDay) {
    const now = new Date();
    let month = now.getMonth();
    let year = now.getFullYear();
    
    if (now.getDate() < reminderDay) {
        month--;
        if (month < 0) {
            month = 11;
            year--;
        }
    }
    
    return `${year}-${month + 1}`;
}

async function resetMonthlyIfNeeded(client, clientId) {
    if (client.paymentType !== 'monthly') return;
    
    const currentCycle = getBillingCycle(client.reminderDay);
    
    if (client.lastPaidCycle && client.lastPaidCycle !== currentCycle) {
        await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalPaid: 0,
                status: 'due'
            })
        });
    }
}

// Reminder System
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

async function sendManualReminder(clientId) {
    if (!checkAuth() || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch(`${CONFIG.firebase.databaseURL}/clients/${clientId}.json`);
        const client = await response.json();
        
        await sendEmail(client, 1);
        showAlert(`Reminder sent to ${client.name}!`, 'success');
    } catch (error) {
        console.error('Error sending reminder:', error);
        showAlert('Error sending reminder', 'error');
    }
}

async function sendEmail(client, reminderNumber) {
    const templateParams = {
        to_name: client.name,
        to_email: client.email,
        client_name: client.name,
        client_email: client.email,
        amount: `Rs. ${client.amount.toLocaleString('en-PK')}`,
        payment_type: client.paymentType === 'monthly' ? 'Monthly' : 'Per Project',
        reminder_number: reminderNumber,
        reminder_day: client.reminderDay || 'N/A',
        client_notes: client.notes || '—'
    };
    
    try {
        await emailjs.send(
            CONFIG.emailjs.serviceId,
            CONFIG.emailjs.templateId,
            templateParams
        );
    } catch (error) {
        console.error('Email error:', error);
        throw error;
    }
}

// Alert System
function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-circle',
        info: 'info-circle'
    };
    
    alert.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
    
    DOM.alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function showLoginAlert(message, type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-circle',
        info: 'info-circle'
    };
    
    DOM.loginAlert.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}
        </div>
    `;
    
    setTimeout(() => {
        DOM.loginAlert.innerHTML = '';
    }, 4000);
}

// Activity Monitoring
function startInactivityMonitor() {
    lastActivityTime = Date.now();
    
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
}

function resetInactivityTimer() {
    lastActivityTime = Date.now();
}

function handleVisibilityChange() {
    if (document.hidden) {
        hiddenTime = Date.now();
    } else {
        if (hiddenTime > 0) {
            const timeHidden = Date.now() - hiddenTime;
            if (timeHidden > 120000) {
                logout();
                showAlert('Session expired due to screen being off', 'warning');
            }
        }
    }
}

// Utility Functions
function checkAuth() {
    const session = sessionStorage.getItem('userSession');
    if (!session) return false;
    
    try {
        const sessionData = JSON.parse(session);
        const currentTime = Date.now();
        
        if (currentTime - sessionData.loginTime > 24 * 60 * 60 * 1000) {
            logout();
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

function startReminderCheck() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkReminders, 3600000); // Check every hour
    checkReminders(); // Run immediately
}

async function deleteClient(id) {
    if (!checkAuth() || currentUser.role !== 'admin') return;
    
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
        return;
    }
    
    try {
        await fetch(`${CONFIG.firebase.databaseURL}/clients/${id}.json`, { 
            method: 'DELETE' 
        });
        
        showAlert('Client deleted successfully!', 'success');
        loadClients();
    } catch (error) {
        console.error('Error deleting client:', error);
        showAlert('Error deleting client', 'error');
    }
}

function createEmptyState(type) {
    const messages = {
        clients: {
            icon: 'fas fa-users',
            title: 'No clients yet',
            message: 'Add your first client to get started'
        },
        account: {
            icon: 'fas fa-user-slash',
            title: 'Account not found',
            message: 'Your account details could not be found. Please contact support.'
        }
    };
    
    const msg = messages[type] || messages.clients;
    
    return `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="${msg.icon}"></i></div>
            <h3>${msg.title}</h3>
            <p>${msg.message}</p>
        </div>
    `;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    stopInactivityMonitor();
});