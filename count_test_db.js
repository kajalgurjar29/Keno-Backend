import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/NSWkenoDrawResult.model.js";
import VIC from "./src/models/VICkenoDrawResult.model.js";

async function countTestDB() {
    try {
        const mongoUri = process.env.MONGO_URI;
        // Connecting WITHOUT specifying keno, which should use 'test'
        await mongoose.connect(mongoUri);
        console.log("Connected to default DB");

        const nswCount = await NSW.countDocuments();
        const vicCount = await VIC.countDocuments();
        console.log(`NSW Count in default DB: ${nswCount}`);
        console.log(`VIC Count in default DB: ${vicCount}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

countTestDB();
