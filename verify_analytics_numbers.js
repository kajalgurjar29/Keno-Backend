import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import NSW from "./src/models/NSWkenoDrawResult.model.js";
import VIC from "./src/models/VICkenoDrawResult.model.js";
import ACT from "./src/models/ACTkenoDrawResult.model.js";
import SA from "./src/models/SAkenoDrawResult.model.js";

async function verifyAnalytics() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : (mongoUri.endsWith('/') ? `${mongoUri}${dbName}` : `${mongoUri}/${dbName}`);

        await mongoose.connect(connectionString);
        console.log("Connected to:", dbName);

        const MODELS = [NSW, VIC, ACT, SA];
        let allGames = [];
        for (const M of MODELS) {
            const games = await M.find({}, { numbers: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(360).lean();
            allGames = allGames.concat(games);
        }
        allGames.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (allGames.length > 360) allGames = allGames.slice(-360);

        const totalGames = allGames.length;
        const stats = {};
        for (let i = 1; i <= 80; i++) stats[i] = { count: 0, lastIndex: -1 };

        allGames.forEach((game, index) => {
            game.numbers.forEach(n => {
                if (stats[n]) {
                    stats[n].count++;
                    stats[n].lastIndex = index;
                }
            });
        });

        const sortedHot = Object.entries(stats).map(([num, data]) => ({
            num: parseInt(num),
            hits: data.count,
            drought: totalGames - 1 - data.lastIndex
        })).sort((a, b) => b.hits - a.hits).slice(0, 10);

        const sortedCold = Object.entries(stats).map(([num, data]) => ({
            num: parseInt(num),
            hits: data.count,
            drought: totalGames - 1 - data.lastIndex
        })).sort((a, b) => b.drought - a.drought).slice(0, 10);

        console.log("\n🔥 TOP 10 HOT (By Hits):");
        sortedHot.forEach((h, i) => console.log(`${i + 1}. #${h.num} - ${h.hits} hits (Drought: ${h.drought})`));

        console.log("\n❄️ TOP 10 COLD (By Current Drought):");
        sortedCold.forEach((h, i) => console.log(`${i + 1}. #${h.num} - Drought: ${h.drought} (Hits: ${h.hits})`));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

verifyAnalytics();
