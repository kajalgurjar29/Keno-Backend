import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/NSWkenoDrawResult.model.js";
import VIC from "./src/models/VICkenoDrawResult.model.js";
import ACT from "./src/models/ACTkenoDrawResult.model.js";
import SA from "./src/models/SAkenoDrawResult.model.js";

async function check() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || "keno";
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : `${mongoUri}/${dbName}`;

        await mongoose.connect(connectionString);
        console.log("Connected to", dbName);

        const models = { NSW, VIC, ACT, SA };
        for (const [name, model] of Object.entries(models)) {
            const latest = await model.findOne().sort({ createdAt: -1 });
            if (latest) {
                console.log(`${name}: Latest Draw ${latest.draw} on ${latest.date} (Created: ${latest.createdAt.toLocaleString()})`);
            } else {
                console.log(`${name}: No data`);
            }
        }

    } catch (err) {
        console.error("Check failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
