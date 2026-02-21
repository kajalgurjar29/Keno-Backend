import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/NSWkenoDrawResult.model.js";
import VIC from "./src/models/VICkenoDrawResult.model.js";

async function checkLatestDefault() {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri);

        const latestNSW = await NSW.findOne().sort({ createdAt: -1 });
        const latestVIC = await VIC.findOne().sort({ createdAt: -1 });

        console.log(`NSW: Latest Draw ${latestNSW?.draw} on ${latestNSW?.date} (ID: ${latestNSW?.drawid})`);
        console.log(`VIC: Latest Draw ${latestVIC?.draw} on ${latestVIC?.date} (ID: ${latestVIC?.drawid})`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkLatestDefault();
