import mongoose from "mongoose";

const kenoResultSchema = new mongoose.Schema(
  {
    drawNumber: String,
    numbers: String,
    date: String,
  },
  { timestamps: true }
);

export default mongoose.model("KenoResult", kenoResultSchema);
