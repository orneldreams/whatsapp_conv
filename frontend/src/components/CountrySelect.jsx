import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRY_OPTIONS, filterCountries, normalizeCountryNameFr } from "../utils/countryPhone";

function CountrySelect({ value, onChange, theme, placeholder = "Rechercher un pays" }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const wrapperRef = useRef(null);

  const selectedCountry = useMemo(
    () => COUNTRY_OPTIONS.find((country) => country.nameFr === normalizeCountryNameFr(value)),
    [value]
  );

  const filteredCountries = useMemo(() => {
    const normalizedQuery = String(searchQuery || "").toLowerCase().trim();
    if (!normalizedQuery) {
      return COUNTRY_OPTIONS;
    }

    const matched = filterCountries(COUNTRY_OPTIONS, normalizedQuery);
    const startsWith = [];
    const contains = [];

    matched.forEach((country) => {
      const nameLower = country.nameFr.toLowerCase();
      if (nameLower.startsWith(normalizedQuery)) {
        startsWith.push(country);
      } else {
        contains.push(country);
      }
    });

    const byName = (left, right) => left.nameFr.localeCompare(right.nameFr, "fr");
    startsWith.sort(byName);
    contains.sort(byName);
    return [...startsWith, ...contains];
  }, [searchQuery]);

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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className="inline-flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm outline-none"
        style={{
          backgroundColor: theme === "dark" ? "#0F0E17" : "#FFFFFF",
          border: theme === "dark" ? "1px solid #2D2A3E" : "2px solid #7C3AED",
          color: theme === "dark" ? "#F0EEFF" : "#111827"
        }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate text-left">
          {selectedCountry
            ? `${selectedCountry.flag} ${selectedCountry.nameFr}`
            : value
              ? normalizeCountryNameFr(value)
              : placeholder}
        </span>
        <ChevronDown size={15} style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }} />
      </button>

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
              placeholder="Rechercher un pays"
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
                Aucun pays trouvé
              </p>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.cca2}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
                  style={{
                    color: theme === "dark" ? "#F0EEFF" : "#111827",
                    backgroundColor:
                      selectedCountry?.cca2 === country.cca2
                        ? theme === "dark"
                          ? "#2A2738"
                          : "#F5F3FF"
                        : "transparent"
                  }}
                  onClick={() => {
                    onChange(country.nameFr);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <span>{country.flag}</span>
                  <span className="truncate">{country.nameFr}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CountrySelect;
