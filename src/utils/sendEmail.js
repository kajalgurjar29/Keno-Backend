import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Sends an email using SendGrid
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 */
const sendEmail = async (to, subject, text, html) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL, // Must be a verified sender in SendGrid
    subject,
    text,
    html: html || `<div>${text}</div>`,
  };

  try {
    const response = await sgMail.send(msg);
    console.log("Email sent successfully via SendGrid:", response[0].statusCode);
    return response;
  } catch (error) {
    console.error("Error sending email via SendGrid:", error.message);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
};

export default sendEmail;
