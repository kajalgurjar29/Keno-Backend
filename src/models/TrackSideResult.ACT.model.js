import mongoose from "mongoose";

const TrackSideResultSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  gameName: { type: String, required: true },
  drawNumber: { type: String, default: "" },
  numbers: [{ type: Number, required: true }],
  location: { type: String, default: "ACT", required: true },
  date: { type: String },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const ACTTrackSideResult = mongoose.model(
  "ACTTrackSideResult",
  TrackSideResultSchema
);

export default ACTTrackSideResult;
