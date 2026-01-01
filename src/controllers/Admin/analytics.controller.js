import Ticket from "../../models/Ticket.js";
import User from "../../models/User.model.js";

// helper: date range
const getDateFilter = (range) => {
  const now = new Date();
  let start = new Date();

  if (range === "weekly") start.setDate(now.getDate() - 7);
  if (range === "monthly") start.setMonth(now.getMonth() - 1);

  return { createdAt: { $gte: start, $lte: now } };
};

// 1️⃣ Metrics
export const getMetrics = async (req, res) => {
  try {
    const range = req.query.range || "weekly";
    const filter = getDateFilter(range);

    const totalTickets = await Ticket.countDocuments(filter);

    const grouped = await Ticket.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const info = {};
    grouped.forEach((g) => (info[g._id] = g.count));

    res.json({
      title: "Total Tickets",
      value: totalTickets,
      subtext: range,
      trend: "+0%",
      info,
    });
  } catch (err) {
    res.status(500).json({ message: "Metrics error" });
  }
};

// 2️⃣ Automation Rate
export const getAutomationRate = async (req, res) => {
  try {
    const filter = getDateFilter(req.query.range);

    const total = await Ticket.countDocuments(filter);
    const bot = await Ticket.countDocuments({ ...filter, isBot: true });

    res.json({
      bot: Math.round((bot / total) * 100),
      human: Math.round(((total - bot) / total) * 100),
      totalQueries: total,
    });
  } catch {
    res.status(500).json({ message: "Automation rate error" });
  }
};

// 3️⃣ Escalation Rate
export const getEscalationRate = async (req, res) => {
  try {
    const filter = getDateFilter(req.query.range);

    const total = await Ticket.countDocuments(filter);
    const escalated = await Ticket.countDocuments({
      ...filter,
      isEscalated: true,
    });

    res.json({
      escalated: Math.round((escalated / total) * 100),
      nonEscalated: Math.round(((total - escalated) / total) * 100),
      totalQueries: total,
    });
  } catch {
    res.status(500).json({ message: "Escalation rate error" });
  }
};

// 4️⃣ First Response Time (Line Chart)
export const getFRT = async (req, res) => {
  try {
    const filter = getDateFilter(req.query.range);

    const data = await Ticket.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $week: "$createdAt" },
          bot: {
            $avg: { $cond: ["$isBot", "$firstResponseTime", null] },
          },
          humans: {
            $avg: { $cond: ["$isBot", null, "$firstResponseTime"] },
          },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    res.json(
      data.map((d, i) => ({
        week: `Week${i + 1}`,
        bot: Number(d.bot?.toFixed(2) || 0),
        humans: Number(d.humans?.toFixed(2) || 0),
      }))
    );
  } catch {
    res.status(500).json({ message: "FRT error" });
  }
};

// 5️⃣ Resolution Time
export const getResolutionTime = async (req, res) => {
  try {
    const filter = getDateFilter(req.query.range);

    const result = await Ticket.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          bot: {
            $avg: { $cond: ["$isBot", "$resolutionTime", null] },
          },
          humans: {
            $avg: { $cond: ["$isBot", null, "$resolutionTime"] },
          },
        },
      },
    ]);

    res.json({
      label: "Avg Resolution Time",
      bot: Number(result[0]?.bot?.toFixed(2) || 0),
      humans: Number(result[0]?.humans?.toFixed(2) || 0),
    });
  } catch {
    res.status(500).json({ message: "Resolution time error" });
  }
};

// 6️⃣ Agents Table
export const getAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: "agent" });

    const data = await Promise.all(
      agents.map(async (agent) => {
        const totalTickets = await Ticket.countDocuments({
          assignedTo: agent._id,
        });

        return {
          name: agent.name,
          department: agent.department,
          totalTickets,
          avatar: agent.avatar || "",
        };
      })
    );

    res.json(data);
  } catch {
    res.status(500).json({ message: "Agents error" });
  }
};
