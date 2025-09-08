// controllers/combination.controller.js
import Combination from "../../models/combination.model.js";

// Utility function to generate random numbers
const generateRandomNumbers = (count, max = 20) => {
  let nums = [];
  while (nums.length < count) {
    const n = Math.floor(Math.random() * max) + 1;
    if (!nums.includes(n)) nums.push(n);
  }
  return nums;
};

export const generateCombinations = async (req, res) => {
  try {
    const { betType, minRaces, numCombinations } = req.body;

    if (!betType || !minRaces || !numCombinations) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // set numbers count based on betType
    let numCount = 0;
    switch (betType) {
      case "Quinella":
        numCount = 2;
        break;
      case "Trifecta":
        numCount = 3;
        break;
      case "First Four":
        numCount = 4;
        break;
      default:
        return res.status(400).json({ message: "Invalid bet type" });
    }

    let combinations = [];
    for (let i = 0; i < numCombinations; i++) {
      let numbers = generateRandomNumbers(numCount, 20);
      const percentage = Math.floor(Math.random() * 100);

      combinations.push({
        betType,
        numbers,
        percentage,
        racesSince: minRaces,
      });

      // Optionally save to DB
      await Combination.create({
        betType,
        numbers,
        percentage,
        racesSince: minRaces,
      });
    }

    res.status(200).json({ combinations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET API – fetch all saved combinations
export const getCombinations = async (req, res) => {
  try {
    const combinations = await Combination.find().sort({ createdAt: -1 }); // latest first
    res.status(200).json({ combinations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
