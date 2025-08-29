// models/Combination.js
import mongoose from "mongoose";

const combinationSchema = new mongoose.Schema({
  betType: {
    type: String,
    enum: ["Quinella", "Trifecta", "First Four"],
    required: true,
  },
  numbers: {
    type: [Number],
    required: true,
  },
  percentage: {
    type: Number,
    required: false,
  },
  racesSince: {
    type: Number,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Combination", combinationSchema);
