
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const TrackSideResultSchema = new mongoose.Schema({
    gameId: { type: String },
    dividends: {
        quinella: { type: String },
        exacta: { type: String },
        trifecta: { type: String },
        first4: { type: String }
    }
}, { strict: false });

const NSW = mongoose.model('NSWTrackSideResult', TrackSideResultSchema, 'nswtracksideresults');
const VIC = mongoose.model('VICTrackSideResult', TrackSideResultSchema, 'victracksideresults');
const ACT = mongoose.model('ACTTrackSideResult', TrackSideResultSchema, 'acttracksideresults');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected');

        for (const [name, model] of [['NSW', NSW], ['VIC', VIC], ['ACT', ACT]]) {
            const total = await model.countDocuments();
            const withDivs = await model.countDocuments({ 'dividends.quinella': { $exists: true, $ne: "" } });
            console.log(`${name}: Total=${total}, WithDivs=${withDivs}`);
            if (withDivs > 0) {
                const sample = await model.findOne({ 'dividends.quinella': { $exists: true, $ne: "" } }).lean();
                console.log(`${name} Sample Dividends:`, JSON.stringify(sample.dividends, null, 2));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
