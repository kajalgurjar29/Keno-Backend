import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/NSWkenoDrawResult.model.js";
import VIC from "./src/models/VICkenoDrawResult.model.js";
import ACT from "./src/models/ACTkenoDrawResult.model.js";
import SA from "./src/models/SAkenoDrawResult.model.js";

async function countAll() {
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
            const count = await model.countDocuments();
            const latest = await model.findOne().sort({ createdAt: -1 });
            console.log(`${name}: Count=${count}, Latest Draw=${latest?.draw} (${latest?.date})`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

countAll();
