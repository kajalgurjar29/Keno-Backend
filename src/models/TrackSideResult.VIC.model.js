import mongoose from "mongoose";

const TrackSideResultSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  gameName: { type: String, required: true },
  drawNumber: { type: String, default: "" },
  gameNumber: { type: Number },
  numbers: [{ type: Number, required: true }],
  location: { type: String, default: "VIC", required: true },
  date: { type: String },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  runners: [
    {
      horseNo: { type: Number },   // 1–12
      position: { type: Number }   // 1,2,3,4...
    }
  ],
  dividends: {
    win: { type: String, default: "" },
    place: { type: String, default: "" },
    quinella: { type: String, default: "" },
    exacta: { type: String, default: "" },
    trifecta: { type: String, default: "" },
    first4: { type: String, default: "" }
  }
});

const VICTrackSideResult = mongoose.model(
  "VICTrackSideResult",
  TrackSideResultSchema
);

export default VICTrackSideResult;
