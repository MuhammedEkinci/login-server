const express = require("express");
const User = require("../models/user");
const sendMail = require("../middlewares/utils/sendEmail");
const router = express.Router();

// Sample route
router.get("/", (req, res) => {
  res.json({ message: "Welcome to your Node.js server!" });
});

//************** SIGN UP ROUTES *****************//
// POST ROUTE TO SIGN USER UP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    // check if user already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser)
      return res.status(409).json({ message: "Email is already registered" });

    // CREATE NEW USER IF DOESN'T EXIST
    const newUser = new User({ name, email, password });
    newUser.generateVerificationToken();
    await newUser.save();

    // SEND EMAIL VERIFICATION HERE
    const verificationLink = `http://localhost:3000/api/auth/verify-email?token=${newUser.verificationToken}`;

    // email template
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;">
        <h2 style="color:#333;">Hi ${newUser.name},</h2>
        <p style="color:#555;">Click below to verify your email address:</p>
        <a href="${verificationLink}" style="display:inline-block;padding:10px 20px;background:#4CAF50;color:#fff;border-radius:4px;text-decoration:none;">Verify Email</a>
        <p style="color:#999;margin-top:20px;">If you did not sign up, you can ignore this email.</p>
      </div>
    </body>
    </html>
  `;

    await sendMail(newUser.email, "Verify Your Email", emailHtml);
    // SEND EMAIL VERIFICATION HERE

    res.status(201).json({
      message: "User created. Please verify your email.",
      verificationLink, // For testing, return it here
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ******** VERIFY EMAIL ROUTE ******** //
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token)
      return res.status(400).json({ message: "Verification token missing" });

    const user = await User.findOne({ verificationToken: token });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.verified = true;
    user.verificationToken = undefined; // clear the token
    await user.save();

    res
      .status(200)
      .json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
