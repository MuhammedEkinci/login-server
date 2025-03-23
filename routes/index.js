const express = require("express");
const router = express.Router();

// Sample route
router.get("/", (req, res) => {
  res.json({ message: "Welcome to your Node.js server!" });
});

module.exports = router;
