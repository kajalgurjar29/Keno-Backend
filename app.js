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

// API Routes
app.use("/api/v1/users", userRoutes, forgotPasswordRoutes);
// app.use("/api/v1/forgot-password", forgotPasswordRoutes);
app.use("/api/v1/reset-password", resetPasswordRoutes);
app.use("/api/v1/profile", profileManagementRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/combinations", combinationRoutes);
app.use("/api/v1/nsw-keno", NSWkenoRouter);
app.use("/api/v1/vic-keno", VICkenoRouter);

if (!process.env.PORT) {
  console.error("Missing environment variables! Check .env file.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app };
