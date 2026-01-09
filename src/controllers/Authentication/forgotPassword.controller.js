import OtpToken from "../../models/otpToken.model.js";
import User from "../../models/User.model.js";
import crypto from "crypto";
import otpGenerator from "otp-generator";
import sendEmail from "../../utils/sendEmail.js";

// @desc Update user password
// @route POST /api/forgot-password/request-password-reset
// @access Public
// This is the first step where user requests a password reset

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Generate OTP & expiry
    const otp = otpGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 3. Store OTP in DB
    await OtpToken.create({ userId: user._id, otp, expiry });

    // 4. Send email with OTP
    const subject = "Password Reset Request";
    const message = `
      Hello ${user.fullName},
      You requested a password reset. Use the OTP below to reset your password:${otp}
      This OTP will expire in 10 minutes
      If you didn’t request this, you can ignore this email.
    `;
    await sendEmail(user.email, subject, message);

    console.log(`📧 Reset OTP sent to ${email}: ${otp}`);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error in requestPasswordReset:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// @desc Reset user password
// @route POST /api/forgot-password/verify-otp
// @access Public
// This is the second step where user verifies the OTP

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpRecord = await OtpToken.findOne({ userId: user._id, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiry < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // OTP is valid ✅
    return res.status(200).json({
      message: "OTP verified successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Reset user password
// @route POST /api/forgot-password/reset-password
// @access Public
// This is the final step where user sets a new password

export const setNewPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    return res
      .status(200)
      .json({ message: "Password reset successful", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};






;



export const requestPinReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = otpGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await OtpToken.create({ userId: user._id, otp, expiry });

    await sendEmail(
      user.email,
      "PIN Reset Request",
      `Hello ${user.fullName},
Your OTP for PIN reset is: ${otp}
This OTP will expire in 10 minutes.`
    );

    res.status(200).json({ message: "OTP sent for PIN reset" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};





export const verifyPinOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpRecord = await OtpToken.findOne({ userId: user._id, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiry < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    res.status(200).json({ message: "OTP verified for PIN reset", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




export const setNewPin = async (req, res) => {
  try {
    const { email, newPin } = req.body;

    if (!/^\d{4}(\d{2})?$/.test(newPin)) {
      return res.status(400).json({
        message: "PIN must be 4 or 6 digits",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.pin = newPin; 
    await user.save();

    res.status(200).json({
      message: "PIN reset successful",
      success: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


