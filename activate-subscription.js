import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.model.js';

dotenv.config();

async function activateSubscription() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get user email from command line argument
        const email = process.argv[2];

        if (!email) {
            console.log('❌ Please provide an email address');
            console.log('Usage: node activate-subscription.js your-email@example.com');
            process.exit(1);
        }

        // Find and update user
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User not found with email: ${email}`);
            process.exit(1);
        }

        console.log(`\n📋 Current user status for ${email}:`);
        console.log(`   isSubscriptionActive: ${user.isSubscriptionActive}`);
        console.log(`   isSubscribed: ${user.isSubscribed}`);
        console.log(`   planType: ${user.planType}`);

        // Update subscription status
        user.isSubscriptionActive = true;
        user.isSubscribed = true;
        user.planType = 'monthly';
        user.subscriptionStart = new Date();
        user.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

        await user.save();

        console.log(`\n✅ Subscription activated successfully!`);
        console.log(`\n📋 Updated user status:`);
        console.log(`   isSubscriptionActive: ${user.isSubscriptionActive}`);
        console.log(`   isSubscribed: ${user.isSubscribed}`);
        console.log(`   planType: ${user.planType}`);
        console.log(`   subscriptionStart: ${user.subscriptionStart}`);
        console.log(`   subscriptionEnd: ${user.subscriptionEnd}`);

        console.log(`\n🎉 Done! Now:`);
        console.log(`   1. Clear your browser cache (Ctrl+Shift+Delete)`);
        console.log(`   2. Logout from the app`);
        console.log(`   3. Login again`);
        console.log(`   4. The subscription overlay should be gone!`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

activateSubscription();
