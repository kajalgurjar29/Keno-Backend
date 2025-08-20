import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const token = req.header("Authorization");
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded.user; // Attach user data to request
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}
