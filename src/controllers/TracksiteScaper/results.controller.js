import NSWTrackSideResult from "../../models/TrackSideResult.NSW.model.js";
import KenoResult from "../../models/KenoResult.model.js";

export const getLatestTrackSideResult = async (req, res) => {
  try {
    const result = await NSWTrackSideResult.findOne()
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No TrackSide results found",
      });
    }

    const sortedRunners = (result.runners || [])
      .filter(r => r.position)
      .sort((a, b) => a.position - b.position);

    const win = sortedRunners.find(r => r.position === 1) || null;
    const place = sortedRunners.filter(r =>
      [1, 2, 3].includes(r.position)
    );

    const exacta =
      sortedRunners.length >= 2
        ? [sortedRunners[0].horseNo, sortedRunners[1].horseNo]
        : [];

    const trifecta =
      sortedRunners.length >= 3
        ? [
            sortedRunners[0].horseNo,
            sortedRunners[1].horseNo,
            sortedRunners[2].horseNo,
          ]
        : [];

    res.status(200).json({
      success: true,
      data: {
        gameId: result.gameId,
        gameName: result.gameName,
        drawNumber: result.drawNumber,
        gameNumber: result.gameNumber,
        location: result.location,
        date: result.date,
        numbers: result.numbers,

        results: {
          win,
          place,
          exacta,
          trifecta,
        },

        runners: sortedRunners,
      },
    });
  } catch (error) {
    console.error("Results API Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getLatestResults = async (req, res) => {
  try {
    /* ================= TRACKSIDE ================= */
    const trackSide = await NSWTrackSideResult.findOne()
      .sort({ createdAt: -1 })
      .lean();

    let trackSideData = null;

    if (trackSide) {
      const sortedRunners = (trackSide.runners || [])
        .filter(r => r.position)
        .sort((a, b) => a.position - b.position);

      trackSideData = {
        gameId: trackSide.gameId,
        gameName: trackSide.gameName,
        drawNumber: trackSide.drawNumber,
        gameNumber: trackSide.gameNumber,
        location: trackSide.location,
        date: trackSide.date,
        numbers: trackSide.numbers,

        results: {
          win: sortedRunners.find(r => r.position === 1) || null,
          place: sortedRunners.filter(r =>
            [1, 2, 3].includes(r.position)
          ),
          exacta:
            sortedRunners.length >= 2
              ? [sortedRunners[0].horseNo, sortedRunners[1].horseNo]
              : [],
          trifecta:
            sortedRunners.length >= 3
              ? [
                  sortedRunners[0].horseNo,
                  sortedRunners[1].horseNo,
                  sortedRunners[2].horseNo,
                ]
              : [],
        },

        runners: sortedRunners,
      };
    }

    /* ================= KENO ================= */
    const keno = await KenoResult.findOne()
      .sort({ createdAt: -1 })
      .lean();

    const kenoData = keno
      ? {
          draw: keno.draw,
          date: keno.date,
          numbers: keno.numbers,
          location: keno.location,
        }
      : null;

    /* ================= RESPONSE ================= */
    res.status(200).json({
      success: true,
      data: {
        trackSide: trackSideData,
        keno: kenoData,
      },
    });
  } catch (error) {
    console.error("Latest Results API Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};