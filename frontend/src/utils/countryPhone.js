import countries from "world-countries";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildDialCodes(country) {
  const root = country?.idd?.root || "";
  const suffixes = Array.isArray(country?.idd?.suffixes) ? country.idd.suffixes : [];
  if (!root || suffixes.length === 0) return [];

  return suffixes
    .map((suffix) => `${root}${suffix}`.replace(/[^+\d]/g, ""))
    .filter((code) => code.startsWith("+") && code.length > 1);
}

export const COUNTRY_OPTIONS = countries
  .map((country) => {
    const nameFr =
      country?.translations?.fra?.common ||
      country?.translations?.fra?.official ||
      country?.name?.common ||
      "";

    const dialCodes = buildDialCodes(country);

    return {
      cca2: country?.cca2 || nameFr,
      flag: country?.flag || "🏳️",
      nameFr,
      searchKey: normalizeText(nameFr),
      dialCodes
    };
  })
  .filter((country) => country.nameFr)
  .sort((a, b) => a.nameFr.localeCompare(b.nameFr, "fr"));

export const DIAL_CODE_OPTIONS = COUNTRY_OPTIONS.flatMap((country) =>
  country.dialCodes.map((dialCode) => ({
    countryCode: country.cca2,
    flag: country.flag,
    nameFr: country.nameFr,
    dialCode
  }))
);

const DIAL_CODES_DESC = Array.from(new Set(DIAL_CODE_OPTIONS.map((item) => item.dialCode))).sort(
  (left, right) => right.length - left.length
);

export function getCountryByNameFr(name) {
  const normalized = normalizeText(name);
  if (!normalized) return null;

  return (
    COUNTRY_OPTIONS.find((country) => country.searchKey === normalized) ||
    COUNTRY_OPTIONS.find((country) => country.searchKey.startsWith(normalized)) ||
    null
  );
}

export function normalizeCountryNameFr(name) {
  const match = getCountryByNameFr(name);
  return match ? match.nameFr : String(name || "").trim();
}

export function getCountryByDialCode(dialCode) {
  return COUNTRY_OPTIONS.find((country) => country.dialCodes.includes(dialCode)) || null;
}

export function parsePhoneValue(value) {
  const raw = String(value || "").replace(/\s+/g, "").trim();
  if (!raw) {
    return { dialCode: "", nationalNumber: "" };
  }

  const withPlus = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  const compact = withPlus.replace(/[^+\d]/g, "");

  const dialCode = DIAL_CODES_DESC.find((code) => compact.startsWith(code)) || "";
  if (!dialCode) {
    return { dialCode: "", nationalNumber: compact.replace(/^\+/, "") };
  }

  return {
    dialCode,
    nationalNumber: compact.slice(dialCode.length).replace(/\D/g, "")
  };
}

export function formatPhoneValue(dialCode, nationalNumber) {
  const cleanDialCode = String(dialCode || "").replace(/[^+\d]/g, "");
  const cleanNational = String(nationalNumber || "").replace(/\D/g, "");

  if (!cleanDialCode && !cleanNational) return "";
  if (!cleanDialCode) return cleanNational;
  return `${cleanDialCode}${cleanNational}`;
}

export function filterCountries(list, query) {
  const normalized = normalizeText(query);
  if (!normalized) return list;

  return list.filter((country) => {
    const byName = country.searchKey.includes(normalized);
    const byDial = country.dialCodes.some((dialCode) => dialCode.includes(normalized.replace(/\D/g, "")));
    return byName || byDial;
  });
}
