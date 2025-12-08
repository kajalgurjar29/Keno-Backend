import User from "../../models/User.model.js";

// @desc Get user data by ID data
// @route GET /api/profile/user/:id
// controllers/Authentication/ProfileManagement.js
// @access Private
export const getUserData = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch user but exclude password and role fields
    const user = await User.findById(id).select("-password -role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc Update user data
// @route PUT /api/profile/user/:id
// Update specific user details
// @access Private
export const updateUserData = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, dob } = req.body;

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!fullName || !email || !dob) {
      return res.status(400).json({
        message: "Full name, email, and date of birth are required",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { fullName, email, dob },
      { new: true, runValidators: true }
    ).select("-password -role");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "User details updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Update user data
// @route GET /api/profile/users
// Fetch all users (admin only)
// @access Private

export const getAllUsers = async (req, res) => {
  try {
    // Fetch only verified users, excluding password and role
    const users = await User.find({ isVerified: true }).select(
      "-password -role"
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No verified users found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc Update user data
// @route PATCH /api/profile/:id/status
// Change user status (active/inactive) - admin only
// @access Private

export const changeUserStatus = async (req, res) => {
  try {
    const { id } = req.params; // user id
    const { status } = req.body; // new status (active/inactive)

    // Validate status
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true, select: "-password -otp -otpExpiry" }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: `User status updated to ${status}`,
      user,
    });
  } catch (error) {
    console.error("Error changing status:", error);
    res.status(500).json({ message: "Server error" });
  }
};
