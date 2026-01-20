import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/TrackSideResult.NSW.model.js";
import VIC from "./src/models/TrackSideResult.VIC.model.js";
import ACT from "./src/models/TrackSideResult.ACT.model.js";

const MODELS = [NSW, VIC, ACT];

// Helper from controller
const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

const run = async () => {
    try {
        console.log("Connecting to DB...");
        if (!process.env.MONGO_URI) { console.error("MONGO_URI not found"); return; }
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        console.log("Fetching last 5 games to verify DATA...");

        let allRaces = [];
        for (const M of MODELS) {
            const races = await M.find({}, { numbers: 1, runners: 1, createdAt: 1, date: 1 }).sort({ createdAt: -1 }).limit(5).lean();
            allRaces = allRaces.concat(races);
        }

        if (allRaces.length === 0) {
            console.log("No races found.");
            process.exit();
        }

        const race = allRaces[0];
        console.log("Latest Race Sample:");
        console.log("  Date:", race.date);
        console.log("  CreatedAt:", race.createdAt);
        console.log("  Numbers:", race.numbers);

        if (race.date) {
            console.log("SUCCESS: 'date' field is present.");
        } else {
            console.log("WARNING: 'date' field is missing.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

run();
