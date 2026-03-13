import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.model.js';
import Payment from './src/models/Payment.js';

dotenv.config();

async function checkUserStats() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const userId = "69a97e0c65aa0df002996396";

        const user = await User.findById(userId);
        console.log("--- User Record ---");
        console.log(JSON.stringify(user, null, 2));

        const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
        console.log("\n--- Payment Records ---");
        console.log(JSON.stringify(payments, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUserStats();
