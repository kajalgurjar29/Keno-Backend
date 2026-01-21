import mongoose from "mongoose";

const KenoResultSchema = new mongoose.Schema({
  draw: { type: String, required: true },
  date: { type: String, required: true },
  drawid: { type: String, required: true, unique: true },
  numbers: [{ type: Number, required: true }],
  heads: { type: Number },
  tails: { type: Number },
  result: { type: String }, // "Heads", "Tails", or "Evens"
  bonus: { type: String },  // "REG", "x2", "x4", etc.
  location: { type: String, default: "ACT", required: true },
  createdAt: { type: Date, default: Date.now },
});

// Remove compound unique index on draw and date
// KenoResultSchema.index({ draw: 1, date: 1 }, { unique: true });

const KenoResult = mongoose.model("ACTDrawNumber", KenoResultSchema);

export default KenoResult;
