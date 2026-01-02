import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

mongoose.connection.on("connected", () => {
  console.log("MongoDB: connection established");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB: connection error:", err);
});

const connectDB = async () => {
  if (!mongoUri) {
    console.error("Missing MONGO_URI in environment. Set MONGO_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // connection pool and timeouts to reduce chance of silent disconnects
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log("Your MongoDB Connected Successfully..");
  } catch (error) {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  }
};

export { mongoose, connectDB };
