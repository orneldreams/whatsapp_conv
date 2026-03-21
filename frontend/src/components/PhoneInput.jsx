import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  COUNTRY_OPTIONS,
  formatPhoneValue,
  getCountryByDialCode,
  parsePhoneValue
} from "../utils/countryPhone";

const DEFAULT_COUNTRY = COUNTRY_OPTIONS.find((country) => country.cca2 === "CM") || COUNTRY_OPTIONS[0];
const FREQUENT_COUNTRY_CODES = ["FR", "CM", "BJ", "SN", "CI", "CD"];

function PhoneInput({ value, onChange, theme, placeholder = "Numéro" }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [nationalNumber, setNationalNumber] = useState("");
  const wrapperRef = useRef(null);

  const phoneCountries = useMemo(
    () =>
      COUNTRY_OPTIONS.filter((country) => country.dialCodes.length > 0).map((country) => ({
        ...country,
        dialCode: country.dialCodes[0]
      })),
    []
  );

  useEffect(() => {
    const parsed = parsePhoneValue(value);
    const countryFromValue = getCountryByDialCode(parsed.dialCode);

    if (countryFromValue && countryFromValue.cca2 !== selectedCountry?.cca2) {
      setSelectedCountry(countryFromValue);
    }

    if (parsed.nationalNumber !== nationalNumber) {
      setNationalNumber(parsed.nationalNumber);
    }

    if (!value && selectedCountry?.dialCodes?.[0] !== DEFAULT_COUNTRY?.dialCodes?.[0]) {
      setSelectedCountry(DEFAULT_COUNTRY);
      setNationalNumber("");
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const filteredCountries = useMemo(() => {
    const rawQuery = String(searchQuery || "").trim();
    const normalizedQuery = rawQuery.toLowerCase();
    const queryDigits = rawQuery.replace(/\D/g, "");

    if (!normalizedQuery && !queryDigits) {
      return [...phoneCountries].sort((left, right) => left.nameFr.localeCompare(right.nameFr, "fr"));
    }

    const startsWith = [];
    const contains = [];

    phoneCountries.forEach((country) => {
      const nameLower = country.nameFr.toLowerCase();
      const dialDigits = country.dialCode.replace(/\D/g, "");
      const matchesName = normalizedQuery ? nameLower.includes(normalizedQuery) : false;
      const matchesDial = queryDigits ? dialDigits.includes(queryDigits) : false;

      if (!matchesName && !matchesDial) {
        return;
      }

      if ((normalizedQuery && nameLower.startsWith(normalizedQuery)) || (queryDigits && dialDigits.startsWith(queryDigits))) {
        startsWith.push(country);
      } else {
        contains.push(country);
      }
    });

    const byName = (left, right) => left.nameFr.localeCompare(right.nameFr, "fr");
    startsWith.sort(byName);
    contains.sort(byName);
    return [...startsWith, ...contains];
  }, [phoneCountries, searchQuery]);

  const frequentCountries = useMemo(() => {
    const map = new Map(filteredCountries.map((country) => [country.cca2, country]));
    return FREQUENT_COUNTRY_CODES.map((code) => map.get(code)).filter(Boolean);
  }, [filteredCountries]);

  const otherCountries = useMemo(() => {
    const frequentSet = new Set(frequentCountries.map((country) => country.cca2));
    return filteredCountries.filter((country) => !frequentSet.has(country.cca2));
  }, [filteredCountries, frequentCountries]);

  const activeDialCode = selectedCountry?.dialCodes?.[0] || "";

  function handleCountrySelect(countryCode) {
    const country = COUNTRY_OPTIONS.find((item) => item.cca2 === countryCode) || DEFAULT_COUNTRY;
    const dialCode = country?.dialCodes?.[0] || "";

    setSelectedCountry(country);
    setOpen(false);
    setSearchQuery("");
    onChange(formatPhoneValue(dialCode, nationalNumber));
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="inline-flex min-w-[122px] items-center justify-between rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: theme === "dark" ? "#0F0E17" : "#FFFFFF",
            border: theme === "dark" ? "1px solid #2D2A3E" : "2px solid #7C3AED",
            color: theme === "dark" ? "#F0EEFF" : "#111827"
          }}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <span>{selectedCountry?.flag || "🏳️"}</span>
            <span>{activeDialCode || "+"}</span>
          </span>
          <ChevronDown size={15} style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }} />
        </button>

        <input
          type="tel"
          value={nationalNumber}
          onChange={(event) => {
            const nextNumber = event.target.value.replace(/\D/g, "");
            setNationalNumber(nextNumber);
            onChange(formatPhoneValue(activeDialCode, nextNumber));
          }}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: theme === "dark" ? "#0F0E17" : "#FFFFFF",
            border: theme === "dark" ? "1px solid #2D2A3E" : "2px solid #7C3AED",
            color: theme === "dark" ? "#F0EEFF" : "#111827"
          }}
          placeholder={placeholder}
        />
      </div>

      {open ? (
        <div
          className="absolute z-50 mt-2 w-full rounded-lg p-2 shadow-lg"
          style={{
            backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF",
            border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD"
          }}
        >
          <div className="relative mb-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }}
            />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher pays ou indicatif"
              className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
              style={{
                backgroundColor: theme === "dark" ? "#0F0E17" : "#F5F3FF",
                border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD",
                color: theme === "dark" ? "#F0EEFF" : "#111827"
              }}
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md">
            {filteredCountries.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }}>
                Aucun résultat
              </p>
            ) : (
              <>
                {frequentCountries.map((country) => {
                  const isActive = selectedCountry?.cca2 === country.cca2;
                  return (
                    <button
                      key={`frequent-${country.cca2}-${country.dialCode}`}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm"
                      style={{
                        color: theme === "dark" ? "#F0EEFF" : "#111827",
                        backgroundColor: isActive ? (theme === "dark" ? "#2A2738" : "#F5F3FF") : "transparent"
                      }}
                      onClick={() => handleCountrySelect(country.cca2)}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <span>{country.flag}</span>
                        <span className="truncate">{country.nameFr}</span>
                      </span>
                      <span style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }}>{country.dialCode}</span>
                    </button>
                  );
                })}

                {frequentCountries.length > 0 && otherCountries.length > 0 ? (
                  <div className="my-1 border-t" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }} />
                ) : null}

                {otherCountries.map((country) => {
                  const isActive = selectedCountry?.cca2 === country.cca2;
                  return (
                    <button
                      key={`${country.cca2}-${country.dialCode}`}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm"
                      style={{
                        color: theme === "dark" ? "#F0EEFF" : "#111827",
                        backgroundColor: isActive ? (theme === "dark" ? "#2A2738" : "#F5F3FF") : "transparent"
                      }}
                      onClick={() => handleCountrySelect(country.cca2)}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <span>{country.flag}</span>
                        <span className="truncate">{country.nameFr}</span>
                      </span>
                      <span style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }}>{country.dialCode}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PhoneInput;
