const puppeteer = require('puppeteer');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { default: PQueue } = require('p-queue');

class Scraper {
    constructor() {
        this.browser = null;
        this.queue = null;
        this.settings = {
            mode: 'gentle',
            concurrency: 1,
            delay: 25000,
            timeout: 60000
        };
        this.isStopping = false;
        this.isPolling = false;
    }

    async init(mode = 'gentle') {
        this.isStopping = false;
        this.settings.mode = mode;
        if (mode === 'full') {
            this.settings.concurrency = 5;
            this.settings.delay = 1000;
        } else {
            this.settings.concurrency = 1;
            this.settings.delay = 25000;
        }

        if (this.queue) {
            this.queue.clear();
        }

        this.queue = new PQueue({
            concurrency: this.settings.concurrency,
            interval: this.settings.delay,
            intervalCap: 1
        });

        await this.ensureBrowser();
    }

    async ensureBrowser() {
        if (!this.browser || !this.browser.connected) {
            console.log('Launching browser...');
            const isReplit = !!process.env.REPLIT_SLUG;
            const options = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ]
            };

            if (isReplit) {
                options.args.push('--disable-gpu', '--disable-dev-shm-usage', '--no-zygote');
                // On Replit with Nix, chromium is available via the nix environment.
                // We prefer letting the environment handle the path or specifying the likely Nix location.
                if (fs.existsSync('/nix/store')) {
                    // Try to find chromium in the path if not explicitly set
                    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 'chromium';
                } else {
                    options.executablePath = '/usr/bin/chromium-browser';
                }
            }

            this.browser = await puppeteer.launch(options);
            this.browser.on('disconnected', () => {
                console.warn('Browser disconnected.');
            });
        }
    }

    async parseSitemap(filePath) {
        const xml = fs.readFileSync(filePath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xml);

        const urls = result.urlset.url.map(entry => entry.loc[0]);
        console.log(`Parsed ${urls.length} URLs from sitemap.`);

        const insert = db.prepare('INSERT OR IGNORE INTO pages (url, status) VALUES (?, ?)');
        const transaction = db.transaction((items) => {
            for (const url of items) insert.run(url, 'queued');
        });

        transaction(urls);
        console.log('URLs added to database queue.');
    }

    async start() {
        if (this.isPolling) return;
        this.isPolling = true;
        console.log(`Starting scraper loop in ${this.settings.mode} mode.`);
        this.poll();
    }

    async poll() {
        if (this.isStopping) {
            this.isPolling = false;
            return;
        }

        const queued = db.prepare("SELECT url FROM pages WHERE status = 'queued' LIMIT 50").all();

        if (queued.length === 0) {
            // Wait and poll again
            setTimeout(() => this.poll(), 5000);
            return;
        }

        for (const item of queued) {
            // Only add if not already in p-queue
            if (this.queue.size < 100) {
                db.prepare('UPDATE pages SET status = ? WHERE url = ?').run('pending', item.url);
                this.queue.add(() => this.scrape(item.url));
            }
        }

        // Check again after some time
        setTimeout(() => this.poll(), 10000);
    }

    async scrape(url) {
        if (this.isStopping) return;
        console.log(`[${new Date().toISOString()}] Scraping: ${url}`);
        let page = null;
        try {
            await this.ensureBrowser();
            page = await this.browser.newPage();

            page.setDefaultNavigationTimeout(this.settings.timeout);
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            db.prepare('UPDATE pages SET status = ? WHERE url = ?').run('scraping', url);

            const response = await page.goto(url, { waitUntil: 'networkidle2' });

            if (!response) throw new Error('NO_RESPONSE');

            if (response.status() === 504 || response.status() === 429) {
                console.warn(`Hit a wall (HTTP ${response.status()}). Backing off...`);
                db.prepare('UPDATE pages SET status = ? WHERE url = ?').run('queued', url);
                await new Promise(r => setTimeout(r, 60000));
                return;
            }

            const data = await page.evaluate(() => {
                const title = document.querySelector('h1')?.innerText || document.title;
                const description = document.querySelector('.full-text')?.innerText || document.querySelector('.news-text')?.innerText || '';
                const tags = Array.from(document.querySelectorAll('.tag-list a, .tags a')).map(a => a.innerText);
                const images = Array.from(document.querySelectorAll('.gallery img, .full-content img')).map(img => img.src);
                const download_links = Array.from(document.querySelectorAll('a[href*="download"], a[href*="getfile"]')).map(a => a.href);

                return { title, description, tags, images, download_links };
            });

            db.prepare(`
                UPDATE pages 
                SET title = ?, description = ?, tags = ?, images = ?, download_links = ?, scraped_at = CURRENT_TIMESTAMP, status = 'scraped'
                WHERE url = ?
            `).run(
                data.title,
                data.description,
                JSON.stringify(data.tags),
                JSON.stringify(data.images),
                JSON.stringify(data.download_links),
                url
            );

            console.log(`Successfully scraped: ${data.title}`);

        } catch (error) {
            console.error(`Error scraping ${url}:`, error.message);
            // If connection closed, we might want to re-queue immediately
            const status = error.message.includes('Connection closed') ? 'queued' : 'error';
            db.prepare('UPDATE pages SET status = ?, last_error = ? WHERE url = ?').run(status, error.message, url);
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (e) { }
            }
        }
    }

    async stop() {
        console.log('Stopping scraper...');
        this.isStopping = true;
        this.isPolling = false;

        if (this.queue) {
            this.queue.clear();
        }

        db.prepare("UPDATE pages SET status = 'queued' WHERE status IN ('scraping', 'pending')").run();

        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) { }
            this.browser = null;
        }
        console.log('Scraper stopped.');
    }
}

module.exports = new Scraper();
