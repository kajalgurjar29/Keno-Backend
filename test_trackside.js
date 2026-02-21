import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { scrapeTrackSideResults as scrapeNSW } from "./src/controllers/TracksiteScaper/NSWTrackSideScraperScaping.controller.js";
import { scrapeTrackSideResults as scrapeVIC } from "./src/controllers/TracksiteScaper/VICTrackSideScraperScaping.controller.js";
import { scrapeTrackSideResults as scrapeACT } from "./src/controllers/TracksiteScaper/ACTTrackSideScraperScaping.controller.js";

async function runTrackside() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || "keno";
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : `${mongoUri}/${dbName}`;

        await mongoose.connect(connectionString);
        console.log("Connected to", dbName);

        console.log("--- NSW Trackside ---");
        await scrapeNSW();

        console.log("--- VIC Trackside ---");
        await scrapeVIC();

        console.log("--- ACT Trackside ---");
        await scrapeACT();

    } catch (err) {
        console.error("Trackside failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

runTrackside();
