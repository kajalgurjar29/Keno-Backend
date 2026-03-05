import schedule from "node-schedule";
import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
import { scrapeVICKenoByGame } from "../controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";
import { scrapeACTKenoByGame } from "../controllers/kenoScraper/ACTkenoDrawNumberScraper.controller.js";
import { scrapeSAKenoByGame } from "../controllers/kenoScraper/SAkenoDrawNumberScraper.controller.js";
import { scrapeTrackSideResultsWithRetry as scrapeNSWTrackside } from "../controllers/TracksiteScaper/NSWTrackSideScraperScaping.controller.js";
import { scrapeTrackSideResultsWithRetry as scrapeVICTrackside } from "../controllers/TracksiteScaper/VICTrackSideScraperScaping.controller.js";
import { scrapeTrackSideResultsWithRetry as scrapeACTTrackside } from "../controllers/TracksiteScaper/ACTTrackSideScraperScaping.controller.js";
import ScheduledWorker from "../services/ScheduledWorker.js";
import User from "../models/User.model.js";

// 🟢 Master Scheduler Initializer
export const initScheduler = () => {
  console.log("🚀 [SYSTEM] Initializing Master Sequential Scheduler...");

  // 1. Run immediately on startup
  console.log("🏃 [STARTUP] Triggering first Master Pass...");
  runMasterPass();

  // 2. Schedule the Master Pass (Every 2 minutes)
  // We use 2 minutes to ensure a full sequence can finish safely on low RAM.
  schedule.scheduleJob("*/2 * * * *", runMasterPass);

  // 3. Daily Summary (9:00 AM)
  schedule.scheduleJob("0 9 * * *", async () => {
    try {
      await ScheduledWorker.sendDailySummary();
    } catch (err) {
      console.error("❌ Daily summary error:", err.message);
    }
  });

  // 4. Subscription & Trial Expiry (Every hour)
  schedule.scheduleJob("0 * * * *", runExpiryCheck);

  // 5. Heartbeat (Every 30 seconds)
  setInterval(() => {
    console.log("💓 [HEARTBEAT] Master Scheduler is breathing...");
  }, 30000);

  console.log("📅 Master Scheduler active.");
};

// --- Single Sequential Master Thread ---

let masterRunning = false;
async function runMasterPass() {
  if (masterRunning) {
    console.log("⏳ [SYSTEM] Master Pass skipped: Previous pass still running.");
    return;
  }
  masterRunning = true;
  console.log("🚀 [MASTER] Starting sequential pass for ALL regions...");

  const startTime = Date.now();

  try {
    // Phase 1: KENO (One by one)
    console.log("--- 🏁 KENO PHASE ---");

    try {
      const nswK = await scrapeNSWKenobyGame();
      console.log("✅ NSW Keno:", nswK ? nswK.draw : "done");
    } catch (e) { console.error("❌ NSW Keno failed:", e.message); }

    try {
      const vicK = await scrapeVICKenoByGame();
      console.log("✅ VIC Keno:", vicK ? vicK.draw : "done");
    } catch (e) { console.error("❌ VIC Keno failed:", e.message); }

    try {
      const actK = await scrapeACTKenoByGame();
      console.log("✅ ACT Keno:", actK ? actK.draw : "done");
    } catch (e) { console.error("❌ ACT Keno failed:", e.message); }

    try {
      const saK = await scrapeSAKenoByGame();
      console.log("✅ SA Keno:", saK ? saK.draw : "done");
    } catch (e) { console.error("❌ SA Keno failed:", e.message); }

    // Phase 2: TRACKSIDE (One by one)
    console.log("--- 🏁 TRACKSIDE PHASE ---");

    try {
      await scrapeNSWTrackside();
      console.log("✅ NSW Trackside: success");
    } catch (e) { console.error("❌ NSW Trackside failed:", e.message); }

    try {
      await scrapeVICTrackside();
      console.log("✅ VIC Trackside: success");
    } catch (e) { console.error("❌ VIC Trackside failed:", e.message); }

    try {
      await scrapeACTTrackside();
      console.log("✅ ACT Trackside: success");
    } catch (e) { console.error("❌ ACT Trackside failed:", e.message); }

  } catch (err) {
    console.error("❌ [MASTER] Critical failure in loop:", err.message);
  } finally {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    masterRunning = false;
    console.log(`🏁 [MASTER] Pass finished in ${duration}s. System resting.`);
  }
}

// 🟢 Subscription & Trial Expiry logic
async function runExpiryCheck() {
  console.log("🕐 Running Subscription Expiry Check...");
  const now = new Date();
  try {
    const result = await User.updateMany(
      {
        isSubscriptionActive: true,
        $or: [
          { planType: "trial", trialEnd: { $lt: now } },
          { planType: { $in: ["monthly", "yearly"] }, subscriptionEnd: { $lt: now } },
        ],
      },
      { $set: { isSubscriptionActive: false } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Expired ${result.modifiedCount} subscriptions/trials.`);
    }
  } catch (err) {
    console.error("❌ Expiry job error:", err.message);
  }
}
