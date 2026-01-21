import _ from "lodash";
import NSW from "../../models/TrackSideResult.NSW.model.js";
import VIC from "../../models/TrackSideResult.VIC.model.js";
import ACT from "../../models/TrackSideResult.ACT.model.js";

const allCollections = {
    ACT: ACT,
    NSW: NSW,
    VIC: VIC,
};

// Helper for 10-digit numeric ID (deterministic without crypto)
const generateNumericId = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % 10000000000;
    }
    return hash;
};

const getRunnersByPosition = (runners = []) => {
    return runners
        .filter((r) => r.horseNo && r.horseNo !== 0)
        .sort((a, b) => a.position - b.position);
};

const calculateStats = async (location, size, maxDraws) => {
    const Model = allCollections[location];
    if (!Model) throw new Error("Invalid location");

    let races = await Model.find().sort({ createdAt: 1 });

    if (races.length === 0) return { drawsCount: 0, results: [] };

    const max = Number(maxDraws) || 500;
    if (races.length > max) races = races.slice(races.length - max);

    const drawsCount = races.length;
    let comboStats = new Map();

    for (let i = 0; i < races.length; i++) {
        const race = races[i];
        let nums = race.numbers || [];

        if (nums.length < Number(size) && race.runners && race.runners.length > 0) {
            const sortedRunners = getRunnersByPosition(race.runners);
            nums = sortedRunners.map((r) => r.horseNo);
        }

        if (nums.length >= Number(size)) {
            const winningNums = nums.slice(0, Number(size));
            winningNums.sort((a, b) => a - b);
            const key = winningNums.join("-");
            if (!comboStats.has(key)) {
                comboStats.set(key, { count: 0, lastSeen: i });
            }
            const stat = comboStats.get(key);
            stat.count += 1;
            stat.lastSeen = i;
        }
    }

    const results = Array.from(comboStats.entries()).map(([comboKey, stat]) => {
        const avgEvery = drawsCount / stat.count;
        const overdue = drawsCount - stat.lastSeen;
        const comboArr = comboKey.split("-").map(Number);

        // Create a 10-digit numeric ID
        const numericId = generateNumericId(`${location}_TRACKSIDE_${size}_${comboKey}`);

        return {
            _id: numericId,
            id: numericId,
            location,
            size: Number(size),
            combo: comboArr,
            comboKey,
            avgEvery: Math.round(avgEvery),
            lastSeen: overdue,
            frequency: stat.count,
            drawsCount,
            generatedAt: new Date(),
        };
    });

    return { drawsCount, results };
};

export const getTracksideOverdue = async (req, res) => {
    try {
        const { location = "NSW", size = 2, maxDraws = 500 } = req.query;
        const { results } = await calculateStats(location, size, maxDraws);

        if (results.length === 0) {
            return res.status(404).json({ message: "No race data found" });
        }

        const sorted = _.orderBy(results, ["lastSeen"], ["desc"]).slice(0, 20);
        return res.status(200).json(sorted);
    } catch (error) {
        console.error("Error in getTracksideOverdue:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTracksideOverduePagination = async (req, res) => {
    try {
        const {
            location = "NSW",
            size = 2,
            page = 1,
            limit = 10,
            maxDraws = 500,
        } = req.query;

        const { results } = await calculateStats(location, size, maxDraws);

        if (results.length === 0) {
            return res.status(404).json({ message: "No race data found" });
        }

        const sorted = _.orderBy(results, ["lastSeen"], ["desc"]);

        const pageNumber = parseInt(page);
        const pageSize = parseInt(limit);
        const startIndex = (pageNumber - 1) * pageSize;
        const paginatedData = sorted.slice(startIndex, startIndex + pageSize);

        return res.status(200).json({
            success: true,
            totalCombos: sorted.length,
            currentPage: pageNumber,
            totalPages: Math.ceil(sorted.length / pageSize),
            limit: pageSize,
            data: paginatedData,
        });
    } catch (error) {
        console.error("Error in getTracksideOverduePagination:", error);
        res.status(500).json({ message: error.message });
    }
};
