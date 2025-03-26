const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const connectDB = require("./middlewares/config/db");

const app = express();
const PORT = process.env.PORT;

// ------------ connect to database ------------ //
connectDB();
// ------------ connect to database ------------ //

// Security Middlewares
app.use(helmet()); // Sets secure HTTP headers
app.use(cors()); // Enables CORS - adjust origin config if needed
app.use(xss()); // Sanitizes user input (prevents XSS)

// Rate Limiting to prevent brute-force and DoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body Parser Middleware
app.use(express.json());

// Routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
}); ///
