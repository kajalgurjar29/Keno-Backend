import mongoose from "mongoose";

const KenoResultSchema = new mongoose.Schema({
  draw: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  numbers: [{ type: Number, required: true }],
  location: { type: String, default: "SA", required: true },
  createdAt: { type: Date, default: Date.now },
});

const KenoResult = mongoose.model("SADrawNumber", KenoResultSchema);

export default KenoResult;
