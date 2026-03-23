import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MessageSquarePlus,
  Search,
  Table2,
  UserPlus,
  UserRound
} from "lucide-react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api/client";
import CountrySelect from "../components/CountrySelect";
import ConfirmModal from "../components/ConfirmModal";
import Layout from "../components/Layout";
import ManualCheckinModal from "../components/ManualCheckinModal";
import PhoneInput from "../components/PhoneInput";
import SingleDiscipleCheckinModal from "../components/SingleDiscipleCheckinModal";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { firestore } from "../services/firebase";
import { formatCountryWithFlag } from "../utils/countries";

const avatarColors = [
  { bg: "#4F46E5", text: "#fff" },
  { bg: "#0F766E", text: "#fff" },
  { bg: "#B45309", text: "#fff" },
  { bg: "#BE185D", text: "#fff" },
  { bg: "#7C3AED", text: "#fff" },
  { bg: "#047857", text: "#fff" },
  { bg: "#B91C1C", text: "#fff" },
  { bg: "#1D4ED8", text: "#fff" }
];

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

function formatDateFr(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayIndex);
  const todayKey = toDateKey(new Date());
  const days = [];

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    days.push({
      key: toDateKey(current),
      label: current.getDate(),
      inCurrentMonth: current.getMonth() === month,
      isToday: toDateKey(current) === todayKey
    });
  }

  return days;
}

function formatDateFrCompact(value) {
  if (!value) return "Selectionner une date";
  const date = parseDateKey(value);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function ModalDatePicker({ value, onChange, theme }) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = value ? parseDateKey(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const wrapperRef = useRef(null);

  const days = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  const monthLabel = useMemo(
    () =>
      calendarMonth
        .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        .replace(/^./, (char) => char.toUpperCase()),
    [calendarMonth]
  );

  useEffect(() => {
    if (!value) return;
    const base = parseDateKey(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const inputStyle = {
    backgroundColor: theme === "dark" ? "#0F0E17" : "#FFFFFF",
    border: theme === "dark" ? "1px solid #2D2A3E" : "2px solid #7C3AED",
    color: theme === "dark" ? "#F0EEFF" : "#111827"
  };

  const popoverStyle = {
    backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF",
    border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD"
  };

  const controlStyle = {
    backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF",
    border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD",
    color: theme === "dark" ? "#9CA3AF" : "#4B5563"
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm outline-none"
        style={inputStyle}
      >
        <span
          className="inline-flex items-center gap-2"
          style={{ color: value ? inputStyle.color : theme === "dark" ? "#9CA3AF" : "#4B5563" }}
        >
          <CalendarDays size={15} style={{ color: value ? inputStyle.color : theme === "dark" ? "#9CA3AF" : "#4B5563" }} />
          {formatDateFrCompact(value)}
        </span>
        <span style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }}>▾</span>
      </button>

      {open ? (
        <div className="absolute z-40 mt-2 w-[300px] rounded-lg p-3 shadow-lg" style={popoverStyle}>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
              style={controlStyle}
              onClick={() =>
                setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={14} style={{ color: controlStyle.color }} />
            </button>
            <p className="text-sm font-semibold" style={{ color: theme === "dark" ? "#F0EEFF" : "#111827" }}>{monthLabel}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
              style={controlStyle}
              onClick={() =>
                setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={14} style={{ color: controlStyle.color }} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {["L", "M", "M", "J", "V", "S", "D"].map((dayLabel, index) => (
              <span
                key={`${dayLabel}-${index}`}
                className="py-1 text-center text-[11px] font-medium"
                style={{ color: theme === "dark" ? "#9CA3AF" : "#4B5563" }}
              >
                {dayLabel}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isSelected = day.key === value;

              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => {
                    onChange(day.key);
                    setOpen(false);
                  }}
                  className={`h-9 rounded-md text-sm transition-colors ${day.inCurrentMonth ? "opacity-100" : "opacity-40"}`}
                  style={{
                    backgroundColor: isSelected ? "#6C3FE8" : "transparent",
                    color: isSelected ? "#FFFFFF" : theme === "dark" ? "#F0EEFF" : "#111827",
                    border: day.isToday && !isSelected ? "1px solid #6C3FE8" : "1px solid transparent"
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusClass(status, isDark) {
  if (isDark) {
    if (status === "Actif") return "bg-[#064E3B] text-[#6EE7B7]";
    if (status === "Silencieux") return "bg-[#450A0A] text-[#FCA5A5]";
    return "bg-[#1F2937] text-[#9CA3AF]";
  }
  if (status === "Actif") return "bg-emerald-100 text-emerald-700";
  if (status === "Silencieux") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function normalizeStatus(status) {
  return status === "Onboarding en cours" ? "Onboarding" : status;
}

function VerificationBadge({ verificationStatus, addedBy }) {
  if (!addedBy || addedBy === "whatsapp") return null;
  if (verificationStatus === "none")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Non requis
      </span>
    );
  if (verificationStatus === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        ⏳ En attente
      </span>
    );
  if (verificationStatus === "verified")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        ✅ Vérifié
      </span>
    );
  if (verificationStatus === "failed")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
        ⚠️ Échec
      </span>
    );
  return null;
}

function AddDiscipleModal({ isOpen, onClose, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newDisciple, setNewDisciple] = useState({
    name: "",
    phoneNumber: "",
    originCountry: "",
    currentCountry: "",
    conversionDate: "",
    christianLifeStart: "",
    church: "",
    mainPastor: "",
    discipleMaker: false
  });

  const { theme } = useTheme();
  const inputStyle = {
    backgroundColor: theme === "dark" ? "#0F0E17" : "#FFFFFF",
    border: theme === "dark" ? "1px solid #2D2A3E" : "2px solid #7C3AED",
    color: theme === "dark" ? "#F0EEFF" : "#111827"
  };

  const labelStyle = {
    color: theme === "dark" ? "#9CA3AF" : "#3730A3",
    fontWeight: 600
  };

  const modalStyle = {
    backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF"
  };

  const modalBorderStyle = {
    border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD"
  };

  const leftColumnStyle = {
    backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF",
    color: theme === "dark" ? "#F0EEFF" : "#111827"
  };

  const rightColumnStyle = {
    borderLeft: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD",
    backgroundColor: theme === "dark" ? "#0F0E17" : "#F5F3FF",
    color: theme === "dark" ? "#F0EEFF" : "#111827"
  };

  const footerStyle = {
    borderTop: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD",
    backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF"
  };

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setNewDisciple({
      name: "",
      phoneNumber: "",
      originCountry: "",
      currentCountry: "",
      conversionDate: "",
      christianLifeStart: "",
      church: "",
      mainPastor: "",
      discipleMaker: false
    });
    setError("");
  }

  const PHONE_REGEX = /^\+[0-9]{6,15}$/;
  const phoneError = newDisciple.phoneNumber && !PHONE_REGEX.test(newDisciple.phoneNumber)
    ? "Le numéro doit commencer par + suivi de chiffres uniquement\nEx: +33758384679"
    : "";

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    if (!newDisciple.name.trim() || !newDisciple.phoneNumber.trim()) {
      setError("Nom et numero sont requis");
      return;
    }

    if (!PHONE_REGEX.test(newDisciple.phoneNumber)) {
      setError("Le numéro doit commencer par + suivi de chiffres uniquement\nEx: +33758384679");
      return;
    }

    setCreating(true);
    try {
      await api.post("/api/disciples", newDisciple);
      resetForm();
      onClose();
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const canSave = newDisciple.name.trim() && newDisciple.phoneNumber.trim() && !phoneError;

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto px-3 py-3 sm:px-4 sm:py-6"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
    >
      <form
        onSubmit={handleCreate}
        className="mx-auto flex min-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl"
        style={{ ...modalStyle, ...modalBorderStyle }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
          style={{
            ...leftColumnStyle,
            borderBottom: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD"
          }}
        >
          <h3 className="text-base font-semibold sm:text-lg" style={{ color: theme === "dark" ? "#F0EEFF" : "#111827" }}>
            Ajouter un disciple
          </h3>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={{
              backgroundColor: theme === "dark" ? "#0F0E17" : "#F5F3FF",
              border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD",
              color: theme === "dark" ? "#E2E8F0" : "#4C1D95"
            }}
          >
            Fermer
          </button>
        </div>

        <div className="grid overflow-y-auto xl:grid-cols-2">
          <div className="space-y-4 p-4 sm:p-5" style={leftColumnStyle}>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Nom complet *</span>
              <input
                value={newDisciple.name}
                onChange={(e) => setNewDisciple((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
                required
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Numero WhatsApp *</span>
              <PhoneInput
                value={newDisciple.phoneNumber}
                onChange={(nextPhone) => setNewDisciple((prev) => ({ ...prev, phoneNumber: nextPhone }))}
                theme={theme}
                placeholder="+237 6XX XXX XXX"
              />
              {phoneError ? (
                <p className="mt-1 whitespace-pre-line text-xs" style={{ color: "#EF4444" }}>{phoneError}</p>
              ) : null}
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Pays d'origine</span>
                <CountrySelect
                  value={newDisciple.originCountry}
                  onChange={(nextCountry) => setNewDisciple((prev) => ({ ...prev, originCountry: nextCountry }))}
                  theme={theme}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Pays actuel</span>
                <CountrySelect
                  value={newDisciple.currentCountry}
                  onChange={(nextCountry) => setNewDisciple((prev) => ({ ...prev, currentCountry: nextCountry }))}
                  theme={theme}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Date de conversion</span>
                <ModalDatePicker
                  value={newDisciple.conversionDate}
                  onChange={(nextDate) => setNewDisciple((prev) => ({ ...prev, conversionDate: nextDate }))}
                  theme={theme}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Début vie chrétienne</span>
                <ModalDatePicker
                  value={newDisciple.christianLifeStart}
                  onChange={(nextDate) => setNewDisciple((prev) => ({ ...prev, christianLifeStart: nextDate }))}
                  theme={theme}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Eglise</span>
                <input
                  value={newDisciple.church}
                  onChange={(e) => setNewDisciple((prev) => ({ ...prev, church: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Pasteur principal</span>
                <input
                  value={newDisciple.mainPastor}
                  onChange={(e) => setNewDisciple((prev) => ({ ...prev, mainPastor: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
              />
            </label>

            <div
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{
                border: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD",
                backgroundColor: theme === "dark" ? "#0F0E17" : "#F5F3FF"
              }}
            >
              <span className="text-sm" style={labelStyle}>Faiseur de disciple</span>
              <button
                type="button"
                onClick={() => setNewDisciple((prev) => ({ ...prev, discipleMaker: !prev.discipleMaker }))}
                className="relative h-7 w-14 rounded-full transition-colors"
                style={{ backgroundColor: newDisciple.discipleMaker ? "#6C3FE8" : theme === "dark" ? "#2D2A3E" : "#D8D0FF" }}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full transition-all ${
                    newDisciple.discipleMaker ? "left-8" : "left-1"
                  }`}
                  style={{ backgroundColor: "#FFFFFF" }}
                />
              </button>
            </div>

            {error ? <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p> : null}
          </div>

          <div
            className="border-t p-4 sm:p-5 xl:border-l xl:border-t-0"
            style={{
              ...rightColumnStyle,
              borderLeft: undefined,
              borderTop: theme === "dark" ? "1px solid #2D2A3E" : "1px solid #C4B5FD"
            }}
          >
            <h4 className="mb-4 text-base font-semibold" style={{ color: theme === "dark" ? "#F0EEFF" : "#111827" }}>Apercu profil</h4>

            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold"
                style={{
                  backgroundColor: newDisciple.name.trim() ? "#6C3FE8" : theme === "dark" ? "#334155" : "#E2E8F0",
                  color: newDisciple.name.trim() ? "#FFFFFF" : theme === "dark" ? "#E2E8F0" : "#64748B"
                }}
              >
                {getInitials(newDisciple.name)}
              </div>
              <div>
                {newDisciple.name.trim() ? (
                  <p className="text-base font-semibold">{newDisciple.name}</p>
                ) : (
                  <p className="text-base italic" style={{ color: theme === "dark" ? "#94A3B8" : "#4B5563" }}>Nom complet</p>
                )}
                <p className="text-sm" style={{ color: "#6C3FE8" }}>{newDisciple.phoneNumber || ""}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Pays d'origine</span>
                <span>{newDisciple.originCountry ? formatCountryWithFlag(newDisciple.originCountry) : "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Pays actuel</span>
                <span>{newDisciple.currentCountry ? formatCountryWithFlag(newDisciple.currentCountry) : "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Date conversion</span>
                <span>{newDisciple.conversionDate ? formatDateFr(newDisciple.conversionDate) : "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Début vie chrétienne</span>
                <span>{newDisciple.christianLifeStart ? formatDateFr(newDisciple.christianLifeStart) : "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Eglise</span>
                <span>{newDisciple.church || "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Pasteur principal</span>
                <span>{newDisciple.mainPastor || "—"}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Faiseur de disciple</span>
                <span>{newDisciple.discipleMaker ? "Oui" : "Non"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-5" style={footerStyle}>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium sm:w-auto"
            style={{
              backgroundColor: theme === "dark" ? "transparent" : "#F5F3FF",
              border: theme === "dark" ? "1px solid #2D2A3E" : "2px solid #A78BFA",
              color: theme === "dark" ? "#E2E8F0" : "#4C1D95"
            }}
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={!canSave || creating}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium sm:w-auto"
            style={{
              backgroundColor: !canSave || creating ? (theme === "dark" ? "#2D2A3E" : "#C4B5FD") : "#6C3FE8",
              color: "#FFFFFF"
            }}
          >
            {creating ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DisciplesPage({ onLogout }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showSingleCheckinModal, setShowSingleCheckinModal] = useState(false);
  const [selectedDiscipleForCheckin, setSelectedDiscipleForCheckin] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [viewMode, setViewMode] = useState("table");

  const [sortKey, setSortKey] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const searchRef = useRef("");
  const statusFilterRef = useRef("all");
  const countryFilterRef = useRef("all");
  const limit = 50;
  const [pagination, setPagination] = useState({
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false
  });

  const [countries, setCountries] = useState([]);
  const [manualCandidates, setManualCandidates] = useState([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, countryFilter]);

  useEffect(() => {
    pageRef.current = page;
    searchRef.current = search;
    statusFilterRef.current = statusFilter;
    countryFilterRef.current = countryFilter;
  }, [page, search, statusFilter, countryFilter]);

  async function fetchDisciplesAndStats(targetPage = pageRef.current) {
    setLoading(true);
    setError("");

    try {
      const effectiveSearch = searchRef.current;
      const effectiveStatusFilter = statusFilterRef.current;
      const effectiveCountryFilter = countryFilterRef.current;
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(limit));

      if (effectiveSearch) {
        params.set("search", effectiveSearch);
      }

      if (effectiveStatusFilter !== "all") {
        params.set("status", effectiveStatusFilter);
      }

      if (effectiveCountryFilter !== "all") {
        params.set("country", effectiveCountryFilter);
      }

      const [disciplesRes, statsRes] = await Promise.all([
        api.get(`/api/disciples?${params.toString()}`),
        api.get("/api/stats")
      ]);

      setItems(disciplesRes.data.items || []);
      setPagination(
        disciplesRes.data.pagination || {
          page: targetPage,
          limit,
          total: disciplesRes.data.items?.length || 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false
        }
      );
      setStats(statsRes.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    fetchDisciplesAndStats(page);
  }, [page, search, statusFilter, countryFilter, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const disciplesRef = collection(firestore, "pasteurs", user.uid, "disciples");
    const unsubscribe = onSnapshot(
      disciplesRef,
      () => {
        fetchDisciplesAndStats(pageRef.current);
      },
      () => {
        // Erreur temps réel non bloquante
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    async function loadSidebarData() {
      try {
        const res = await api.get("/api/disciples?page=1&limit=200");
        setManualCandidates(res.data.items || []);
        const countryValues = (res.data.items || [])
          .map((item) => item.currentCountry)
          .filter(Boolean);

        setCountries(Array.from(new Set(countryValues)).sort((a, b) => a.localeCompare(b, "fr")));
      } catch {
        setManualCandidates([]);
        setCountries([]);
      }
    }

    loadSidebarData();
  }, []);

  const handleMessagesRead = useCallback(({ discipleId }) => {
    if (!discipleId) {
      return;
    }

    const clearUnread = (entry) => (entry.id === discipleId ? { ...entry, unreadCount: 0 } : entry);

    setItems((prev) => prev.map(clearUnread));
    setManualCandidates((prev) => prev.map(clearUnread));
    setSelectedDiscipleForCheckin((prev) => {
      if (!prev || prev.id !== discipleId) {
        return prev;
      }

      return { ...prev, unreadCount: 0 };
    });
  }, []);

  const sortedItems = useMemo(() => {
    const source = [...items];

    source.sort((a, b) => {
      const aValue = a?.[sortKey] ?? "";
      const bValue = b?.[sortKey] ?? "";

      if (sortKey === "lastContact") {
        const aTime = aValue ? new Date(aValue).getTime() : 0;
        const bTime = bValue ? new Date(bValue).getTime() : 0;
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
      }

      const left = String(aValue).toLowerCase();
      const right = String(bValue).toLowerCase();

      if (left < right) return sortDirection === "asc" ? -1 : 1;
      if (left > right) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return source;
  }, [items, sortKey, sortDirection]);

  function toggleSort(nextKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function handleDelete(id) {
    const disciple = items.find((d) => d.id === id);
    setConfirmDelete({ id, name: disciple?.name || id });
  }

  async function doDelete() {
    const { id } = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.delete(`/api/disciples/${encodeURIComponent(id)}`);
      const nextPage = sortedItems.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      if (nextPage === page) {
        await fetchDisciplesAndStats(nextPage);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const total = pagination.total || 0;
  const from = total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(total, pagination.page * pagination.limit);

  const pageNumbers = useMemo(() => {
    const totalPages = pagination.totalPages || 1;
    const current = pagination.page || 1;

    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);

    const values = [];
    for (let i = start; i <= end; i += 1) {
      values.push(i);
    }
    return values;
  }, [pagination.page, pagination.totalPages]);

  return (
    <Layout title="Disciples" onLogout={onLogout}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:flex xl:flex-wrap">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C3FE8] px-4 py-2 text-sm font-medium text-white xl:w-auto"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus size={16} />
              Ajouter un disciple
            </button>

            <button
              className={`inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-colors xl:w-auto ${
                theme === "dark"
                  ? "border-theme-border bg-transparent text-theme-text2 hover:border-[#6C3FE8] hover:text-theme-text1"
                  : "secondary-accent-button"
              }`}
              onClick={() => setShowManualModal(true)}
            >
              <MessageSquarePlus size={16} />
              Check-in manuel
            </button>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center xl:justify-end">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-theme-border bg-theme-surface py-2 pl-9 pr-3 text-sm text-theme-text1 xl:min-w-[260px]"
                placeholder="Rechercher nom ou numero"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text1 xl:w-auto"
            >
              <option value="all">Tous statuts</option>
              <option value="actif">Actif</option>
              <option value="silencieux">Silencieux</option>
              <option value="onboarding">Onboarding</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text1 xl:w-auto"
            >
              <option value="all">Tous pays</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {formatCountryWithFlag(country)}
                </option>
              ))}
            </select>

            <div
              className={`grid grid-cols-2 overflow-hidden rounded-lg border sm:col-span-2 xl:flex ${
                theme === "dark"
                  ? "border-theme-border bg-theme-surface"
                  : "border-[#B9A6FF] bg-white shadow-[0_2px_8px_rgba(108,63,232,0.10)]"
              }`}
            >
              <button
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-[#6C3FE8] text-white"
                    : theme === "dark"
                      ? "text-theme-text2 hover:bg-theme-bg hover:text-theme-text1"
                      : "bg-white text-[#6C3FE8] hover:bg-[#F5F3FF]"
                }`}
                onClick={() => setViewMode("table")}
              >
                <Table2 size={14} />
                Tableau
              </button>
              <button
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === "cards"
                    ? "bg-[#6C3FE8] text-white"
                    : theme === "dark"
                      ? "text-theme-text2 hover:bg-theme-bg hover:text-theme-text1"
                      : "bg-white text-[#6C3FE8] hover:bg-[#F5F3FF]"
                }`}
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid size={14} />
                Cards
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:flex xl:flex-wrap">
          <div className="secondary-accent-pill inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#6C3FE8]" /> <span className="text-[13px] text-theme-text2">Total</span> <strong className="ml-1 text-[15px] text-theme-text1">{stats?.totalDisciples ?? 0}</strong>
          </div>
          <div className="secondary-accent-pill inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> <span className="text-[13px] text-theme-text2">Actifs</span> <strong className="ml-1 text-[15px] text-theme-text1">{stats?.activeToday ?? 0}</strong>
          </div>
          <div className="secondary-accent-pill inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> <span className="text-[13px] text-theme-text2">Silencieux</span> <strong className="ml-1 text-[15px] text-theme-text1">{stats?.silentOver3Days ?? 0}</strong>
          </div>
          <div className="secondary-accent-pill inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-slate-500" /> <span className="text-[13px] text-theme-text2">Onboarding</span> <strong className="ml-1 text-[15px] text-theme-text1">{Math.max(0, (stats?.totalDisciples ?? 0) - ((stats?.activeToday ?? 0) + (stats?.silentOver3Days ?? 0)) )}</strong>
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {viewMode === "table" ? (
          <section className="shadow-card flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
            {loading ? <p className="px-4 py-6 text-sm text-theme-muted">Chargement...</p> : null}

            {!loading ? (
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead
                    className="border-b border-theme-border text-[12px] uppercase tracking-wide text-theme-text2"
                    style={{ backgroundColor: theme === "dark" ? "#0F0E17" : "#F5F3FF" }}
                  >
                    <tr>
                      <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("name")}>Disciple ↕</th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("currentCountry")}>Pays ↕</th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("church")}>Eglise ↕</th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("status")}>Statut ↕</th>
                      <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("lastContact")}>Dernier contact ↕</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-theme-border">
                    {sortedItems.map((disciple) => (
                      <tr
                        key={disciple.id}
                        className={`group ${theme === "dark" ? "hover:bg-[#0F0E17]/70" : "hover:bg-[#F5F3FF]"}`}
                      >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: getAvatarColor(disciple.name).bg, color: getAvatarColor(disciple.name).text }}>
                              {getInitials(disciple.name)}
                            </div>
                            {disciple.unreadCount > 0 ? (
                              <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                                {disciple.unreadCount > 99 ? "99+" : disciple.unreadCount}
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-theme-text1">{disciple.name || "Inconnu"}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-[12px] text-theme-muted">{disciple.displayPhone || disciple.phoneNumber}</p>
                              <VerificationBadge verificationStatus={disciple.verificationStatus} addedBy={disciple.addedBy} />
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[14px] text-theme-muted">{disciple.currentCountry ? formatCountryWithFlag(disciple.currentCountry) : "—"}</td>
                      <td className="px-4 py-3 text-[14px] text-theme-muted">{disciple.church || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[12px] font-medium ${statusClass(disciple.status, theme === "dark")}`}>
                          {normalizeStatus(disciple.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] text-theme-muted">{formatDateFr(disciple.lastContact)}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#6C3FE8] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#5B33C6]"
                            to={`/disciples/${encodeURIComponent(disciple.id)}`}
                          >
                            <UserRound size={14} />
                            Profil
                          </Link>

                          <button
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#0EA5A4] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0B8E8D]"
                            onClick={() => {
                              setSelectedDiscipleForCheckin(disciple);
                              setShowSingleCheckinModal(true);
                            }}
                          >
                            <MessageSquarePlus size={14} />
                            Check-in
                          </button>

                          <button
                            className="rounded-md border border-[#EF4444] px-2 py-1 text-xs text-[#EF4444] opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => handleDelete(disciple.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!loading && sortedItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-theme-muted">Aucun disciple trouve.</p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-theme-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-theme-muted">
                Affichage {from}–{to} sur {total} disciples
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className={`rounded-md border px-2 py-1 disabled:opacity-40 ${
                    theme === "dark"
                      ? "border-theme-border text-theme-text2"
                      : "secondary-accent-button"
                  }`}
                >
                  ←
                </button>

                {pageNumbers.map((number) => (
                  <button
                    key={number}
                    onClick={() => setPage(number)}
                    className={`rounded-md px-3 py-1 text-sm ${
                      number === pagination.page
                        ? "bg-[#6C3FE8] text-white"
                        : theme === "dark"
                          ? "border border-theme-border text-theme-text2"
                          : "secondary-accent-button border"
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((prev) => prev + 1)}
                  className={`rounded-md border px-2 py-1 disabled:opacity-40 ${
                    theme === "dark"
                      ? "border-theme-border text-theme-text2"
                      : "secondary-accent-button"
                  }`}
                >
                  →
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedItems.map((disciple) => (
              <article key={disciple.id} className="shadow-card flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
                {/* Header */}
                <div className="border-b border-theme-border px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="relative">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: getAvatarColor(disciple.name).bg, color: getAvatarColor(disciple.name).text }}>
                          {getInitials(disciple.name)}
                        </div>
                        {disciple.unreadCount > 0 ? (
                          <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                            {disciple.unreadCount > 99 ? "99+" : disciple.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <p className="text-[15px] font-medium text-theme-text1">{disciple.name || "Inconnu"}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[12px] text-[#6C3FE8]">{disciple.displayPhone || disciple.phoneNumber}</p>
                          <VerificationBadge verificationStatus={disciple.verificationStatus} addedBy={disciple.addedBy} />
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[12px] font-medium flex-shrink-0 ${statusClass(disciple.status, theme === "dark")}`}>
                      {normalizeStatus(disciple.status)}
                    </span>
                  </div>
                </div>

                {/* Body - 2x2 Grid */}
                <div className="flex-1 px-4 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-theme-text2 mb-1">Pays origine</p>
                      <p className="text-[13px] font-semibold text-theme-text1">{disciple.originCountry ? formatCountryWithFlag(disciple.originCountry) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-theme-text2 mb-1">Pays actuel</p>
                      <p className="text-[13px] font-semibold text-theme-text1">{disciple.currentCountry ? formatCountryWithFlag(disciple.currentCountry) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-theme-text2 mb-1">Église</p>
                      <p className="text-[13px] font-semibold text-theme-text1">{disciple.church || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-theme-text2 mb-1">Conversion</p>
                      <p className="text-[13px] font-semibold text-theme-text1">{formatDateFr(disciple.conversionDate) || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-theme-border px-4 py-3">
                  <p className="mb-3 text-[12px] text-theme-muted">Dernier contact: {formatDateFr(disciple.lastContact)}</p>
                  <div className="flex items-stretch gap-2">
                    <Link
                      className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#6C3FE8] px-4 py-2 text-[12px] font-medium text-white"
                      to={`/disciples/${encodeURIComponent(disciple.id)}`}
                    >
                      <UserRound size={14} />
                      Profil
                    </Link>
                    <button
                      className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#6C3FE8] px-4 py-2 text-[12px] font-medium text-white"
                      onClick={() => {
                        setSelectedDiscipleForCheckin(disciple);
                        setShowSingleCheckinModal(true);
                      }}
                    >
                      <MessageSquarePlus size={14} />
                      Check-in
                    </button>
                    <button
                      className="inline-flex h-auto items-center justify-center rounded-lg border border-[#EF4444] px-3 py-2 text-[12px] text-[#EF4444] transition-colors hover:bg-[#EF4444] hover:text-white"
                      onClick={() => handleDelete(disciple.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <AddDiscipleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={async () => {
          setPage(1);
          setSearch("");
          setSearchInput("");
          await fetchDisciplesAndStats(1);
        }}
      />

      <ManualCheckinModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        disciples={manualCandidates.length > 0 ? manualCandidates : items}
      />

      <SingleDiscipleCheckinModal
        isOpen={showSingleCheckinModal}
        onClose={() => {
          setShowSingleCheckinModal(false);
          setSelectedDiscipleForCheckin(null);
        }}
        disciple={selectedDiscipleForCheckin}
        onReadMessages={handleMessagesRead}
      />

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer ce disciple ?"
          message={`Cette action est irréversible. Toutes les données de ${confirmDelete.name} seront supprimées.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Layout>
  );
}

export default DisciplesPage;
