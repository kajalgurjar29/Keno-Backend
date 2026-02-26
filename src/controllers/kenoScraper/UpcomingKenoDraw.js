import NSWKeno from "../../models/NSWkenoDrawResult.model.js";
import VICKeno from "../../models/VICkenoDrawResult.model.js";
import ACTKeno from "../../models/ACTkenoDrawResult.model.js";
import SAKeno from "../../models/SAkenoDrawResult.model.js";

import NSWTrackside from "../../models/TrackSideResult.NSW.model.js";
import VICTrackside from "../../models/TrackSideResult.VIC.model.js";
import ACTTrackside from "../../models/TrackSideResult.ACT.model.js";
// import SATrackside from "../../models/SAtracksideDrawResult.model.js";

const DRAW_INTERVAL_MINUTES = 5;

/* ================= KENO UPCOMING DRAW ================= */
export const getUpcomingKenoDraw = async (req, res) => {
  try {
    const { location = "NSW" } = req.query;
    const KENO_MODELS = {
      NSW: NSWKeno,
      VIC: VICKeno,
      ACT: ACTKeno,
      SA: SAKeno
    };

    let modelsToUse = [NSWKeno, VICKeno, ACTKeno, SAKeno];
    if (location !== "ALL" && KENO_MODELS[location.toUpperCase()]) {
      modelsToUse = [KENO_MODELS[location.toUpperCase()]];
    }

    const latestDraws = await Promise.all(
      modelsToUse.map((model) =>
        model
          .findOne()
          .sort({ createdAt: -1 })
          .select("createdAt")
          .lean()
      )
    );

    const validDraws = latestDraws.filter(
      (d) => d && d.createdAt
    );

    if (!validDraws.length) {
      return res.status(404).json({
        success: false,
        message: `No keno draw data found for ${location}`,
      });
    }

    const lastDrawObj = validDraws.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );

    const lastDrawTime = new Date(lastDrawObj.createdAt);

    const upcomingDrawTime = new Date(
      lastDrawTime.getTime() + DRAW_INTERVAL_MINUTES * 60 * 1000
    );

    const countdownSeconds = Math.max(
      Math.floor((upcomingDrawTime - new Date()) / 1000),
      0
    );

    return res.status(200).json({
      success: true,
      game: "KENO",
      location: location.toUpperCase(),
      lastDraw: lastDrawTime,
      upcomingDraw: upcomingDrawTime,
      countdownSeconds,
    });

  } catch (error) {
    console.error("Keno Upcoming Draw Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming keno draw",
    });
  }
};

/* ================= TRACKSIDE UPCOMING DRAW ================= */
export const getUpcomingTracksideDraw = async (req, res) => {
  try {
    const { location = "NSW" } = req.query;
    const TS_MODELS = {
      NSW: NSWTrackside,
      VIC: VICTrackside,
      ACT: ACTTrackside
    };

    let modelsToUse = [NSWTrackside, VICTrackside, ACTTrackside];
    if (location !== "ALL" && TS_MODELS[location.toUpperCase()]) {
      modelsToUse = [TS_MODELS[location.toUpperCase()]];
    }

    const latestDraws = await Promise.all(
      modelsToUse.map((model) =>
        model
          .findOne()
          .sort({ createdAt: -1 })
          .select("createdAt")
          .lean()
      )
    );

    const validDraws = latestDraws.filter(
      (d) => d && d.createdAt
    );

    if (!validDraws.length) {
      return res.status(404).json({
        success: false,
        message: `No trackside draw data found for ${location}`,
      });
    }

    const lastDrawObj = validDraws.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );

    const lastDrawTime = new Date(lastDrawObj.createdAt);

    const upcomingDrawTime = new Date(
      lastDrawTime.getTime() + DRAW_INTERVAL_MINUTES * 60 * 1000
    );

    const countdownSeconds = Math.max(
      Math.floor((upcomingDrawTime - new Date()) / 1000),
      0
    );

    return res.status(200).json({
      success: true,
      game: "TRACKSIDE",
      location: location.toUpperCase(),
      lastDraw: lastDrawTime,
      upcomingDraw: upcomingDrawTime,
      countdownSeconds,
    });

  } catch (error) {
    console.error("Trackside Upcoming Draw Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming trackside draw",
    });
  }
};
