import Favorite from "../../models/Favorite.model.js";
import VICTrackSideResult from "../../models/TrackSideResult.VIC.model.js";

// Add a new favorite
export const addFavorite = async (req, res) => {
    try {
        const { userId, numbers } = req.body;

        if (!userId || !numbers || !Array.isArray(numbers)) {
            return res.status(400).json({ message: "Invalid input data." });
        }

        const newFavorite = new Favorite({
            userId,
            numbers,
        });

        await newFavorite.save();

        res.status(201).json({
            message: "Favorite added successfully.",
            favorite: newFavorite,
        });
    } catch (error) {
        console.error("Error adding favorite:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Get favorites with stats
export const getFavorites = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 });

        // Fetch last 20 results from VICTrackSideResult (as a proxy for "latest results")
        const latestResults = await VICTrackSideResult.find()
            .sort({ timestamp: -1 })
            .limit(20);

        const favoritesWithStats = favorites.map((fav) => {
            const stats = {
                win: 0,
                quinella: 0,
                trifecta: 0,
            };

            const favNumbers = new Set(fav.numbers);

            latestResults.forEach((result) => {
                // Result numbers are usually ordered by position (1st, 2nd, 3rd...)
                // We need to check if favorite numbers appear in the winning positions.

                // Win: 1st number matches any of the favorite numbers?
                // Actually, "Favorite Number" usually means "My numbers".
                // In Keno/Trackside:
                // "Win": Did your number come 1st? (If you picked 1 number)
                // Or did your *selection* win?
                // The image shows "7-12-8-14". 
                // "Win 4 times", "Quinella 6 times", "Trifecta 9 times".
                // This suggests:
                // Win: One of my numbers was 1st.
                // Quinella: Two of my numbers were 1st and 2nd (in any order).
                // Trifecta: Three of my numbers were 1st, 2nd, and 3rd (in any order).

                if (result.numbers && result.numbers.length >= 3) {
                    const first = result.numbers[0];
                    const second = result.numbers[1];
                    const third = result.numbers[2];

                    // Check Win (1st place)
                    if (favNumbers.has(first)) {
                        stats.win++;
                    }

                    // Check Quinella (1st and 2nd)
                    if (favNumbers.has(first) && favNumbers.has(second)) {
                        stats.quinella++;
                    }

                    // Check Trifecta (1st, 2nd, 3rd)
                    if (favNumbers.has(first) && favNumbers.has(second) && favNumbers.has(third)) {
                        stats.trifecta++;
                    }
                }
            });

            return {
                ...fav.toObject(),
                stats,
            };
        });

        res.status(200).json({
            favorites: favoritesWithStats,
        });
    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Remove a favorite
export const removeFavorite = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Favorite ID is required." });
        }

        await Favorite.findByIdAndDelete(id);

        res.status(200).json({ message: "Favorite removed successfully." });
    } catch (error) {
        console.error("Error removing favorite:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};
