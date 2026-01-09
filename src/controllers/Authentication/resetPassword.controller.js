import User from "../../models/User.model.js";

// @desc Change user password
// @route POST /api/reset-password/change-password/:id    
// @access Private
// This endpoint allows users to change their password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params.id;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both old and new passwords are required" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }
    user.password = newPassword;
    await user.save();
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Something went wrong", error: err.message });
  }
};


export const updatePin = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT
    const { oldPin, newPin } = req.body;

    if (!oldPin || !newPin) {
      return res.status(400).json({
        message: "Old PIN and New PIN are required",
      });
    }

    if (!/^\d{4}(\d{2})?$/.test(newPin)) {
      return res.status(400).json({
        message: "New PIN must be 4 or 6 digits",
      });
    }

    if (oldPin === newPin) {
      return res.status(400).json({
        message: "New PIN must be different from old PIN",
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.pin) {
      return res.status(400).json({
        message: "PIN not set for this user",
      });
    }

    const isMatch = await user.comparePin(oldPin);
    if (!isMatch) {
      return res.status(401).json({
        message: "Old PIN is incorrect",
      });
    }

    user.pin = newPin; // 🔐 pre-save hook hashes it
    await user.save();

    res.status(200).json({
      message: "PIN updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Update PIN error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


