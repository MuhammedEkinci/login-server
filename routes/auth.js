const express = require("express");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const sendMail = require("../middlewares/utils/sendEmail");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const router = express.Router();
require("dotenv").config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    const verificationLink = `https://serhendiloginserver-hbcjgzb4bqekh2fw.eastus2-01.azurewebsites.net/api/auth/verify-email?token=${newUser.verificationToken}`;

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

// *********** FORGOT PASSWORD ROUTE *************** //
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "No user found with that email" });

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `http://www.serhendiusa.com/reset-password?token=${token}`;
    // const resetLink = `serhendi-usa-app://reset-password?token=${token}`;

    const emailHtml = `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
    `;

    await sendMail(user.email, "Reset Your Password", emailHtml);

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// *********** RESET PASSWORD ROUTE *************** //
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ************* LOGIN ROUTE *************** //
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    // Find user
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    // Check if email is verified (skip for Google users)
    if (!user.verified && user.authProvider === "local")
      return res
        .status(403)
        .json({ message: "Please verify your email first" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    // Create JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ************* GOOGLE OAUTH ROUTE *************** //
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Google token is required" });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user already exists
    let user = await User.findOne({
      $or: [{ email }, { googleId }]
    });

    if (user) {
      // User exists, update Google info if needed
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = "google";
        user.verified = true; // Google accounts are pre-verified
        user.profilePicture = picture;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        name,
        email,
        googleId,
        authProvider: "google",
        verified: true, // Google accounts are pre-verified
        profilePicture: picture,
      });
      await user.save();
    }

    // Create JWT token
    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Google authentication successful",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

module.exports = router;
