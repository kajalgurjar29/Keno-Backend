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

// 🟢 Daily Summary Scheduler (Every morning at 9:00 AM)
schedule.scheduleJob("0 9 * * *", async () => {
  try {
    await ScheduledWorker.sendDailySummary();
  } catch (err) {
    console.error("❌ Daily summary error:", err.message);
  }
});

// 🟢 Consolidated Keno Scraper Scheduler (Sequential to save RAM)
let runningKeno = false;
schedule.scheduleJob("*/1 * * * *", async () => {
  if (runningKeno) return;
  runningKeno = true;
  console.log("🕐 Keno Sequential Job started at", new Date().toLocaleString());

  try {
    // NSW
    try {
      const nsw = await scrapeNSWKenobyGame();
      console.log("✅ NSW Scraped:", nsw ? nsw.draw : "no new data");
    } catch (e) { console.error("❌ NSW Job failed:", e.message); }

    // VIC
    try {
      const vic = await scrapeVICKenoByGame();
      console.log("✅ VIC Scraped:", vic ? vic.draw : "no new data");
    } catch (e) { console.error("❌ VIC Job failed:", e.message); }

    // ACT
    try {
      const act = await scrapeACTKenoByGame();
      console.log("✅ ACT Scraped:", act ? act.draw : "no new data");
    } catch (e) { console.error("❌ ACT Job failed:", e.message); }

    // SA
    try {
      const sa = await scrapeSAKenoByGame();
      console.log("✅ SA Scraped:", sa ? sa.draw : "no new data");
    } catch (e) { console.error("❌ SA Job failed:", e.message); }

  } catch (err) {
    console.error("❌ Keno Macro Job error:", err.message);
  } finally {
    runningKeno = false;
    console.log("🏁 Keno Sequential Job finished.");
  }
});

// 🟢 TrackSide Scheduler (every 5 minutes)
let runningTrackSide = false;
schedule.scheduleJob("*/5 * * * *", async () => {
  if (runningTrackSide) return;
  runningTrackSide = true;
  console.log("🕐 TrackSide Job triggered at", new Date().toLocaleString());
  try {
    await scrapeNSWTrackside();
    await scrapeVICTrackside();
    await scrapeACTTrackside();
    console.log("✅ TrackSide Scrapers finished");
  } catch (err) {
    console.error("❌ TrackSide error:", err.message);
  }
  runningTrackSide = false;
});

// 🟢 Subscription & Trial Expiry Scheduler (Every hour)
schedule.scheduleJob("0 * * * *", async () => {
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
});
