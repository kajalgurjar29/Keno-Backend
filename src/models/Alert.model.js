import mongoose from "mongoose";

const AlertSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // or mongoose.Schema.Types.ObjectId if users are in a collection
      required: true,
      index: true,
    },
    gameType: {
      type: String,
      enum: ["TRACKSIDE", "KENO"],
      required: true,
      uppercase: true,
      trim: true,
    },
    // For Trackside
    betType: {
      type: String,
      enum: ["Quinella", "Exacta", "Trifecta", "First Four"],
      required: function () { return this.gameType === "TRACKSIDE"; }
    },
    combinations: {
      type: [Number], // e.g. [1, 2, 3]
      required: function () { return this.gameType === "TRACKSIDE"; }
    },
    // For Keno
    alertType: {
      type: String, // e.g. "40-game number drought"
      required: function () { return this.gameType === "KENO"; }
    },
    targetValue: {
      type: Number, // e.g. 40 (drought threshold) or specific number
    },
    status: {
      type: String,
      enum: ["Active", "Triggered"],
      default: "Active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Alert", AlertSchema);
