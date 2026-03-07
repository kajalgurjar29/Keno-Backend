
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const TrackSideResultSchema = new mongoose.Schema({}, { strict: false });

const NSW = mongoose.model('NSW', TrackSideResultSchema, 'nswtracksideresults');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected');

        const sample = await NSW.findOne({}).sort({ createdAt: -1 }).lean();
        console.log('Sample record (latest):', JSON.stringify(sample, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
