
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const TrackSideResultSchema = new mongoose.Schema({}, { strict: false });

const NSW = mongoose.model('NSW', TrackSideResultSchema, 'nswtracksideresults');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected');

        const withPayouts = await NSW.countDocuments({ 'payouts.quinella': { $exists: true, $ne: null } });
        console.log('Total with payouts:', withPayouts);

        if (withPayouts > 0) {
            const sample = await NSW.findOne({ 'payouts.quinella': { $exists: true, $ne: null } }).lean();
            console.log('Sample payout:', JSON.stringify(sample.payouts, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
