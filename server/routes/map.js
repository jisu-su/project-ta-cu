const express = require("express");
const { fetchStations } = require("../proxy/tashu");

const router = express.Router();

router.get("/stations", (req, res) => {
  res.json({ stations: fetchStations() });
});

module.exports = router;
