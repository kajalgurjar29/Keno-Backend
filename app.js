import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { connectDB } from "./src/db/db.config.js";
import { createServer } from "http";
import "./src/middleware/schedular.middleware.js";

dotenv.config({ path: "./.env" });

connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

console.log("Middleware initialized.");

// Importing Routes
import userRoutes from "./src/routers/User.router.js";
import forgotPasswordRoutes from "./src/routers/forgotPassword.router.js";
import resetPasswordRoutes from "./src/routers/resetPassword.router.js";
import profileManagementRoutes from "./src/routers/profileManagement.router.js";
import ticketRoutes from "./src/routers/myticket.router.js";
import combinationRoutes from "./src/routers/combination.router.js";
import NSWkenoRouter from "./src/routers/NSWkenoDrawNumberScraper.router.js";
import VICkenoRouter from "./src/routers/VICkenoDrawNumberScraper.router.js";
import ATCkenoRouter from "./src/routers/ATCkenoDrawNumberScraper.router.js";
import SAkenoRouter from "./src/routers/SAkenoDrawNumberScraper.router.js";
import OverDueComboRouter from "./src/routers/OverdueCombos.router.js";
import historicalFrequencyRouter from "./src/routers/historicalFrequency.router.js";
import NSWTrackSideRouter from "./src/routers/NSWTrackSideScraper.router.js";
import VICTrackSideRouter from "./src/routers/VICTrackSideScraper.router.js";
import ATCTrackSideRouter from "./src/routers/ATCTrackSideScraper.router.js";

// API Routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/users", forgotPasswordRoutes);
app.use("/api/v1/reset-password", resetPasswordRoutes);
app.use("/api/v1/profile", profileManagementRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/combinations", combinationRoutes);
app.use("/api/v1/nsw-keno", NSWkenoRouter);
app.use("/api/v1/vic-keno", VICkenoRouter);
app.use("/api/v1/atc-keno", ATCkenoRouter);
app.use("/api/v1/sa-keno", SAkenoRouter);
app.use("/api/v1/over-due-combo", OverDueComboRouter);
app.use("/api/v1/historical-frequency", historicalFrequencyRouter);
app.use("/api/v1/nsw-trackside", NSWTrackSideRouter);
app.use("/api/v1/vic-trackside", VICTrackSideRouter);
app.use("/api/v1/atc-trackside", ATCTrackSideRouter);

if (!process.env.PORT) {
  console.error("Missing environment variables! Check .env file.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Please:`);
    console.error(`   1. Stop the existing process using port ${PORT}`);
    console.error(`   2. Or change the PORT in your .env file`);
    console.error(
      `   3. On Windows, run: netstat -ano | findstr :${PORT} to find the process`
    );
    process.exit(1);
  } else {
    console.error("❌ Server error:", err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

export { app };
