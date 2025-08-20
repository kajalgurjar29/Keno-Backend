// src/utils/otpGenerator.js
import otpGenerator from "otp-generator";

function generateOTP() {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });
}

export default generateOTP;
