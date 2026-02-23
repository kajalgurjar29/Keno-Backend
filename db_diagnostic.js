import { scrapeSAKenoByGame } from "./src/controllers/kenoScraper/SAkenoDrawNumberScraper.controller.js";

async function start() {
    process.env.MONGO_URI = "mongodb://localhost:27017/dummy"; // Dummy URI
    console.log("Starting scraper in DEBUG mode (DB errors will be ignored)...");
    try {
        const result = await scrapeSAKenoByGame();
        console.log("Scraper result (last game):", result);
    } catch (err) {
        console.error("Scraper run finished with error (likely DB):", err.message);
    }
}

start();
