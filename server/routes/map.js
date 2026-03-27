const express = require("express");
const { fetchStations } = require("../proxy/tashu");
const { sendError } = require("../core/http");

const router = express.Router();

router.get("/stations", async (req, res) => {
  try {
    const stations = await fetchStations();
    res.json({ stations });
  } catch (error) {
    console.error("Failed to load Tashu stations:", error);
    sendError(res, 500, "TASHU_API_ERROR", "Failed to load Tashu station data.");
  }
});

module.exports = router;
