const router = require("express").Router();
const User = require("../models/User");

// GET /api/users
router.get("/", async (req, res) => {
  const users = await User.find().lean();
  res.json(users);
});

module.exports = router;
