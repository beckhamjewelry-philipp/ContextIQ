// ContextIQ Customer Management - Client Application

const API_BASE = window.location.origin + '/api';

// Tab Management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Show selected tab
    event.target.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');

    // Load data for tab
    if (tabName === 'customers') {
        loadCustomers();
    } else if (tabName === 'stats') {
        loadStats();
    }
}

// Customers
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers?limit=100`);
        const data = await response.json();

        const listEl = document.getElementById('customer-list');

        if (data.customers.length === 0) {
            listEl.innerHTML = '<p class="info">No customers found. Create your first customer!</p>';
            return;
        }

        listEl.innerHTML = data.customers.map(customer => `
            <div class="customer-card" onclick="viewCustomer('${customer.id}')">
                <h3>${customer.name}</h3>
                <div class="email">${customer.email || 'No email'}</div>
                <div class="meta">
                    <span class="badge ${customer.status}">${customer.status}</span>
                    <span>$${customer.lifetime_value.toFixed(2)} LTV</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading customers:', error);
        document.getElementById('customer-list').innerHTML = '<p class="error">Error loading customers</p>';
    }
}

async function searchCustomers() {
    const query = document.getElementById('search-input').value;
    if (!query) {
        return loadCustomers();
    }

    try {
        const response = await fetch(`${API_BASE}/search/customers?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        const listEl = document.getElementById('customer-list');

        if (data.results.length === 0) {
            listEl.innerHTML = `<p class="info">No customers found matching "${query}"</p>`;
            return;
        }

        listEl.innerHTML = data.results.map(customer => `
            <div class="customer-card" onclick="viewCustomer('${customer.id}')">
                <h3>${customer.name}</h3>
                <div class="email">${customer.email || 'No email'}</div>
                <div class="meta">
                    <span class="badge ${customer.status}">${customer.status}</span>
                    <span>$${customer.lifetime_value.toFixed(2)} LTV</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error searching customers:', error);
    }
}

function showCreateCustomer() {
    document.getElementById('create-customer-modal').classList.add('active');
}

async function createCustomer(e) {
    e.preventDefault();

    const tags = document.getElementById('customer-tags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

    const customer = {
        name: document.getElementById('customer-name').value,
        email: document.getElementById('customer-email').value,
        phone: document.getElementById('customer-phone').value,
        company: document.getElementById('customer-company').value,
        status: document.getElementById('customer-status').value,
        tags: tags
    };

    try {
        const response = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });

        if (response.ok) {
            alert('Customer created successfully!');
            closeModal();
            loadCustomers();
            document.getElementById('create-customer-form').reset();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error creating customer:', error);
        alert('Error creating customer');
    }
}

async function viewCustomer(customerId) {
    const modal = document.getElementById('customer-detail-modal');
    const content = document.getElementById('customer-detail-content');

    modal.classList.add('active');
    content.innerHTML = '<p class="loading">Loading customer context...</p>';

    try {
        const response = await fetch(`${API_BASE}/customers/${customerId}/context`);
        const data = await response.json();

        if (!data.context) {
            content.innerHTML = '<p class="error">Error loading customer</p>';
            return;
        }

        const ctx = data.context;
        const customer = ctx.customer;

        content.innerHTML = `
            <div class="context-section">
                <h3>Profile</h3>
                <p><strong>Name:</strong> ${customer.name}</p>
                <p><strong>Email:</strong> ${customer.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${customer.phone || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="badge ${customer.status}">${customer.status}</span></p>
                <p><strong>Lifetime Value:</strong> $${customer.lifetime_value.toFixed(2)}</p>
                <p><strong>Customer Since:</strong> ${new Date(customer.customer_since * 1000).toLocaleDateString()}</p>
            </div>

            <div class="context-section">
                <h3>AI Context Summary</h3>
                <pre>${ctx.ai_context_summary}</pre>
            </div>

            ${ctx.recent_activity && ctx.recent_activity.length > 0 ? `
                <div class="context-section">
                    <h3>Recent Activity (${ctx.recent_activity.length})</h3>
                    ${ctx.recent_activity.slice(0, 5).map(event => `
                        <div class="timeline-item">
                            <h4>[${event.event_type}] ${event.title}</h4>
                            <div class="date">${new Date(event.event_date * 1000).toLocaleDateString()}</div>
                            <div class="description">${event.description || 'No description'}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('Error loading customer:', error);
        content.innerHTML = '<p class="error">Error loading customer context</p>';
    }
}

// Timeline
async function loadTimeline() {
    const customerId = document.getElementById('timeline-customer-id').value;
    if (!customerId) {
        alert('Please enter a customer ID');
        return;
    }

    const viewEl = document.getElementById('timeline-view');
    viewEl.innerHTML = '<p class="loading">Loading timeline...</p>';

    try {
        const response = await fetch(`${API_BASE}/customers/${customerId}/timeline?limit=100`);
        const data = await response.json();

        if (data.timeline.length === 0) {
            viewEl.innerHTML = '<p class="info">No events found for this customer</p>';
            return;
        }

        viewEl.innerHTML = `
            <h3>Customer Timeline (${data.timeline.length} events)</h3>
            ${data.timeline.map(event => `
                <div class="timeline-item">
                    <h4>[${event.event_type}] ${event.title}</h4>
                    <div class="date">${new Date(event.event_date * 1000).toLocaleString()}</div>
                    <div class="description">${event.description || 'No description'}</div>
                    ${event.amount ? `<p><strong>Amount:</strong> $${event.amount}</p>` : ''}
                    <p><strong>Source:</strong> ${event.source_service}</p>
                </div>
            `).join('')}
        `;
    } catch (error) {
        console.error('Error loading timeline:', error);
        viewEl.innerHTML = '<p class="error">Error loading timeline</p>';
    }
}

// Statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const data = await response.json();
        const stats = data.stats;

        const viewEl = document.getElementById('stats-view');

        viewEl.innerHTML = `
            <div class="stat-card">
                <h3>${stats.customers.total}</h3>
                <p>Total Customers</p>
            </div>

            <div class="stat-card">
                <h3>${stats.events.total}</h3>
                <p>Total Events</p>
            </div>

            <div class="stat-card">
                <h3>$${stats.purchases.total_revenue.toFixed(0)}</h3>
                <p>Total Revenue</p>
            </div>

            <div class="stat-card">
                <h3>${stats.work_orders.open}</h3>
                <p>Open Work Orders</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats-view').innerHTML = '<p class="error">Error loading statistics</p>';
    }
}

// Events
async function createEvent(e) {
    e.preventDefault();

    const event = {
        customer_id: document.getElementById('event-customer-id').value,
        event_type: document.getElementById('event-type').value,
        timestamp: Math.floor(Date.now() / 1000),
        source_service: 'web-ui',
        data: {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            amount: parseFloat(document.getElementById('event-amount').value) || undefined
        }
    };

    try {
        const response = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });

        if (response.ok) {
            alert('Event created successfully!');
            document.getElementById('event-form').reset();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error creating event:', error);
        alert('Error creating event');
    }
}

// Modal Management
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal();
    }
};

// Search on Enter key
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchCustomers();
            }
        });
    }

    // Load initial data
    loadCustomers();
});
