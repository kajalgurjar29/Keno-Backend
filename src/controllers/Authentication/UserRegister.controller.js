import bcrypt from "bcryptjs";
import User from "../../models/User.model.js";
import sendEmail from "../../utils/sendEmail.js ";
import jwt from "jsonwebtoken";

// @desc Register a new user
// @route POST /api/register
// @access Public
// This endpoint allows new users to register
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, dob, role } = req.body;

    console.log("Incoming Register Data:", req.body);

    // 1. Validate fields
    if (!fullName || !email || !dob) {
      return res
        .status(400)
        .json({ message: "Full name, email, and DOB are required" });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 3. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // 4. Create user WITHOUT password
    const newUser = await User.create({
      fullName,
      email,
      dob,
      role: role || "user",
      otp,
      otpExpiry,
      password: null, // explicitly null
    });

    // 5. Send OTP email
    await sendEmail(
      email,
      "Your OTP Code",
      `Hello ${fullName},Your OTP code is:${otp} This code will expire in 10 minutes.`
    );

    console.log("OTP sent to:", email);

    res.status(201).json({
      message: "User registered successfully. OTP sent to email.",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        dob: newUser.dob,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc Verify OTP
// @route POST /api/verify-otp
// @access Public
// This endpoint allows users to verify their OTP after registration
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // 1. Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    // 2. Check OTP
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 3. Check expiry
    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // 4. Mark user as verified
    user.otp = null;
    user.otpExpiry = null;
    user.isVerified = true; // You’ll need to add this field to your User model
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc Set Password
// @route POST /api/set-password
// @access Public
// This endpoint allows users to set their password after registration
// It should only be called after OTP verification
export const setPassword = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Email, password, and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "Email not verified yet" });
    }

    // ✅ Assign plain password — pre-save hook will hash it
    user.password = password;
    await user.save();

    res.json({ message: "Password set successfully. You can now log in." });
  } catch (error) {
    console.error("Error setting password:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc Login With JWT
// @route POST /api/login
// @access Public
// This endpoint allows users to log in with their email and password
// It returns a JWT token and user details
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("\n=== LOGIN ATTEMPT ===");
    console.log({ email });

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check verification
    if (!user.isVerified) {
      return res.status(401).json({
        message: "Account not verified. Please verify your email first.",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT with role
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );

    console.log("✅ Login successful");

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role, // role comes from DB
      },
    });
  } catch (error) {
    console.error("🔥 Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
