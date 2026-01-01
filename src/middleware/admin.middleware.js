const isAdmin = (req, res, next) => {
  try {
    // user auth.middleware se aata hai
    // req.user = { _id, role, email, ... }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not found",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admin access only",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Admin middleware error",
    });
  }
};

export { isAdmin };
