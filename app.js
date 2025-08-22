import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { connectDB } from "./src/db/db.config.js";
import { createServer } from "http";

dotenv.config({ path: "./.env" });
//kajal
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.get("/", (req, res) => {
  res.send("Backend running...");
});

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

// API Routes
app.use("/api/v1/users", userRoutes, forgotPasswordRoutes);
// app.use("/api/v1/forgot-password", forgotPasswordRoutes);
app.use("/api/v1/reset-password", resetPasswordRoutes);
app.use("/api/v1/profile", profileManagementRoutes);

if (!process.env.PORT) {
  console.error("Missing environment variables! Check .env file.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app };
