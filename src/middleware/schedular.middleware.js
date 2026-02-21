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

// 🟢 NSW Scraper Scheduler (every 1 minute)
let runningNSW = false;
schedule.scheduleJob("*/1 * * * *", async () => {
  if (runningNSW) return;
  runningNSW = true;
  console.log("🕐 NSW Job triggered at", new Date().toLocaleString());
  try {
    const result = await scrapeNSWKenobyGame();
    console.log("✅ NSW Scraped:", result ? result.draw : "no new data");
  } catch (err) {
    console.error("❌ NSW Scraper error:", err.message);
  }
  runningNSW = false;
});

// 🟢 VIC Scraper Scheduler (every 2 minutes)
let runningVIC = false;
schedule.scheduleJob("*/2 * * * *", async () => {
  if (runningVIC) return;
  runningVIC = true;
  console.log("🕐 VIC Job triggered at", new Date().toLocaleString());
  try {
    const result = await scrapeVICKenoByGame();
    console.log("✅ VIC Scraped:", result ? result.draw : "no new data");
  } catch (err) {
    console.error("❌ VIC Scraper error:", err.message);
  }
  runningVIC = false;
});

// 🟢 ACT Scraper Scheduler (every 3 minutes)
let runningACT = false;
schedule.scheduleJob("*/3 * * * *", async () => {
  if (runningACT) return;
  runningACT = true;
  console.log("🕐 ACT Job triggered at", new Date().toLocaleString());
  try {
    const result = await scrapeACTKenoByGame();
    console.log("✅ ACT Scraped:", result ? result.draw : "no new data");
  } catch (err) {
    console.error("❌ ACT Scraper error:", err.message);
  }
  runningACT = false;
});

// 🟢 SA Scraper Scheduler (every 4 minutes)
let runningSA = false;
schedule.scheduleJob("*/4 * * * *", async () => {
  if (runningSA) return;
  runningSA = true;
  console.log("🕐 SA Job triggered at", new Date().toLocaleString());
  try {
    const result = await scrapeSAKenoByGame();
    console.log("✅ SA Scraped:", result ? result.draw : "no new data");
  } catch (err) {
    console.error("❌ SA Scraper error:", err.message);
  }
  runningSA = false;
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
