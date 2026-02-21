import NSW from './src/models/NSWkenoDrawResult.model.js';
import VIC from './src/models/VICkenoDrawResult.model.js';
import ACT from './src/models/ACTkenoDrawResult.model.js';
import SA from './src/models/SAkenoDrawResult.model.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkHeadsTails() {
    try {
        await mongoose.connect(process.env.MONGO_URI + '/' + process.env.DB_NAME);
        const models = { NSW, VIC, ACT, SA };
        for (const [name, model] of Object.entries(models)) {
            const totalWith20 = await model.countDocuments({ numbers: { $size: 20 } });
            const missingResult = await model.countDocuments({ numbers: { $size: 20 }, result: { $exists: false } });
            const distinctResults = await model.distinct('result', { numbers: { $size: 20 } });
            console.log(`${name}: Total with 20 nums = ${totalWith20}, Missing result field = ${missingResult}`);
            console.log(`${name}: Distinct result values =`, distinctResults);

            // Sample a few records missing result but having numbers to see heads/tails fields
            if (missingResult > 0) {
                const sample = await model.findOne({ numbers: { $size: 20 }, result: { $exists: false } });
                console.log(`${name} Sample record missing result:`, JSON.stringify(sample, null, 2));
            }
        }
    } finally {
        await mongoose.disconnect();
    }
}
checkHeadsTails();
