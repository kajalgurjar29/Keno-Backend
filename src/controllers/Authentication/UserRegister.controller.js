import User from "../../models/User.model.js";
import Ticket from "../../models/ticket.model.js";
import Payment from "../../models/Payment.js";
import Notification from "../../models/Notification.js";
import Alert from "../../models/Alert.model.js";
import OtpToken from "../../models/otpToken.model.js";
import sendEmail from "../../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import eventBus, { EVENTS } from "../../utils/eventBus.js";
import NotificationService from "../../services/NotificationService.js";

// @desc Register a new user
// @route POST /api/register
// @access Public
// This endpoint allows new users to register
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, dob, role, pin, default_state, gender } = req.body;

    console.log("Incoming Register Data:", req.body);

    // 1. Validate fields
    if (!fullName || !email || !dob) {
      return res
        .status(400)
        .json({ message: "Full name, email, and DOB are required" });
    }

    // pin setting validation
    if (!pin) {
      return res.status(400).json({ message: "PIN is required" });
    }

    if (!/^\d{4}(\d{2})?$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4 or 6 digits" });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 3. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // trial logic
    const trialDays = 7;
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    // 4. Create user WITHOUT password
    const newUser = await User.create({
      fullName,
      email,
      dob,
      gender: gender || "other",
      role: role || "user",
      pin,
      default_state: default_state || "NSW",
      otp,
      otpExpiry,
      password: null, // explicitly null
      trialStart: now,
      trialEnd,
      planType: "trial",
      isSubscriptionActive: true,
    });

    // 5. Send OTP email
    const subject = "Welcome to Punt Mate - Your OTP Code";
    const textMessage = `Hello ${fullName}, Your OTP code is: ${otp}. This code will expire in 10 minutes.`;
    const htmlMessage = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; margin: 0; font-size: 28px; letter-spacing: -0.5px;">Punt <span style="color: #0066ff;">Mate</span></h1>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="font-size: 16px; color: #444; margin-top: 0;">Hello <strong>${fullName}</strong>,</p>
          <p style="font-size: 16px; color: #444;">Thank you for joining Punt Mate! Use the code below to verify your email address:</p>
          <div style="margin: 30px 0;">
            <span style="font-size: 36px; font-weight: 700; color: #0066ff; letter-spacing: 5px; background: #fff; padding: 10px 25px; border-radius: 8px; border: 2px dashed #0066ff;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #888;">This code will expire in <strong>10 minutes</strong>.</p>
        </div>
        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 12px; color: #aaa;">If you didn't create an account with Punt Mate, you can safely ignore this email.</p>
          <p style="font-size: 12px; color: #aaa;">&copy; 2026 Punt Mate. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail(email, subject, textMessage, htmlMessage);

    console.log("OTP sent to:", email);

    // 🆕 Emit Registration Event
    eventBus.emit(EVENTS.USER_REGISTERED, { user: newUser });

    res.status(201).json({
      message: "User registered successfully. OTP sent to email.",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        dob: newUser.dob,
        gender: newUser.gender,
        role: newUser.role,
        default_state: newUser.default_state,
        isSubscriptionActive: newUser.isSubscriptionActive,
        planType: newUser.planType,
        trialEnd: newUser.trialEnd,
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

// export const loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     console.log("\n=== LOGIN ATTEMPT ===");
//     console.log({ email });

//     // Validate input
//     if (!email || !password) {
//       return res.status(400).json({
//         message: "Email and password are required",
//       });
//     }

//     // Find user
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Check verification
//     if (!user.isVerified) {
//       return res.status(401).json({
//         message: "Account not verified. Please verify your email first.",
//       });
//     }

//     // Check password
//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid password" });
//     }

//     // Generate JWT with role
//     const token = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.ACCESS_TOKEN_SECRET,
//       { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
//     );

//     console.log("✅ Login successful");

//     res.status(200).json({
//       message: "Login successful",
//       token,
//       user: {
//         id: user._id,
//         fullName: user.fullName,
//         email: user.email,
//         role: user.role, // role comes from DB
//       },
//     });
//   } catch (error) {
//     console.error("🔥 Login error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const loginUser = async (req, res) => {
  try {
    const { email, password, pin } = req.body;

    console.log("\n=== LOGIN ATTEMPT ===");
    console.log({ email, loginType: password ? "PASSWORD" : "PIN" });

    // 1. Validate input
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!password && !pin) {
      return res.status(400).json({
        message: "Password or PIN is required",
      });
    }

    // 2. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3. Check verification
    if (!user.isVerified) {
      return res.status(401).json({
        message: "Account not verified. Please verify your email first.",
      });
    }

    let isMatch = false;

    // 4️⃣ Password login (OLD LOGIC – SAFE)
    if (password) {
      if (!user.password) {
        return res.status(400).json({
          message: "Password login not available for this user",
        });
      }
      isMatch = await user.comparePassword(password);
    }

    // 5️⃣ PIN login (NEW)
    if (pin) {
      if (!user.pin) {
        return res.status(400).json({
          message: "PIN login not enabled for this user",
        });
      }
      isMatch = await user.comparePin(pin);
    }

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }
    console.log("SUB STATUS:", user.isSubscribed);



    // 6. Generate JWT with role
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );

    console.log("✅ Login successful");

    // 🆕 Emit Login Event
    eventBus.emit(EVENTS.USER_LOGGED_IN, { user, ip: req.ip });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        pin: user.pin,
        role: user.role,
        default_state: user.default_state,
        isSubscriptionActive: user.isSubscriptionActive,
        planType: user.planType,
        trialEnd: user.trialEnd,
        subscriptionEnd: user.subscriptionEnd,
      },
    });
  } catch (error) {
    console.error(" Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const saveFcmToken = async (req, res) => {
  const userId = req.user.id; // JWT se
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "FCM token required" });
  }

  await User.findByIdAndUpdate(userId, {
    $addToSet: { fcmTokens: token },
  });

  res.json({ success: true, message: "FCM token saved successfully" });
};

// @desc Delete user account and all associated data
// @route DELETE /api/delete-account
// @access Private (requires authentication)
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the user first to confirm they exist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete all associated data
    await Promise.all([
      // Delete user's tickets
      Ticket.deleteMany({ assignedTo: userId }),

      // Delete user's payments
      Payment.deleteMany({ userId }),

      // Delete user's notifications
      Notification.deleteMany({ userId }),

      // Delete user's alerts
      Alert.deleteMany({ userId }),
    ]);

    // Finally, delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      message: "Account and all associated data deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
