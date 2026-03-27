const stations = [
  { id: "tashu_1", name: "대전역 1번 출구", address: "대전 동구 중앙로 215", lat: 36.3321, lng: 127.4343 },
  { id: "tashu_2", name: "유성온천역", address: "대전 유성구 봉명동", lat: 36.3536, lng: 127.3435 },
  { id: "tashu_3", name: "시청역", address: "대전 서구 둔산동", lat: 36.3512, lng: 127.3843 },
  { id: "tashu_4", name: "대전시청", address: "대전 서구 둔산로 100", lat: 36.3505, lng: 127.3848 }
];

const DEFAULT_PAGE_SIZE = Math.max(1, Number(process.env.TASHU_API_NUM_OF_ROWS || 20));
const DEFAULT_TIMEOUT_MS = Math.max(1000, Number(process.env.TASHU_API_TIMEOUT_MS || 10000));
const CACHE_TTL_MS = Math.max(0, Number(process.env.TASHU_API_CACHE_TTL_MS || 5 * 60 * 1000));

let cachedStations = null;
let cachedAt = 0;
let warnedAboutFallback = false;

function getEnvValue(name) {
  return (process.env[name] || "").trim();
}

function decodeServiceKey(value) {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildRequestUrl(baseUrl, serviceKey, pageNo, numOfRows) {
  let requestUrl;

  try {
    requestUrl = new URL(baseUrl);
  } catch (error) {
    throw new Error("TASHU_API_BASE_URL must be a valid absolute URL.");
  }  

  requestUrl.searchParams.set("serviceKey", decodeServiceKey(serviceKey));
  requestUrl.searchParams.set("pageNo", String(pageNo));
  requestUrl.searchParams.set("numOfRows", String(numOfRows));
  return requestUrl.toString();
}

function normalizeStation(item) {
  const lat = toFiniteNumber(item?.laCrdnt ?? item?.x_pos);
  const lng = toFiniteNumber(item?.loCrdnt ?? item?.y_pos);

  return {
    id: item?.kioskId || item?.kioskNo || item?.id || null,
    name: item?.lcNm || item?.name || "",
    address: item?.adres || item?.address || "",
    lat,
    lng,
    parkingCount: toFiniteNumber(item?.parkingCount ?? item?.parking_count ?? null),
    dockCount: toFiniteNumber(item?.dftrCo ?? null)
  };
}

function isStationValid(station) {
  return Boolean(station.id && station.name && Number.isFinite(station.lat) && Number.isFinite(station.lng));
}

function getApiConfig() {
  return {
    baseUrl: getEnvValue("TASHU_API_BASE_URL"),
    serviceKey: getEnvValue("TASHU_API_SERVICE_KEY")
  };
}

async function fetchPage(baseUrl, serviceKey, pageNo, numOfRows) {
  const requestUrl = buildRequestUrl(baseUrl, serviceKey, pageNo, numOfRows);
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(requestUrl, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Tashu API request failed with status ${response.status}.`);
  }

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Failed to parse JSON from Tashu API response.");
  }
  const body = payload?.response?.body;
  const header = payload?.response?.header;

  if (!payload?.response || !body || !header) {
    throw new Error("Unexpected Tashu API response shape.");
  }

  const resultCode = String(header.resultCode || "").trim();
  if (resultCode && resultCode !== "C00") {
    const resultMsg = String(header.resultMsg || "").trim();
    throw new Error(`Tashu API returned ${resultCode}${resultMsg ? `: ${resultMsg}` : ""}`);
  }

  return {
    totalCount: toFiniteNumber(body.totalCount) || 0,
    items: toArray(body.items)
  };
}

async function fetchStationsFromApi() {
  const { baseUrl, serviceKey } = getApiConfig();

  if (!baseUrl || !serviceKey) {
    if (!warnedAboutFallback) {
      console.warn("Tashu API is not configured. Falling back to local sample stations.");
      warnedAboutFallback = true;
    }
    return stations;
  }

  if (cachedStations && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedStations;
  }

  const firstPage = await fetchPage(baseUrl, serviceKey, 1, DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / DEFAULT_PAGE_SIZE));
  const stationItems = [...firstPage.items];

  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const page = await fetchPage(baseUrl, serviceKey, pageNo, DEFAULT_PAGE_SIZE);
    stationItems.push(...page.items);
  }

  const validStations = stationItems
    .map(normalizeStation)
    .filter(isStationValid);

  cachedStations = validStations;
  cachedAt = Date.now();

  return validStations;
}

async function fetchStations() {
  return fetchStationsFromApi();
}

module.exports = {
  fetchStations
};
