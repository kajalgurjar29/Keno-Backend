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
    const subject = "Password Reset Request - Punt Mate";
    const textMessage = `Hello ${user.fullName}, You requested a password reset. Your OTP is: ${otp}. This will expire in 10 minutes.`;
    const htmlMessage = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Punt <span style="color: #0066ff;">Mate</span></h1>
        </div>
        <div style="padding: 20px; background-color: #fff9f0; border-radius: 8px; text-align: center; border: 1px solid #ffeeba;">
          <p style="font-size: 16px; color: #444; margin-top: 0;">Hello <strong>${user.fullName}</strong>,</p>
          <p style="font-size: 16px; color: #444;">We received a request to reset your password. Use the code below to proceed:</p>
          <div style="margin: 30px 0;">
            <span style="font-size: 36px; font-weight: 700; color: #ff9900; letter-spacing: 5px; background: #fff; padding: 10px 25px; border-radius: 8px; border: 2px dashed #ff9900;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #888;">This code will expire in <strong>10 minutes</strong>. If you didn't request this, please secure your account.</p>
        </div>
        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 12px; color: #aaa;">&copy; 2026 Punt Mate. All rights reserved.</p>
        </div>
      </div>
    `;
    await sendEmail(user.email, subject, textMessage, htmlMessage);

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

    const subject = "PIN Reset Request - Punt Mate";
    const textMessage = `Hello ${user.fullName}, Your OTP for PIN reset is: ${otp}. This will expire in 10 minutes.`;
    const htmlMessage = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Punt <span style="color: #0066ff;">Mate</span></h1>
        </div>
        <div style="padding: 20px; background-color: #f0f7ff; border-radius: 8px; text-align: center; border: 1px solid #bee5eb;">
          <p style="font-size: 16px; color: #444; margin-top: 0;">Hello <strong>${user.fullName}</strong>,</p>
          <p style="font-size: 16px; color: #444;">We received a request to reset your PIN. Use the code below to proceed:</p>
          <div style="margin: 30px 0;">
            <span style="font-size: 36px; font-weight: 700; color: #0066ff; letter-spacing: 5px; background: #fff; padding: 10px 25px; border-radius: 8px; border: 2px dashed #0066ff;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #888;">This code will expire in <strong>10 minutes</strong>.</p>
        </div>
        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 12px; color: #aaa;">&copy; 2026 Punt Mate. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail(user.email, subject, textMessage, htmlMessage);

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

