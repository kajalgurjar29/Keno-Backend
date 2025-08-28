import User from "../../models/User.model.js";

// @desc Get user data by ID
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

export const getAllUsers = async (req, res) => {
  try {
    // Fetch all users, excluding password and role
    const users = await User.find().select("-password -role");

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
