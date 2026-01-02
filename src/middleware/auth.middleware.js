// import jwt from "jsonwebtoken";

// export default function authMiddleware(req, res, next) {
//   const token = req.header("Authorization");
//   if (!token) {
//     return res.status(401).json({ error: "Access denied. No token provided." });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
//     req.user = decoded.user; // Attach user data to request
//     next();
//   } catch (err) {
//     res.status(401).json({ error: "Invalid token" });
//   }
// }



import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  let token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  // Bearer token support
  if (token.startsWith("Bearer ")) {
    token = token.split(" ")[1];
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // 🔥 FIX IS HERE
    req.user = decoded.user || decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
}

