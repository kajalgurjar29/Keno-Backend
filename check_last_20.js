import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/NSWkenoDrawResult.model.js";
import VIC from "./src/models/VICkenoDrawResult.model.js";
import ACT from "./src/models/ACTkenoDrawResult.model.js";
import SA from "./src/models/SAkenoDrawResult.model.js";

async function checkLast20() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : `${mongoUri}/${dbName}`;

        await mongoose.connect(connectionString);

        const states = [
            { name: "NSW", model: NSW },
            { name: "VIC", model: VIC },
            { name: "ACT", model: ACT },
            { name: "SA", model: SA }
        ];

        for (const state of states) {
            console.log(`\n--- Last 20 Games for ${state.name} ---`);
            const results = await state.model.find()
                .sort({ createdAt: -1 })
                .limit(20);

            if (results.length === 0) {
                console.log("No records found.");
                continue;
            }

            results.forEach(r => {
                console.log(`Draw ${r.draw}: ${r.numbers.join(',')} (Created: ${r.createdAt.toLocaleString()})`);
            });
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkLast20();
