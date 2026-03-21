import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MessageSquarePlus, Timer } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import SingleDiscipleCheckinModal from "../components/SingleDiscipleCheckinModal";
import { useTheme } from "../context/ThemeContext";

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

function getAvatarColor(name) {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

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

function formatDateFr(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

function formatDateFrCompact(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
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

function SuiviPage({ onLogout }) {
  const { theme } = useTheme();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [selectedDiscipleId, setSelectedDiscipleId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [dateMenuClosing, setDateMenuClosing] = useState(false);
  const [focusedDate, setFocusedDate] = useState(() => parseDateKey(new Date().toISOString().slice(0, 10)));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const datePickerRef = useRef(null);
  const calendarPanelRef = useRef(null);
  const closeTimerRef = useRef(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.discipleId === selectedDiscipleId) || null,
    [items, selectedDiscipleId]
  );

  const selectedDisciple = useMemo(() => {
    if (!selectedItem) return null;
    return {
      id: selectedItem.discipleId,
      discipleId: selectedItem.discipleId,
      name: selectedItem.name,
      phoneNumber: selectedItem.phone || selectedItem.discipleId
    };
  }, [selectedItem]);

  const respondedCount = useMemo(
    () => items.filter((item) => item.status === "repondu").length,
    [items]
  );

  const responseRate = useMemo(() => {
    if (!items.length) return 0;
    return Math.round((respondedCount / items.length) * 100);
  }, [respondedCount, items.length]);

  const sevenDayRows = useMemo(() => {
    if (!selectedDiscipleId) return [];
    const map = new Map(history.map((entry) => [entry.id, entry]));
    const rows = [];

    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = toDateKey(day);
      rows.push({
        key,
        label: formatDateFr(key),
        status: map.has(key) ? "repondu" : "pas_repondu"
      });
    }

    return rows;
  }, [history, selectedDiscipleId]);

  async function fetchByDate(targetDate) {
    setLoading(true);
    setError("");

    try {
      const res = await api.get(`/api/checkins?date=${targetDate}`);
      const nextItems = (res.data.items || []).map((item) => ({
        ...item,
        phone: item.phone || item.discipleId
      }));
      setItems(nextItems);

      if (selectedDiscipleId && !nextItems.some((item) => item.discipleId === selectedDiscipleId)) {
        setSelectedDiscipleId("");
        setHistory([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchByDate(date);
  }, [date]);

  async function loadHistory(discipleId) {
    setSelectedDiscipleId(discipleId);
    setHistoryLoading(true);
    setError("");

    try {
      const res = await api.get(`/api/checkins/${encodeURIComponent(discipleId)}`);
      setHistory(res.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  const monthLabel = useMemo(
    () =>
      calendarMonth
        .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        .replace(/^./, (char) => char.toUpperCase()),
    [calendarMonth]
  );

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  function openDateMenu() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDateMenuClosing(false);
    setFocusedDate(parseDateKey(date));
    setDateMenuOpen(true);
  }

  function closeDateMenu() {
    setDateMenuClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setDateMenuOpen(false);
      setDateMenuClosing(false);
      closeTimerRef.current = null;
    }, 140);
  }

  useEffect(() => {
    if (!dateMenuOpen) return;

    function handleOutsideClick(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        closeDateMenu();
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dateMenuOpen]);

  useEffect(() => {
    if (!dateMenuOpen || !calendarPanelRef.current) return;
    requestAnimationFrame(() => {
      calendarPanelRef.current?.focus();
    });
  }, [dateMenuOpen]);

  useEffect(() => {
    if (!dateMenuOpen || !focusedDate) return;
    setCalendarMonth(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1));
  }, [focusedDate, dateMenuOpen]);

  function handleCalendarKeyDown(event) {
    if (!dateMenuOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeDateMenu();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = focusedDate || parseDateKey(date);
      setDate(toDateKey(target));
      closeDateMenu();
      return;
    }

    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const monthOffset = event.key === "PageUp" ? -1 : 1;
      setFocusedDate((prev) => {
        const base = prev ? new Date(prev) : parseDateKey(date);
        return new Date(base.getFullYear(), base.getMonth() + monthOffset, base.getDate());
      });
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setFocusedDate((prev) => {
        const base = prev ? new Date(prev) : parseDateKey(date);
        const dayIndex = (base.getDay() + 6) % 7; // lundi=0 ... dimanche=6
        const target = new Date(base);
        if (event.key === "Home") {
          target.setDate(base.getDate() - dayIndex);
        } else {
          target.setDate(base.getDate() + (6 - dayIndex));
        }
        return target;
      });
      return;
    }

    const keyOffset = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7
    }[event.key];

    if (!keyOffset) return;

    event.preventDefault();
    setFocusedDate((prev) => {
      const base = prev ? new Date(prev) : parseDateKey(date);
      base.setDate(base.getDate() + keyOffset);
      return base;
    });
  }

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, []);

  const panelStyle =
    theme === "dark"
      ? { backgroundColor: "#1A1825", borderColor: "#2D2A3E" }
      : { backgroundColor: "#FFFFFF", borderColor: "#E5E1FF" };

  return (
    <Layout title="Suivi" onLogout={onLogout}>
      <div className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4">
        <section className="rounded-xl border p-4" style={panelStyle}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div ref={datePickerRef} className="relative">
              <button
                type="button"
                className="inline-flex min-w-[220px] items-center justify-between rounded-lg border px-3 py-2 text-sm text-theme-text1"
                style={panelStyle}
                onClick={() => {
                  const selected = parseDateKey(date);
                  setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
                  if (dateMenuOpen) {
                    closeDateMenu();
                  } else {
                    openDateMenu();
                  }
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={15} className="suivi-datepicker-icon" style={{ color: "#A78BFA" }} />
                  {formatDateFrCompact(date)}
                </span>
                <span className="text-theme-text2">▾</span>
              </button>

              {dateMenuOpen ? (
                <div
                  ref={calendarPanelRef}
                  tabIndex={0}
                  onKeyDown={handleCalendarKeyDown}
                  className={`absolute z-20 mt-2 w-[300px] rounded-lg border p-3 shadow-lg origin-top-left ${
                    dateMenuClosing ? "suivi-datepicker-close" : "suivi-datepicker-open"
                  }`}
                  style={panelStyle}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-theme-text2"
                      style={panelStyle}
                      onClick={() =>
                        setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                      }
                    >
                      <ChevronLeft size={14} className="suivi-datepicker-icon" style={{ color: "#A78BFA" }} />
                    </button>
                    <p className="text-sm font-semibold text-theme-text1">{monthLabel}</p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-theme-text2"
                      style={panelStyle}
                      onClick={() =>
                        setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                      }
                    >
                      <ChevronRight size={14} className="suivi-datepicker-icon" style={{ color: "#A78BFA" }} />
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {["L", "M", "M", "J", "V", "S", "D"].map((dayLabel, index) => (
                      <span
                        key={`${dayLabel}-${index}`}
                        className="py-1 text-center text-[11px] font-medium text-theme-text2"
                      >
                        {dayLabel}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const isSelected = day.key === date;
                      const isFocused = focusedDate ? day.key === toDateKey(focusedDate) : false;

                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => {
                            setFocusedDate(parseDateKey(day.key));
                            setDate(day.key);
                            closeDateMenu();
                          }}
                          className={`h-9 rounded-md text-sm transition-colors ${
                            isSelected
                              ? "bg-[#6C3FE8] text-white"
                              : "text-theme-text1 hover:bg-theme-bg"
                          } ${day.inCurrentMonth ? "opacity-100" : "opacity-30"} ${
                            isFocused && !isSelected ? "ring-1 ring-[#6C3FE8]" : ""
                          }`}
                          style={day.isToday && !isSelected ? { border: "1px solid #6C3FE8" } : undefined}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-w-[260px] flex-1">
              <p className="mb-2 text-sm text-theme-text1">
                {respondedCount} ont repondu / {items.length} total ({responseRate}%)
              </p>
              <div
                className="h-[4px] overflow-hidden rounded-[2px]"
                style={{ backgroundColor: theme === "dark" ? "#2D2A3E" : "#E5E1FF" }}
              >
                <div
                  className="suivi-progress-fill h-full rounded-[2px] bg-[#6C3FE8]"
                  style={{ width: `${responseRate}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <section className="grid min-h-0 flex-1 gap-0 overflow-hidden rounded-xl border" style={panelStyle}>
          <div className="grid min-h-0 flex-1 md:grid-cols-[40%_1px_60%]">
            <div className="min-h-0 overflow-hidden p-3">
              <div className="h-full overflow-y-auto rounded-lg border" style={panelStyle}>
                {loading ? <p className="p-4 text-sm text-theme-text2">Chargement...</p> : null}

                {!loading && items.length === 0 ? (
                  <p className="p-4 text-sm text-theme-text2">Aucune donnee pour cette date.</p>
                ) : null}

                {!loading ? (
                  <div className="divide-y divide-theme-border">
                    {items.map((item) => {
                      const selected = selectedDiscipleId === item.discipleId;
                      const avatar = getAvatarColor(item.name);

                      return (
                        <button
                          key={item.discipleId}
                          type="button"
                          onClick={() => loadHistory(item.discipleId)}
                          className={`group relative flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-all duration-200 ${
                            selected
                              ? "suivi-selected-row bg-[#6C3FE8]/10"
                              : "hover:bg-theme-bg/70 hover:translate-x-[1px]"
                          }`}
                          style={{ borderLeft: selected ? "3px solid #6C3FE8" : "3px solid transparent" }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                              style={{ backgroundColor: avatar.bg, color: avatar.text }}
                            >
                              {getInitials(item.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-theme-text1">{item.name}</p>
                              <p className="truncate text-xs text-theme-text2">{item.discipleId}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                item.status === "repondu"
                                  ? "bg-emerald-200 text-emerald-900"
                                  : "bg-red-200 text-red-800"
                              }`}
                            >
                              {item.status === "repondu" ? "Repondu" : "Pas repondu"}
                            </span>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedDiscipleId(item.discipleId);
                                setShowCheckinModal(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-[6px] bg-[#6C3FE8] px-[14px] py-[6px] text-[13px] font-medium text-white opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-[#5a32d4]"
                            >
                              <MessageSquarePlus size={14} />
                              Check-in
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="hidden md:block" style={{ backgroundColor: theme === "dark" ? "#2D2A3E" : "#E5E1FF" }} />

            <div className="min-h-0 overflow-hidden p-3">
              <div
                key={selectedDiscipleId || "empty"}
                className="suivi-fade-in h-full overflow-y-auto rounded-lg border p-4"
                style={panelStyle}
              >
                {!selectedItem ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-center text-theme-text2">
                    Selectionne un disciple pour voir ses reponses
                  </div>
                ) : (
                  <div className="space-y-4">
                    <header className="flex items-center justify-between gap-3 border-b border-theme-border pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold"
                          style={{
                            backgroundColor: getAvatarColor(selectedItem.name).bg,
                            color: getAvatarColor(selectedItem.name).text
                          }}
                        >
                          {getInitials(selectedItem.name)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-theme-text1">{selectedItem.name}</p>
                          <p className="text-xs text-theme-text2">{selectedItem.discipleId}</p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          selectedItem.status === "repondu"
                            ? "bg-emerald-200 text-emerald-900"
                            : "bg-red-200 text-red-800"
                        }`}
                      >
                        {selectedItem.status === "repondu" ? "Repondu" : "Pas repondu"}
                      </span>
                    </header>

                    {selectedItem.status === "repondu" && selectedItem.checkin ? (
                      <section className="space-y-3">
                        <article className="rounded-lg border border-theme-border p-3">
                          <p className="mb-1 text-xs text-theme-text2">Comment s'est passée ta journée ?</p>
                          <p className="text-sm text-theme-text1">{selectedItem.checkin.dayFeeling || "-"}</p>
                        </article>

                        <article className="rounded-lg border border-theme-border p-3">
                          <p className="mb-1 text-xs text-theme-text2">As-tu prie aujourd'hui ?</p>
                          <p className="text-sm text-theme-text1">
                            {typeof selectedItem.checkin.prayed === "boolean" ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                  selectedItem.checkin.prayed
                                    ? "bg-emerald-200 text-emerald-900"
                                    : "bg-red-200 text-red-800"
                                }`}
                              >
                                {selectedItem.checkin.prayed ? "A prie" : "N'a pas prie"}
                              </span>
                            ) : (
                              "-"
                            )}
                          </p>
                        </article>

                        <article className="rounded-lg border border-theme-border p-3">
                          <p className="mb-1 text-xs text-theme-text2">Un verset ou une pensée du jour ?</p>
                          <p className="text-sm text-theme-text1">{selectedItem.checkin.verse || "-"}</p>
                        </article>
                      </section>
                    ) : (
                      <section className="rounded-lg border border-theme-border p-4">
                        <p className="mb-3 text-sm text-theme-text2">Ce disciple n'a pas encore repondu aujourd'hui.</p>
                        <button
                          type="button"
                          onClick={() => setShowCheckinModal(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#6C3FE8] px-4 py-2 text-sm font-medium text-white"
                        >
                          <Timer size={16} />
                          Envoyer un check-in maintenant
                        </button>
                      </section>
                    )}

                    <section className="rounded-lg border border-theme-border p-3">
                      <h4 className="mb-2 text-sm font-semibold text-theme-text1">Historique 7 derniers jours</h4>

                      {historyLoading ? <p className="text-xs text-theme-text2">Chargement historique...</p> : null}

                      <div className="space-y-2">
                        {sevenDayRows.map((row, index) => (
                          <div
                            key={row.key}
                            className="suivi-fade-in flex items-center justify-between rounded-md border border-theme-border px-2 py-2"
                            style={{ animationDelay: `${index * 35}ms` }}
                          >
                            <span className="text-xs text-theme-text2">{row.label}</span>
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                row.status === "repondu"
                                  ? "bg-emerald-200 text-emerald-900"
                                  : "bg-red-200 text-red-800"
                              }`}
                            >
                              {row.status === "repondu" ? "Repondu" : "Pas repondu"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <SingleDiscipleCheckinModal
        isOpen={showCheckinModal}
        onClose={() => setShowCheckinModal(false)}
        disciple={selectedDisciple}
      />
    </Layout>
  );
}

export default SuiviPage;
