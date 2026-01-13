import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    gameType: {
      type: String,
      enum: ["TRACKSIDE", "KENO"],
      required: true,
    },

    resultId: {
      type: String,   // 🔥 FIXED
      required: true,
    },

    numbers: {
      type: [Number],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Favorite", favoriteSchema);
