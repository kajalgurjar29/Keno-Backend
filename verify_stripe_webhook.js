import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.model.js';

dotenv.config();

async function verifyWebhook() {
    console.log("🚀 STARTING WEBHOOK VERIFICATION TEST\n");

    try {
        // 1. Connect to DB
        if (!process.env.MONGO_URI) {
            console.error("❌ MONGO_URI is missing from .env");
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log("📂 Connected to Database.");

        // 2. Find a test user
        const testUser = await User.findOne({ email: { $exists: true } });
        if (!testUser) {
            console.error("❌ No users found in database to test with. Please register a user first.");
            process.exit(1);
        }
        console.log(`👤 Testing with user: ${testUser.email} (ID: ${testUser._id})`);

        // Reset user status before test for certainty
        await User.findByIdAndUpdate(testUser._id, { isSubscriptionActive: false });
        console.log("🔄 Reset user isSubscriptionActive to 'false' for testing.");

        // 3. Prepare Mock Stripe Payload
        const payload = {
            id: "evt_test_verify_" + Date.now(),
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_test_" + Date.now(),
                    mode: "subscription",
                    customer: "cus_test_verify",
                    subscription: "sub_test_verify",
                    amount_total: 2999,
                    metadata: {
                        userId: testUser._id.toString(),
                        plan: "monthly"
                    }
                }
            }
        };

        // 4. Send Mock Webhook
        console.log("\n📡 Sending mock webhook request to server...");
        const serverUrl = 'http://127.0.0.1:3000/api/v1/stripe/webhook';
        
        try {
            const response = await axios.post(serverUrl, payload, {
                headers: {
                    'stripe-signature': 'mock',
                    'Content-Type': 'application/json'
                }
            });
            console.log("✅ Server acknowledged webhook:", response.data);
        } catch (err) {
            console.error("❌ Failed to reach server. Is your server running on port 3000?");
            console.error("Error:", err.message);
            process.exit(1);
        }

        // 5. Verify DB side effects
        console.log("\n⏳ Waiting 2 seconds for DB updates to complete...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        const updatedUser = await User.findById(testUser._id);
        
        console.log("\n--- VERIFICATION RESULTS ---");
        console.log(`Email: ${updatedUser.email}`);
        console.log(`isSubscriptionActive: ${updatedUser.isSubscriptionActive ? '✅ TRUE' : '❌ FALSE'}`);
        console.log(`isSubscribed: ${updatedUser.isSubscribed ? '✅ TRUE' : '❌ FALSE'}`);
        console.log(`Plan Type: ${updatedUser.planType}`);
        console.log(`Subscription End: ${updatedUser.subscriptionEnd}`);
        
        if (updatedUser.isSubscriptionActive) {
            console.log("\n✨ WEBHOOK INTEGRATION IS WORKING PERFECTLY! ✨");
        } else {
            console.log("\n❌ Webhook was received but DB update failed. Check your server logs.");
        }

        process.exit(0);
    } catch (err) {
        console.error("💥 TEST ERROR:", err);
        process.exit(1);
    }
}

verifyWebhook();
