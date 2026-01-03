# VRModels Portal (Fast Local Mirror)

A high-performance local frontend and scraper for VRModels, designed to bypass extreme server latency and provide a premium browsing experience.

## Features

- **Blazing Fast**: Loads cached models instantly from a local SQLite database.
- **Resilient Scraper**: Polling-based architecture that handles 504 errors and browser crashes.
- **Premium UI**: Modern dark-mode interface with glassmorphism and real-time search.
- **Database Management**: Dashboard for monitoring stats, resetting progress, or retrying errors.
- **Detail View**: Full metadata extraction including descriptions, tags, and direct download links.

## Tech Stack

- **Backend**: Node.js, Express, Better-SQLite3
- **Scraper**: Puppeteer, P-Queue
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+)

## Getting Started

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the portal:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser.

## Scraper Modes

- **Gentle**: 25s delay between requests to avoid server strain.
- **Full Speed**: 5s delay with higher concurrency for rapid initial population.

---
*Note: This project is for personal use to improve browsing performance on slow-responding sites.*
