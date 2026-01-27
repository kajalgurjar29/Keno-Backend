// import mongoose from "mongoose";
// import bcrypt from "bcrypt";

// const userSchema = new mongoose.Schema(
//   {
//     fullName: {
//       type: String,
//       required: [true, "Full name is required"],
//       trim: true,
//     },
//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       unique: true,
//       lowercase: true,
//     },
//     dob: {
//       type: Date,
//       required: [true, "Date of birth is required"],
//     },
//     password: {
//       type: String,
//       default: null,
//       minlength: [6, "Password must be at least 6 characters"],
//     },
//     role: {
//       type: String,
//       enum: ["user", "admin"],
//       default: "user",
//     },
//     otp: {
//       type: String,
//       default: null,
//     },
//     otpExpiry: {
//       type: Date,
//       default: null,
//     },
//     isVerified: {
//       type: Boolean,
//       default: false,
//     },
//       pin: {
//       type: String,
//       default: null,
//     },

//     default_state: {
//       type: String,
//       enum: ["NSW"],
//       default: "NSW",
//     },

//     status: {
//       type: String,
//       enum: ["active", "inactive"],
//       default: "active",
//     },
//      fcmToken: {
//       type: String,
//       default: null,
//     },
//   },
//   { timestamps: true }
// );

// //  Hash password before saving
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password") || !this.password) {
//     return next();
//   }
//   try {
//     this.password = await bcrypt.hash(this.password, 10);
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// //  Compare entered password with hashed password
// userSchema.methods.comparePassword = async function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// export default mongoose.model("User", userSchema);

import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
    },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    password: {
      type: String,
      default: null,
      minlength: [6, "Password must be at least 6 characters"],
    },

    /* ================= ROLE ================= */
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    /* ================= OTP ================= */
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    pin: {
      type: String, // hashed PIN
      default: null,
    },

    default_state: {
      type: String,
      enum: ["NSW", "VIC", "ACT", "SA"],
      default: "VIC",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },


    fcmTokens: {
      type: [String],
      default: [],
    },
    notificationPreferences: {
      activity: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      results: {
        email: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      alerts: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

// userSchema.pre("save", async function (next) {
//   if (!this.isModified("pin") || !this.pin) {
//     return next();
//   }
//   try {
//     this.pin = await bcrypt.hash(this.pin, 10);
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// userSchema.methods.comparePin = async function (candidatePin) {
//   return bcrypt.compare(candidatePin, this.pin);
// };

userSchema.methods.comparePin = function (candidatePin) {
  return candidatePin === this.pin;
};

export default mongoose.model("User", userSchema);
