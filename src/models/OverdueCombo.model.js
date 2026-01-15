import mongoose from "mongoose";

const overdueComboSchema = new mongoose.Schema({
  location: { type: String, required: true },
  size: { type: Number, required: true },
  combo: { type: [Number], required: true },
  comboKey: { type: String, required: true, index: true },
  avgEvery: { type: Number },
  lastSeen: { type: Number },
  frequency: { type: Number },
  drawsCount: { type: Number },
  generatedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

overdueComboSchema.index(
  { location: 1, size: 1, comboKey: 1 },
  { unique: true }
);

export default mongoose.model("OverdueCombo", overdueComboSchema);
