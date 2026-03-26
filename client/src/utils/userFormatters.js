import { REGIONS } from "../constants/regionConstants";

const REGION_NAME_BY_ID = REGIONS.reduce((accumulator, region) => {
  accumulator[region.id] = region.name;
  accumulator[region.name.toLowerCase()] = region.name;
  return accumulator;
}, {});

const REGION_ALIASES = {
  yuseonggu: "yuseong",
  yuseong_gu: "yuseong",
  yuseonggu_daejeon: "yuseong",
  seo_gu: "seo",
  seogu: "seo",
  daedeokgu: "daedeok",
  daedeok_gu: "daedeok",
  donggu: "dong",
  dong_gu: "dong",
  junggu: "jung",
  jung_gu: "jung",
  visitor_user: "visitor"
};

function normalizeRegionKey(region) {
  if (!region) return "";
  const normalized = String(region).trim().toLowerCase().replace(/[\s,-]+/g, "_");
  return REGION_ALIASES[normalized] || normalized;
}

export function formatRegion(region, options = {}) {
  const { includeCity = false, fallback = "유성구" } = options;
  const normalizedKey = normalizeRegionKey(region);
  const regionName =
    REGION_NAME_BY_ID[normalizedKey] ||
    REGION_NAME_BY_ID[String(region || "").trim().toLowerCase()] ||
    String(region || "").trim() ||
    fallback;

  if (!includeCity || !regionName || regionName === "관광객") {
    return regionName;
  }

  return `${regionName}, 대전`;
}
