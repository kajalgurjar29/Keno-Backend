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

    let combinations = [];
    for (let i = 0; i < numCombinations; i++) {
      let numbers = generateRandomNumbers(4, 20); // example: 4 numbers from 1–20
      combinations.push({
        betType,
        numbers,
        percentage: Math.floor(Math.random() * 100), // mock percentage
        racesSince: minRaces,
      });

      // Optionally save to DB
      await Combination.create({
        betType,
        numbers,
        percentage: Math.floor(Math.random() * 100),
        racesSince: minRaces,
      });
    }

    res.status(200).json({ combinations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
