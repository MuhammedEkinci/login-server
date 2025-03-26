const express = require("express");
const router = express.Router();

// Sample route
router.get("/", (req, res) => {
  res.json({ message: "Welcome to your Node.js server!" });
});

//************** SIGN UP ROUTES *****************//
// POST ROUTE TO SIGN USER UP

//************** LOGIN ROUTES *****************//
// get route login

//************** FORGET PASSWORD ROUTES *****************//

//************** LOGOUT ROUTES *****************//

module.exports = router;
