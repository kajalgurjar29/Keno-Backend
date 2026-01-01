import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    status: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isBot: Boolean,
    isEscalated: Boolean,
    firstResponseTime: Number,
    resolutionTime: Number,
  },
  { timestamps: true }
);

export default mongoose.models.Ticket ||
  mongoose.model("Ticket", ticketSchema);
