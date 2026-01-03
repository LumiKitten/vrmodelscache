const searchInput = document.getElementById('search-input');
const resultsGrid = document.getElementById('results-grid');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const manageBtn = document.getElementById('manage-btn');
const manageModal = document.getElementById('manage-modal');
const closeModal = document.getElementById('close-modal');
const resetBtn = document.getElementById('reset-db-btn');
const requeueErrorsBtn = document.getElementById('requeue-errors-btn');
const logContainer = document.getElementById('log-container');

const detailModal = document.getElementById('detail-modal');
const closeDetail = document.getElementById('close-detail');
const detailTitle = document.getElementById('detail-title');
const detailImage = document.getElementById('detail-image');
const detailTags = document.getElementById('detail-tags');
const detailDesc = document.getElementById('detail-description');
const detailDownloads = document.getElementById('detail-downloads');
const detailSource = document.getElementById('detail-source');
const stats = {
    total: document.getElementById('stat-total'),
    scraped: document.getElementById('stat-scraped'),
    errors: document.getElementById('stat-errors'),
    percent: document.getElementById('progress-percent'),
    fill: document.getElementById('progress-fill')
};

let debounceTimer;

// Fetch and display results
async function fetchResults(query = '') {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        renderResults(data);
    } catch (err) {
        console.error('Failed to fetch results:', err);
    }
}

function renderResults(results) {
    if (results.length === 0) {
        resultsGrid.innerHTML = '<div class="loading-state">No cached models found. Start the scraper to see results.</div>';
        return;
    }

    resultsGrid.innerHTML = '';
    results.forEach(model => {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${model.images ? model.images[0] : ''}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23222%22/%3E%3C/svg%3E'" alt="${model.title}">
            </div>
            <div class="card-content">
                <h3>${model.title}</h3>
                <div class="tag-cloud">
                    ${model.tags ? model.tags.slice(0, 4).map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                </div>
            </div>
        `;
        card.onclick = () => openDetail(model);
        resultsGrid.appendChild(card);
    });
}

function openDetail(model) {
    detailTitle.innerText = model.title;
    detailImage.src = model.images && model.images[0] ? model.images[0] : '';
    detailDesc.innerText = model.description || 'No description available.';
    detailTags.innerHTML = (model.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
    detailSource.href = model.url;

    detailDownloads.innerHTML = (model.download_links || []).length > 0
        ? model.download_links.map(link => `<a href="${link}" target="_blank" class="download-link">🔗 ${new URL(link).hostname}</a>`).join('')
        : '<p style="color: var(--text-dim)">No download links found yet.</p>';

    detailModal.classList.add('active');
}

// Update status and stats
async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        stats.total.innerText = data.total;
        stats.scraped.innerText = data.scraped;
        stats.errors.innerText = data.errors;

        const percent = data.total > 0 ? Math.round((data.scraped / data.total) * 100) : 0;
        stats.percent.innerText = `${percent}%`;
        stats.fill.style.width = `${percent}%`;
    } catch (err) {
        console.error('Failed to update status:', err);
    }
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchResults(e.target.value);
    }, 300);
});

startBtn.addEventListener('click', async () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    startBtn.disabled = true;
    startBtn.innerText = 'Scraper Running...';
    stopBtn.disabled = false;

    try {
        await fetch('/api/scraper/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
    } catch (err) {
        console.error('Failed to start scraper:', err);
        startBtn.disabled = false;
        startBtn.innerText = 'Start Scraper';
        stopBtn.disabled = true;
    }
});

stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    stopBtn.innerText = 'Stopping...';

    try {
        await fetch('/api/scraper/stop', { method: 'POST' });
        startBtn.disabled = false;
        startBtn.innerText = 'Start Scraper';
        stopBtn.innerText = 'Stop';
    } catch (err) {
        console.error('Failed to stop scraper:', err);
        stopBtn.disabled = false;
        stopBtn.innerText = 'Stop';
    }
});

// Modal Logic
manageBtn.addEventListener('click', () => manageModal.classList.add('active'));
closeModal.addEventListener('click', () => manageModal.classList.remove('active'));
closeDetail.addEventListener('click', () => detailModal.classList.remove('active'));

window.addEventListener('click', (e) => {
    if (e.target === manageModal) manageModal.classList.remove('active');
    if (e.target === detailModal) detailModal.classList.remove('active');
});

function addLog(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.prepend(entry);
}

// DB Actions
resetBtn.addEventListener('click', async () => {
    if (!confirm('Are you absolutely sure? This will wipe all scraped metadata.')) return;

    try {
        const response = await fetch('/api/db/reset', { method: 'POST' });
        const data = await response.json();
        addLog(data.message);
        updateStatus();
        fetchResults();
    } catch (err) {
        addLog(`Error: ${err.message}`);
    }
});

requeueErrorsBtn.addEventListener('click', async () => {
    // Note: We need a backend endpoint for this or just update status = 'error' to 'queued'
    // I already implemented /api/db/reset which resets everything, let's add a specific error reset
    try {
        const response = await fetch('/api/db/reset-errors', { method: 'POST' }); // I'll add this to server.js
        const data = await response.json();
        addLog(data.message);
        updateStatus();
    } catch (err) {
        addLog(`Error: ${err.message}`);
    }
});

// Initial Load
fetchResults();
updateStatus();
setInterval(updateStatus, 5000);
setInterval(() => { if (searchInput.value === '') fetchResults(); }, 10000);
