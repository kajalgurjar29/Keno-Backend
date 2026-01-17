import mongoose from "mongoose";

const KenoResultSchema = new mongoose.Schema({
  draw: { type: String, required: true },
  date: { type: String, required: true },
  drawid: { type: String, required: true, unique: true },
  numbers: [{ type: Number, required: true }],
  location: { type: String, default: "SA", required: true },
  createdAt: { type: Date, default: Date.now },
});

// Remove compound unique index on draw and date
// KenoResultSchema.index({ draw: 1, date: 1 }, { unique: true });

const KenoResult = mongoose.model("SADrawNumber", KenoResultSchema);

export default KenoResult;
