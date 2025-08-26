import mongoose from "mongoose";

const entrySchema = new mongoose.Schema({
  position: { type: Number, required: true }, 
  numbers: [{ type: Number, required: true }], 
});

const ticketSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    firstGameNo: { type: Number, required: true },
    lastGameNo: { type: Number, required: true },
    amountSpent: { type: Number, required: true },
    payoutPercent: { type: Number, required: true },
    betType: {
      type: String,
      enum: ["Quinella", "Exacta", "Trifecta", "Other"],
      required: true,
    },
    entries: [entrySchema],
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", ticketSchema);
