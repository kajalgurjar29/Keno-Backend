
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const TrackSideResultSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true },
    dividends: {
        win: { type: String, default: "" },
        place: { type: String, default: "" },
        quinella: { type: String, default: "" },
        exacta: { type: String, default: "" },
        trifecta: { type: String, default: "" },
        first4: { type: String, default: "" }
    }
}, { strict: false });

const NSW = mongoose.model('NSWTrackSideResult', TrackSideResultSchema, 'clientnsw'); // Based on conversation history, collection might be clientnsw

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected');
        const count = await NSW.countDocuments();
        console.log('Total NSW records:', count);
        const records = await NSW.find({ 'dividends.quinella': { $ne: "", $exists: true } }).limit(5).lean();
        console.log('Sample records with dividends:', JSON.stringify(records, null, 2));

        const recordsWithNoDiv = await NSW.find({ 'dividends.quinella': "" }).limit(5).lean();
        console.log('Sample records with NO dividends:', JSON.stringify(recordsWithNoDiv, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
