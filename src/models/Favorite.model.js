import mongoose from "mongoose";

const FavoriteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    numbers: {
        type: [Number],
        required: true,
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: "A favorite must have at least one number.",
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Favorite = mongoose.model("Favorite", FavoriteSchema);

export default Favorite;
