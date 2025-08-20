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
