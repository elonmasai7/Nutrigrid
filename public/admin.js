const loginSection = document.querySelector('#login-section');
const dashboardSection = document.querySelector('#dashboard');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const logoutButton = document.querySelector('#logout');
const requestList = document.querySelector('#request-list');
const exportButton = document.querySelector('#export-csv');
const filterStatus = document.querySelector('#filter-status');
const filterStart = document.querySelector('#filter-start');
const filterEnd = document.querySelector('#filter-end');
const applyFiltersButton = document.querySelector('#apply-filters');
const userManagement = document.querySelector('#user-management');
const userForm = document.querySelector('#user-form');
const userStatus = document.querySelector('#user-status');
const userList = document.querySelector('#user-list');

const counters = {
  new: document.querySelector('#count-new'),
  reviewing: document.querySelector('#count-reviewing'),
  scheduled: document.querySelector('#count-scheduled'),
  closed: document.querySelector('#count-closed'),
};

const statusLabels = {
  new: 'New',
  reviewing: 'Reviewing',
  scheduled: 'Scheduled',
  closed: 'Closed',
};

const formatDate = (value) => {
  const date = new Date(value);
  return date.toLocaleString();
};

const updateCounters = (requests) => {
  const counts = { new: 0, reviewing: 0, scheduled: 0, closed: 0 };
  requests.forEach((req) => {
    if (counts[req.status] !== undefined) {
      counts[req.status] += 1;
    }
  });
  Object.keys(counts).forEach((key) => {
    counters[key].textContent = counts[key];
  });
};

const renderRequests = (requests) => {
  if (!requestList) {
    return;
  }

  requestList.innerHTML = '';

  if (requests.length === 0) {
    requestList.innerHTML = '<p class="muted">No requests yet.</p>';
    return;
  }

  requests.forEach((req) => {
    const item = document.createElement('div');
    item.className = 'request-item';
    item.innerHTML = `
      <div>
        <div class="request-title">${req.organization} · ${req.region}</div>
        <div class="request-meta">${req.name} · ${req.email}</div>
        <div class="request-meta">${formatDate(req.created_at)}</div>
        <p class="request-message">${req.message || 'No additional notes.'}</p>
      </div>
      <div class="request-actions">
        <span class="status-pill status-${req.status}">${statusLabels[req.status]}</span>
        <select data-id="${req.id}">
          <option value="new" ${req.status === 'new' ? 'selected' : ''}>New</option>
          <option value="reviewing" ${req.status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
          <option value="scheduled" ${req.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
          <option value="closed" ${req.status === 'closed' ? 'selected' : ''}>Closed</option>
        </select>
      </div>
    `;
    requestList.appendChild(item);
  });

  requestList.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', async (event) => {
      const id = event.target.dataset.id;
      const status = event.target.value;
      await fetch(`/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await loadRequests();
    });
  });
};

const buildFilterParams = () => {
  const params = new URLSearchParams();
  if (filterStatus?.value) params.set('status', filterStatus.value);
  if (filterStart?.value) params.set('start', filterStart.value);
  if (filterEnd?.value) params.set('end', filterEnd.value);
  return params;
};

const loadRequests = async () => {
  const params = buildFilterParams();
  const query = params.toString();
  const response = await fetch(query ? `/api/admin/requests?${query}` : '/api/admin/requests');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  updateCounters(data.requests);
  renderRequests(data.requests);
};

const loadUsers = async () => {
  if (!userList) {
    return;
  }
  const response = await fetch('/api/admin/users');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  userList.innerHTML = '';

  data.users.forEach((user) => {
    const item = document.createElement('div');
    item.className = 'request-item';
    item.innerHTML = `
      <div>
        <div class="request-title">${user.email}</div>
        <div class="request-meta">Role: ${user.role}</div>
        <div class="request-meta">Created: ${formatDate(user.created_at)}</div>
      </div>
      <div class="request-actions">
        <span class="status-pill status-${user.disabled ? 'closed' : 'scheduled'}">
          ${user.disabled ? 'Disabled' : 'Active'}
        </span>
        <button class="ghost" data-id="${user.id}" data-disabled="${user.disabled}">
          ${user.disabled ? 'Enable' : 'Disable'}
        </button>
      </div>
    `;
    userList.appendChild(item);
  });

  userList.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const id = event.target.dataset.id;
      const disabled = event.target.dataset.disabled === 'true' ? 0 : 1;
      await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled }),
      });
      await loadUsers();
    });
  });
};

const showDashboard = () => {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  logoutButton.classList.remove('hidden');
  if (exportButton) {
    exportButton.classList.remove('hidden');
  }
  loadRequests();
};

const showLogin = () => {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
  logoutButton.classList.add('hidden');
  if (exportButton) {
    exportButton.classList.add('hidden');
  }
};

const checkSession = async () => {
  const response = await fetch('/api/me');
  const data = await response.json();
  if (data.user) {
    showDashboard();
    if (exportButton && data.user.role !== 'admin') {
      exportButton.classList.add('hidden');
    }
    if (userManagement && data.user.role !== 'admin') {
      userManagement.classList.add('hidden');
    }
    if (userManagement && data.user.role === 'admin') {
      userManagement.classList.remove('hidden');
      loadUsers();
    }
  } else {
    showLogin();
  }
};

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.textContent = 'Signing in...';

    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      loginStatus.textContent = 'Invalid credentials.';
      return;
    }

    loginStatus.textContent = '';
    loginForm.reset();
    showDashboard();
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
  });
}

if (exportButton) {
  exportButton.addEventListener('click', () => {
    const params = buildFilterParams();
    const query = params.toString();
    window.location.href = query ? `/api/admin/requests.csv?${query}` : '/api/admin/requests.csv';
  });
}

if (applyFiltersButton) {
  applyFiltersButton.addEventListener('click', () => {
    loadRequests();
  });
}

if (userForm) {
  userForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    userStatus.textContent = 'Creating...';
    const formData = new FormData(userForm);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      userStatus.textContent = data.error || 'Failed to create user.';
      return;
    }
    userStatus.textContent = 'User created.';
    userForm.reset();
    loadUsers();
  });
}

checkSession();
