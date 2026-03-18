import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from './src/models/Payment.js';
import User from './src/models/User.model.js';

dotenv.config();

async function debugDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("📂 Connected to Shared Database.");

        const latestPayments = await Payment.find().sort({ createdAt: -1 }).limit(5);
        
        console.log("\n--- LATEST 5 PAYMENTS IN DB ---");
        if (latestPayments.length === 0) {
            console.log("❌ NO PAYMENT RECORDS FOUND IN DB. This means the session creation is not saving to the DB.");
        } else {
            latestPayments.forEach((p, i) => {
                console.log(`${i+1}. Session: ${p.stripeSessionId}`);
                console.log(`   Status: ${p.status}`);
                console.log(`   User ID: ${p.userId}`);
                console.log(`   Created At: ${p.createdAt}\n`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error("Error connecting to DB:", err.message);
        process.exit(1);
    }
}

debugDatabase();
