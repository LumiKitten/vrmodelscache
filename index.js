const scraper = require('./scraper');
const path = require('path');

async function main() {
    console.log('--- VRModels Cache System ---');

    // Check if sitemap needs parsing (one-time or check if DB is empty)
    const sitemapPath = path.join(__dirname, 'vrmodels_sitemap.xml');
    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`__dirname: ${__dirname}`);
    console.log(`Looking for sitemap at: ${sitemapPath}`);

    // For first run, parse the sitemap
    try {
        if (!require('fs').existsSync(sitemapPath)) {
            console.error(`Sitemap file NOT found at: ${sitemapPath}`);
        } else {
            await scraper.parseSitemap(sitemapPath);
        }
    } catch (err) {
        console.error('Sitemap parsing failed:', err.message);
    }

    // Start the server
    require('./server');
}

main();
