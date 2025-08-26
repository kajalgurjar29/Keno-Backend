import express from "express";
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
} from "../controllers/Myticket/myticket.controller.js";

const router = express.Router();

// CRUD Routes
router.post("/create", createTicket); // Create
router.get("/get", getTickets); // Read All
router.get("/get/:id", getTicketById); // Read One
router.put("/update/:id", updateTicket); // Update
router.delete("/delete/:id", deleteTicket); // Delete

export default router;
