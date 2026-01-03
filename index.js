const scraper = require('./scraper');
const path = require('path');

async function main() {
    console.log('--- VRModels Cache System ---');

    // Check if sitemap needs parsing (one-time or check if DB is empty)
    const sitemapPath = path.join(__dirname, 'vrmodels_sitemap.xml');

    // For first run, parse the sitemap
    try {
        await scraper.parseSitemap(sitemapPath);
    } catch (err) {
        console.error('Sitemap parsing failed:', err.message);
    }

    // Start the server
    require('./server');
}

main();
