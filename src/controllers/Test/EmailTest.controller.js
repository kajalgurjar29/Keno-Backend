import sendEmail from "../../utils/sendEmail.js";

export const testSendGridEmail = async (req, res) => {
    const { to } = req.body;

    if (!to) {
        return res.status(400).json({ message: "Recipient email 'to' is required." });
    }

    try {
        await sendEmail(
            to,
            "SendGrid Test Email",
            "If you are seeing this, SendGrid is working properly!",
            "<h2>✅ SendGrid Working</h2><p>This is a test email from your application.</p>"
        );
        res.status(200).json({ message: "Test email sent successfully via SendGrid." });
    } catch (error) {
        res.status(500).json({
            message: "Failed to send test email.",
            error: error.message,
            details: error.response ? error.response.body : null
        });
    }
};
