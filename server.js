const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Search models
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    const results = db.prepare(`
        SELECT url, title, images, tags, status, description, download_links 
        FROM pages 
        WHERE (title LIKE ? OR tags LIKE ?) AND status = 'scraped'
        LIMIT 50
    `).all(`%${query}%`, `%${query}%`);

    res.json(results.map(r => ({
        ...r,
        images: JSON.parse(r.images),
        tags: JSON.parse(r.tags),
        download_links: JSON.parse(r.download_links)
    })));
});

// Get scraper status
app.get('/api/status', (req, res) => {
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'scraped' THEN 1 ELSE 0 END) as scraped,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
        FROM pages
    `).get();

    res.json(stats);
});

// Trigger scraper settings/start (Optional: could be manual/CLI)
app.post('/api/scraper/start', async (req, res) => {
    const { mode } = req.body;
    try {
        await scraper.init(mode);
        // Don't await start() as it's long running
        scraper.start();
        res.json({ message: `Scraper started in ${mode} mode` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/scraper/stop', async (req, res) => {
    try {
        await scraper.stop();
        res.json({ message: 'Scraper stopped' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Database Management

// Reset all items to queued status
app.post('/api/db/reset', (req, res) => {
    try {
        db.prepare("UPDATE pages SET status = 'queued', last_error = NULL").run();
        res.json({ message: 'All items have been re-queued.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Re-queue only errors
app.post('/api/db/reset-errors', (req, res) => {
    try {
        db.prepare("UPDATE pages SET status = 'queued', last_error = NULL WHERE status = 'error'").run();
        res.json({ message: 'Errors have been re-queued.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Re-queue specific item
app.post('/api/db/requeue', (req, res) => {
    const { url } = req.body;
    try {
        db.prepare("UPDATE pages SET status = 'queued', last_error = NULL WHERE url = ?").run(url);
        res.json({ message: `Item ${url} re-queued.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete specific item
app.post('/api/db/delete', (req, res) => {
    const { url } = req.body;
    try {
        db.prepare("DELETE FROM pages WHERE url = ?").run(url);
        res.json({ message: `Item ${url} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
