import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageSquare, Plus, RotateCcw, X } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import ConversationPane from "./ConversationPane";
import { useTheme } from "../context/ThemeContext";

const avatarColors = [
  { bg: "#4F46E5", text: "#FFFFFF" },
  { bg: "#0F766E", text: "#FFFFFF" },
  { bg: "#B45309", text: "#FFFFFF" },
  { bg: "#BE185D", text: "#FFFFFF" },
  { bg: "#7C3AED", text: "#FFFFFF" },
  { bg: "#047857", text: "#FFFFFF" },
  { bg: "#B91C1C", text: "#FFFFFF" },
  { bg: "#1D4ED8", text: "#FFFFFF" }
];

function getAvatarColor(name) {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

function getInitials(name) {
  if (!name) return "?";
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getStatusBadge(status, theme) {
  if (status === "Actif") {
    return {
      className: "bg-emerald-500/20 text-emerald-400",
      label: "Actif"
    };
  }

  if (status === "Silencieux") {
    return {
      className: "bg-red-500/20 text-red-400",
      label: "Silencieux"
    };
  }

  if (theme === "dark") {
    return {
      className: "bg-slate-500/20 text-slate-300",
      label: "Onboarding"
    };
  }

  return {
    className: "bg-slate-100 text-slate-600",
    label: "Onboarding"
  };
}

function SingleDiscipleCheckinModal({ isOpen, onClose, disciple, onReadMessages }) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("structured");
  const [launching, setLaunching] = useState(false);
  const [botQuestions, setBotQuestions] = useState([]);
  const [customQuestions, setCustomQuestions] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setActiveTab("structured");
    setError("");
    setSuccess("");
    setEditingIndex(null);
    setEditingValue("");

    api
      .get("/api/bot/config")
      .then((res) => {
        const defaults = Array.isArray(res.data?.checkinQuestions)
          ? res.data.checkinQuestions.map((item) => String(item || "").trim()).filter(Boolean)
          : [];

        const safeDefaults = defaults.length > 0
          ? defaults
          : [
              "Comment s'est passée ta journée ?",
              "As-tu prié aujourd'hui ?",
              "Un verset ou une pensée du jour ?"
            ];

        setBotQuestions(safeDefaults);
        setCustomQuestions(safeDefaults);
      })
      .catch((err) => {
        setError(getErrorMessage(err));
      });
  }, [isOpen, disciple?.id]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const alreadyActiveToday = Boolean(disciple?.activeCheckin?.active && disciple?.activeCheckin?.date === todayKey);

  if (!isOpen || !disciple) {
    return null;
  }

  const firstName = String(disciple.name || "ce disciple").trim().split(/\s+/)[0];
  const avatar = getAvatarColor(disciple.name);
  const statusBadge = getStatusBadge(disciple.status, theme);

  function startEdit(index) {
    setEditingIndex(index);
    setEditingValue(customQuestions[index] || "");
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const value = editingValue.trim();
    if (!value) {
      setError("Une question ne peut pas être vide.");
      return;
    }

    setCustomQuestions((prev) => prev.map((item, idx) => (idx === editingIndex ? value : item)));
    setEditingIndex(null);
    setEditingValue("");
  }

  function removeQuestion(index) {
    setCustomQuestions((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addQuestion() {
    setCustomQuestions((prev) => [...prev, "Nouvelle question"]);
    setEditingIndex(customQuestions.length);
    setEditingValue("Nouvelle question");
  }

  function resetQuestions() {
    setCustomQuestions(botQuestions);
    setEditingIndex(null);
    setEditingValue("");
  }

  async function handleLaunch(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const sanitized = customQuestions.map((item) => String(item || "").trim()).filter(Boolean);
    if (sanitized.length === 0) {
      setError("Ajoute au moins une question.");
      return;
    }

    setLaunching(true);
    try {
      const hasChanges = JSON.stringify(sanitized) !== JSON.stringify(botQuestions);
      await api.post(`/api/disciples/${encodeURIComponent(disciple.id || disciple.discipleId)}/checkin/launch`, {
        questions: hasChanges ? sanitized : undefined
      });
      setSuccess("Check-in lancé ✓");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLaunching(false);
    }
  }

  const panelStyle =
    theme === "dark"
      ? { backgroundColor: "#1A1825", borderColor: "#2D2A3E" }
      : { backgroundColor: "#FFFFFF", borderColor: "#C4B5FD" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-[680px] overflow-hidden rounded-2xl border shadow-xl" style={panelStyle}>
        <div className="flex items-center justify-between border-b border-theme-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: avatar.bg, color: avatar.text }}
            >
              {getInitials(disciple.name)}
            </div>

            <div>
              <p className="text-[15px] font-semibold text-theme-text1">{disciple.name || "Inconnu"}</p>
              <p className="text-[12px] text-[#6C3FE8]">{disciple.displayPhone || disciple.phoneNumber || disciple.id}</p>
            </div>

            <span className={`ml-1 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>

          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-theme-text2 hover:bg-theme-bg"
            onClick={onClose}
            type="button"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-theme-border p-1">
            <button
              type="button"
              onClick={() => setActiveTab("structured")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === "structured" ? "bg-[#6C3FE8] text-white" : "bg-transparent text-theme-text2"
              }`}
            >
              Check-in structuré
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("conversation")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === "conversation" ? "bg-[#6C3FE8] text-white" : "bg-transparent text-theme-text2"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1">
                <MessageSquare size={14} /> Conversation
              </span>
            </button>
          </div>

          {activeTab === "structured" ? (
            <form onSubmit={handleLaunch} className="space-y-4">
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={
                  theme === "dark"
                    ? { backgroundColor: "#2D2A1A", borderLeft: "3px solid #F59E0B", color: "#F59E0B" }
                    : { backgroundColor: "#FEF9EE", borderLeft: "3px solid #F59E0B", color: "#92400E" }
                }
              >
                <p className="inline-flex items-center gap-1 whitespace-nowrap font-medium">
                  <AlertTriangle size={13} />
                  Ces modifications s'appliquent uniquement à ce check-in. Les questions par défaut restent inchangées.
                </p>
              </div>

              <div className="space-y-2">
                {customQuestions.map((question, index) => (
                  <div
                    key={`${index}-${question}`}
                    className={`group flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      theme === "dark" ? "border-[#2D2A3E] bg-[#141320]" : "border-[#E8E2FF] bg-[#FAF8FF]"
                    }`}
                  >
                    <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#6C3FE8] text-xs font-semibold text-white">
                      {index + 1}
                    </span>

                    {editingIndex === index ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitEdit();
                          }
                        }}
                        className="flex-1 rounded-md border border-theme-border bg-transparent px-2 py-1 text-sm text-theme-text1 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(index)}
                        className="flex-1 text-left text-sm text-theme-text1"
                      >
                        {question}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-theme-text2 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#6C3FE8] px-3 py-1.5 text-xs font-medium text-[#6C3FE8]"
                >
                  <Plus size={13} /> Ajouter une question
                </button>

                <button
                  type="button"
                  onClick={resetQuestions}
                  className="inline-flex items-center gap-1 rounded-lg bg-transparent px-2 py-1.5 text-xs text-theme-text2"
                >
                  <RotateCcw size={13} /> Réinitialiser
                </button>
              </div>

              {alreadyActiveToday ? (
                <p className="text-sm text-amber-500">Check-in déjà lancé aujourd'hui.</p>
              ) : null}

              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-500">{success}</p> : null}

              <button
                disabled={launching || alreadyActiveToday || customQuestions.length === 0}
                className="w-full rounded-lg bg-[#6C3FE8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                type="submit"
              >
                {launching ? "Lancement..." : `Lancer le check-in avec ${firstName}`}
              </button>
            </form>
          ) : (
            <div className="h-[520px]">
              <ConversationPane
                disciple={disciple}
                showHeader={false}
                className="h-full"
                onReadMessages={onReadMessages}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SingleDiscipleCheckinModal;
