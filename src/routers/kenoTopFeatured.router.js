import express from "express";
import {
  getKenoTopEntries,
  getKenoLeastEntries
} from "../controllers/Featured/TopFeaturedKeno.js";

const router = express.Router();


router.get("/top-featured", getKenoTopEntries);


router.get("/least-featured", getKenoLeastEntries);

export default router;
