import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const NSW = mongoose.model('nswtracksideresult', new mongoose.Schema({ gameNumber: Number, date: String, numbers: [Number], runners: Array, createdAt: Date }));
    const races = await NSW.find({ gameNumber: 446 }).lean();
    console.log(races.map(r => ({ g: r.gameNumber, n: r.numbers, date: r.date, id: r._id })));
    process.exit(0);
}
check();
