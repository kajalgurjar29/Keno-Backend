import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 8000, {});
    console.log("Your MongoDB Connected Successfully..");
  } catch (error) {
    console.error("MongoDB connection failed", error);
    process.exit(1); // Exit process with failure.
  }
};

export { mongoose, connectDB };
