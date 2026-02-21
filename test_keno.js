import dotenv from "dotenv";
dotenv.config();
import { scrapeNSWKenobyGame } from "./src/controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
import mongoose from "mongoose";

async function test() {
    try {
        console.log("Connecting to DB...");
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || "keno";
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : `${mongoUri}/${dbName}`;

        await mongoose.connect(connectionString);
        console.log("Connected to", dbName);

        console.log("Running NSW Scraper...");
        const result = await scrapeNSWKenobyGame();
        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

test();
