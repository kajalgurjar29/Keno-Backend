import NSW from './src/models/NSWkenoDrawResult.model.js';
import VIC from './src/models/VICkenoDrawResult.model.js';
import ACT from './src/models/ACTkenoDrawResult.model.js';
import SA from './src/models/SAkenoDrawResult.model.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI + '/' + process.env.DB_NAME);
        const models = { NSW, VIC, ACT, SA };
        for (const [name, model] of Object.entries(models)) {
            const hasDrawDate = await model.findOne({ drawDate: { $exists: true } });
            console.log(`${name} has drawDate? ${!!hasDrawDate}`);
            if (hasDrawDate) console.log(hasDrawDate.toObject());

            const hasDate = await model.findOne({ date: { $exists: true } });
            console.log(`${name} has date? ${!!hasDate}`);
            if (hasDate) console.log('Sample date value:', hasDate.date);
        }
    } finally {
        await mongoose.disconnect();
    }
}
check();
