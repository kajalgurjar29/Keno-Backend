import dotenv from "dotenv";
dotenv.config();
import { scrapeNSWKenobyGame } from "./src/controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
import { scrapeVICKenoByGame } from "./src/controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";
import { scrapeACTKenoByGame } from "./src/controllers/kenoScraper/ACTkenoDrawNumberScraper.controller.js";
import { scrapeSAKenoByGame } from "./src/controllers/kenoScraper/SAkenoDrawNumberScraper.controller.js";
import mongoose from "mongoose";

async function runAll() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || "keno";
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : `${mongoUri}/${dbName}`;

        await mongoose.connect(connectionString);
        console.log("Connected to", dbName);

        console.log("--- NSW ---");
        await scrapeNSWKenobyGame();

        console.log("--- VIC ---");
        await scrapeVICKenoByGame();

        console.log("--- ACT ---");
        await scrapeACTKenoByGame();

        console.log("--- SA ---");
        await scrapeSAKenoByGame();

    } catch (err) {
        console.error("Run failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

runAll();
