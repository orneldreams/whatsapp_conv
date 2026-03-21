import countries from "world-countries";

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toFlagFromCca2(cca2) {
  const code = String(cca2 || "").toUpperCase();
  if (code.length !== 2) return "";

  return code.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function findCountryByFrenchName(countryName) {
  const normalized = normalizeName(countryName);
  if (!normalized) return null;

  return (
    countries.find((country) => normalizeName(country?.translations?.fra?.common) === normalized) ||
    countries.find((country) => normalizeName(country?.name?.common) === normalized) ||
    null
  );
}

export function getFlagEmoji(countryName) {
  const country = findCountryByFrenchName(countryName);
  if (!country) return "";
  return toFlagFromCca2(country.cca2);
}

export function getCountryNameFr(countryName) {
  const country = findCountryByFrenchName(countryName);
  if (!country) return String(countryName || "").trim();

  return (
    country?.translations?.fra?.common ||
    country?.translations?.fra?.official ||
    country?.name?.common ||
    String(countryName || "").trim()
  );
}

export function formatCountryWithFlag(countryName) {
  const clean = String(countryName || "").trim();
  if (!clean) return "";

  const nameFr = getCountryNameFr(clean);
  const flag = getFlagEmoji(nameFr);
  return flag ? `${flag} ${nameFr}` : nameFr;
}
