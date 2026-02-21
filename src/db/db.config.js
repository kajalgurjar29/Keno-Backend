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

  const dbName = process.env.DB_NAME || "keno";
  const connectionString = mongoUri.includes('?')
    ? mongoUri.replace('?', `${dbName}?`)
    : (mongoUri.endsWith('/') ? `${mongoUri}${dbName}` : `${mongoUri}/${dbName}`);

  try {
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log(`Your MongoDB (${dbName}) Connected Successfully..`);
  } catch (error) {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  }
};

export { mongoose, connectDB };
