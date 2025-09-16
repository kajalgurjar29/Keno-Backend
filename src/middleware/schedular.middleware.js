import schedule from "node-schedule";
import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/kenoScraper.controller.js";

let running = false;
schedule.scheduleJob("*/5 * * * * *", async () => {
  if (running) return;
  running = true;
  console.log("Job triggered at", new Date().toLocaleString());
  try {
    const result = await scrapeNSWKenobyGame();
    console.log("Scraped and saved:", result);
  } catch (err) {
    console.error("Error scraping Keno:", err.message);
  }
  running = false;
});
