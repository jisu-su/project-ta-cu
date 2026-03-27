require("dotenv").config();
const { fetchStations } = require("./proxy/tashu");

async function test() {
  try {
    const stations = await fetchStations();
    console.log("Stations count:", stations.length);
    if (stations.length > 0) {
      console.log("First station:", stations[0]);
    } else {
      console.log("No stations returned!");
    }
  } catch (error) {
    console.error("Error fetching stations:", error);
  }
}

test();
