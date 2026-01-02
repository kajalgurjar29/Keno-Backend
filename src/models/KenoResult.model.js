// models/KenoResult.model.js
import mongoose from "mongoose";

const kenoResultSchema = new mongoose.Schema(
  {
    raceType: { type: String, default: "LIVE Race" },
    drawTime: { type: String, required: true }, 
    numbers: { type: [Number], required: true },
    status: { type: String, enum: ["LIVE", "COMPLETED"], default: "LIVE" },
  },
  { timestamps: true }
);

export default mongoose.model("KenoResult", kenoResultSchema);
