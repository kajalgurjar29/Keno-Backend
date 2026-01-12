import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { connectDB } from "./src/db/db.config.js";
import { createServer } from "http";

dotenv.config({ path: "./.env" });

// Connect to DB first, then load scheduler so jobs run after DB is ready
connectDB()
  .then(() => {
    import("./src/middleware/schedular.middleware.js")
      .then(() => console.log("Scheduler loaded"))
      .catch((e) => console.error("Failed loading scheduler:", e));
  })
  .catch((err) => {
    console.error("Database connection failed during startup:", err);
    process.exit(1);
  });

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
import favoritesRouter from "./src/routers/Favorites.router.js";
import kenoQuickStatsRouter from "./src/routers/kenoQuickStats.router.js";
import trackSideQuickStatsRouter from "./src/routers/kenoQuickStats.router.js";
import tracksideTopFeaturedRouter from "./src/routers/tracksideTopFeatured.router.js";
import kenoTopFeaturedRouter from "./src/routers/kenoTopFeatured.router.js";
import notificationRoutes from "./src/routers/notification.routes.js";
import adminAnalyticsRoutes from "./src/models/admin.analytics.routes.js";
import kenoLiveRoute from "./src/routers/kenoLive.route.js";
import kenoHotColdRoute from "./src/routers/kenoHotCold.route.js";
import kenoDashboardRoute from "./src/routers/kenoDashboard.route.js";
import resultsRoutes from "./src/routers/results.routes.js";

// API Routes
app.use("/api/v1/notification", notificationRoutes);
app.use("/api/v1", kenoLiveRoute);
app.use("/api/v1", kenoHotColdRoute);
app.use("/api/v1", kenoDashboardRoute);
app.use("/api/v1/results", resultsRoutes);

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
app.use("/api/v1/favorites", favoritesRouter);
app.use("/api/v1", kenoQuickStatsRouter);
app.use("/api/v1", trackSideQuickStatsRouter);
app.use("/api/v1/trackside", tracksideTopFeaturedRouter);
app.use("/api/v1/keno", kenoTopFeaturedRouter);
app.use("/api/v1/analytics", adminAnalyticsRoutes);

// Root health-check route
app.get("/", (req, res) => {
  res.send("API running");
});

if (!process.env.PORT) {
  console.error("Missing environment variables! Check .env file.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(` Port ${PORT} is already in use. Please:`);
    console.error(`   1. Stop the existing process using port ${PORT}`);
    console.error(`   2. Or change the PORT in your .env file`);
    console.error(
      `   3. On Windows, run: netstat -ano | findstr :${PORT} to find the process`
    );
    process.exit(1);
  } else {
    console.error(" Server error:", err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(` Server is running on port ${PORT}`);
});

export { app };
