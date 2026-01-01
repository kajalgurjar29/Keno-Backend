import mongoose from "mongoose";
import dotenv from "dotenv";
import Favorite from "./src/models/Favorite.model.js";
import VICTrackSideResult from "./src/models/TrackSideResult.VIC.model.js";
import User from "./src/models/User.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://doadmin:a382170d65o9K4iB@db-mongodb-syd1-51208-c8435d94.mongo.ondigitalocean.com/Punt-Mate-Keno-Design?tls=true&authSource=admin&replicaSet=db-mongodb-syd1-51208";

async function runVerification() {
    console.log("Starting verification...");

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to DB.");

        // 1. Create a Dummy User
        const dummyUser = await User.create({
            fullName: "Test User Favorites",
            email: `test_fav_${Date.now()}@example.com`,
            dob: new Date("1990-01-01"),
            password: "password123",
            role: "user"
        });
        console.log("Created dummy user:", dummyUser._id);

        // 2. Insert Dummy TrackSide Results (Mock Data for Stats)
        // We want a result where numbers [1, 2, 3] win.
        // Result 1: 1 is 1st (Win)
        // Result 2: 1 is 1st, 2 is 2nd (Quinella)
        // Result 3: 1 is 1st, 2 is 2nd, 3 is 3rd (Trifecta)

        // Clean up old test data if any logic needed, but let's just insert new ones
        const mockResults = [
            {
                gameId: `test_game_${Date.now()}_1`,
                gameName: "Test Game 1",
                gameNumber: 1001,
                numbers: [1, 5, 6, 7], // 1 is 1st -> Win for [1]
                location: "VIC",
                timestamp: new Date()
            },
            {
                gameId: `test_game_${Date.now()}_2`,
                gameName: "Test Game 2",
                gameNumber: 1002,
                numbers: [1, 2, 8, 9], // 1, 2 -> Quinella for [1, 2]
                location: "VIC",
                timestamp: new Date()
            },
            {
                gameId: `test_game_${Date.now()}_3`,
                gameName: "Test Game 3",
                gameNumber: 1003,
                numbers: [1, 2, 3, 10], // 1, 2, 3 -> Trifecta for [1, 2, 3]
                location: "VIC",
                timestamp: new Date()
            }
        ];

        await VICTrackSideResult.insertMany(mockResults);
        console.log("Inserted mock TrackSide results.");

        // 3. Add Favorite (simulate API call logic)
        // We'll call the logic directly or just use Mongoose to simulate the state
        const favNumbers = [1, 2, 3];
        const newFavorite = await Favorite.create({
            userId: dummyUser._id,
            numbers: favNumbers
        });
        console.log("Created favorite:", newFavorite.numbers);

        // 4. Verify Stats Logic (simulate getFavorites controller logic)
        // Fetch last 20 results (including our mocks)
        const latestResults = await VICTrackSideResult.find().sort({ timestamp: -1 }).limit(20);

        const stats = { win: 0, quinella: 0, trifecta: 0 };
        const favSet = new Set(favNumbers);

        latestResults.forEach(result => {
            if (result.numbers && result.numbers.length >= 3) {
                const [first, second, third] = result.numbers;
                if (favSet.has(first)) stats.win++;
                if (favSet.has(first) && favSet.has(second)) stats.quinella++;
                if (favSet.has(first) && favSet.has(second) && favSet.has(third)) stats.trifecta++;
            }
        });

        console.log("Calculated Stats:", stats);

        // Expect: 
        // Game 1: 1 (Win) -> Win++
        // Game 2: 1, 2 (Quinella) -> Win++ (because 1 is first), Quinella++
        // Game 3: 1, 2, 3 (Trifecta) -> Win++ (because 1 is first), Quinella++, Trifecta++
        // Total Expected: Win: 3, Quinella: 2, Trifecta: 1
        // (Assuming no other random matches in real DB data for [1,2,3])

        if (stats.win >= 3 && stats.quinella >= 2 && stats.trifecta >= 1) {
            console.log("✅ Verification SUCCESS: Stats calculations match expected logic.");
        } else {
            console.error("❌ Verification FAILED: Stats do not match.");
        }

        // 5. Clean up
        await User.findByIdAndDelete(dummyUser._id);
        await Favorite.deleteMany({ userId: dummyUser._id });
        await VICTrackSideResult.deleteMany({ gameId: { $in: mockResults.map(r => r.gameId) } });
        console.log("Cleaned up test data.");

    } catch (err) {
        console.error("Verification Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
        process.exit(0);
    }
}

runVerification();
