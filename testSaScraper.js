
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { scrapeSAKenoByGame } from "./src/controllers/kenoScraper/SAkenoDrawNumberScraper.controller.js";

const MONGO_URI = process.env.MONGO_URI;

async function test() {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected.");

        console.log("Starting SA Scraper test...");
        const result = await scrapeSAKenoByGame();
        console.log("Scraper result:", result);
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

test();
