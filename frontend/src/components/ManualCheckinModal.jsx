import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { useTheme } from "../context/ThemeContext";

function normalizeFirstName(name) {
  const text = String(name || "").trim();
  return text ? text.split(/\s+/)[0] : "";
}

function applyTemplate(content, disciple, pastorName) {
  const firstName = normalizeFirstName(disciple?.name);
  const country = String(disciple?.currentCountry || disciple?.originCountry || "").trim();
  const church = String(disciple?.church || "").trim();

  return String(content || "")
    .replace(/\[prénom\]/gi, firstName)
    .replace(/\[prenom\]/gi, firstName)
    .replace(/\[pays\]/gi, country)
    .replace(/\[église\]/gi, church)
    .replace(/\[eglise\]/gi, church)
    .replace(/\[pasteur\]/gi, pastorName || "Pasteur");
}

function ManualCheckinModal({ isOpen, onClose, disciples = [], preselectedDiscipleId }) {
  const { theme } = useTheme();
  const [recipientMode, setRecipientMode] = useState("all");
  const [sendMode, setSendMode] = useState("structured");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [defaultQuestions, setDefaultQuestions] = useState([]);
  const [customQuestions, setCustomQuestions] = useState([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const normalizedDisciples = useMemo(
    () =>
      disciples.map((disciple) => {
        const id = disciple.id || disciple.discipleId;
        return {
          ...disciple,
          id,
          phone: disciple.displayPhone || disciple.phoneNumber || disciple.phone || id || ""
        };
      }),
    [disciples]
  );

  const silentIds = useMemo(() => {
    const now = Date.now();
    return normalizedDisciples
      .filter((disciple) => {
        if (disciple.status === "Silencieux") return true;
        if (!disciple.lastContact) return true;
        const last = new Date(disciple.lastContact);
        if (Number.isNaN(last.getTime())) return false;
        const diffDays = Math.floor((now - last.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 3;
      })
      .map((disciple) => disciple.id);
  }, [normalizedDisciples]);

  const filteredManualList = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return normalizedDisciples;
    return normalizedDisciples.filter((item) => {
      const text = `${item.name || ""} ${item.phone || ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [normalizedDisciples, search]);

  const selectedRecipients = useMemo(() => {
    if (recipientMode === "all") {
      return normalizedDisciples;
    }
    if (recipientMode === "silent") {
      return normalizedDisciples.filter((item) => silentIds.includes(item.id));
    }
    return normalizedDisciples.filter((item) => selectedIds.includes(item.id));
  }, [recipientMode, normalizedDisciples, selectedIds, silentIds]);

  useEffect(() => {
    if (!isOpen) return;

    setError("");
    setSuccess("");
    setSearch("");
    setEditingIndex(null);
    setEditingValue("");

    if (preselectedDiscipleId) {
      setRecipientMode("manual");
      setSelectedIds([preselectedDiscipleId]);
    } else {
      setRecipientMode("all");
      setSelectedIds([]);
    }

    api
      .get("/api/bot/config")
      .then((res) => {
        const questions = Array.isArray(res.data?.checkinQuestions)
          ? res.data.checkinQuestions.map((q) => String(q || "").trim()).filter(Boolean)
          : [];

        const safeQuestions = questions.length > 0
          ? questions
          : [
              "Comment s'est passée ta journée ?",
              "As-tu prié aujourd'hui ?",
              "Un verset ou une pensée du jour ?"
            ];

        setDefaultQuestions(safeQuestions);
        setCustomQuestions(safeQuestions);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [isOpen, preselectedDiscipleId]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 2600);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (!isOpen) return null;

  function startEdit(index) {
    setEditingIndex(index);
    setEditingValue(customQuestions[index] || "");
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const next = editingValue.trim();
    if (!next) {
      setError("Une question ne peut pas être vide.");
      return;
    }

    setCustomQuestions((prev) => prev.map((item, idx) => (idx === editingIndex ? next : item)));
    setEditingIndex(null);
    setEditingValue("");
  }

  function removeQuestion(index) {
    setCustomQuestions((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addQuestion() {
    const nextIndex = customQuestions.length;
    setCustomQuestions((prev) => [...prev, "Nouvelle question"]);
    setEditingIndex(nextIndex);
    setEditingValue("Nouvelle question");
  }

  function resetQuestions() {
    setCustomQuestions(defaultQuestions);
    setEditingIndex(null);
    setEditingValue("");
  }

  function toggleSelection(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function insertVariable(variable) {
    setMessageTemplate((prev) => `${prev}${prev ? " " : ""}${variable}`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const targets = selectedRecipients;
    if (targets.length === 0) {
      setError("Aucun disciple sélectionné.");
      return;
    }

    setSending(true);
    try {
      if (sendMode === "structured") {
        const questions = customQuestions.map((q) => String(q || "").trim()).filter(Boolean);
        if (questions.length === 0) {
          setError("Ajoute au moins une question.");
          setSending(false);
          return;
        }

        const hasChanges = JSON.stringify(questions) !== JSON.stringify(defaultQuestions);
        const results = await Promise.allSettled(
          targets.map((disciple) =>
            api.post(`/api/disciples/${encodeURIComponent(disciple.id)}/checkin/launch`, {
              questions: hasChanges ? questions : undefined
            })
          )
        );

        const sentCount = results.filter((item) => item.status === "fulfilled").length;
        const failedCount = results.length - sentCount;

        if (sentCount > 0) {
          setSuccess(`Message envoyé à ${sentCount} disciples ✓`);
        }
        if (failedCount > 0) {
          setError(`${failedCount} envoi(s) ont échoué.`);
        }
      } else {
        const template = messageTemplate.trim();
        if (!template) {
          setError("Saisis un message.");
          setSending(false);
          return;
        }

        const results = await Promise.allSettled(
          targets.map((disciple) => {
            const personalized = applyTemplate(template, disciple, "Pasteur");
            return api.post(`/api/disciples/${encodeURIComponent(disciple.id)}/conversations`, {
              content: personalized
            });
          })
        );

        const sentCount = results.filter((item) => item.status === "fulfilled").length;
        const failedCount = results.length - sentCount;

        if (sentCount > 0) {
          setSuccess(`Message envoyé à ${sentCount} disciples ✓`);
          setMessageTemplate("");
        }
        if (failedCount > 0) {
          setError(`${failedCount} envoi(s) ont échoué.`);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const previewDisciple = selectedRecipients[0];
  const preview = applyTemplate(messageTemplate, previewDisciple, "Pasteur");

  const panelStyle =
    theme === "dark"
      ? { backgroundColor: "#1A1825", borderColor: "#2D2A3E" }
      : { backgroundColor: "#FFFFFF", borderColor: "#E5E1FF" };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl rounded-xl border p-5 shadow-xl" style={panelStyle}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text1">Check-in manuel</h3>
          <button
            className="rounded-md border border-theme-border px-3 py-1 text-sm text-theme-text2"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
        </div>

        {success ? <p className="mb-3 text-sm text-emerald-500">{success}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-2 rounded-lg border border-theme-border p-3">
            <p className="text-sm font-semibold text-theme-text1">Sélection des destinataires</p>

            <label className="flex items-center gap-2 text-sm text-theme-text1">
              <input
                type="radio"
                checked={recipientMode === "all"}
                onChange={() => setRecipientMode("all")}
              />
              Tous les disciples ({normalizedDisciples.length})
            </label>

            <label className="flex items-center gap-2 text-sm text-theme-text1">
              <input
                type="radio"
                checked={recipientMode === "silent"}
                onChange={() => setRecipientMode("silent")}
              />
              Silencieux uniquement ({silentIds.length})
            </label>

            <label className="flex items-center gap-2 text-sm text-theme-text1">
              <input
                type="radio"
                checked={recipientMode === "manual"}
                onChange={() => setRecipientMode("manual")}
              />
              Sélection manuelle
            </label>

            {recipientMode === "manual" ? (
              <div className="rounded-lg border border-theme-border p-2">
                <div className="relative mb-2">
                  <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-theme-text2" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-theme-border bg-transparent py-1.5 pl-8 pr-2 text-sm text-theme-text1"
                    placeholder="Rechercher un disciple"
                  />
                </div>

                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {filteredManualList.map((disciple) => (
                    <label key={disciple.id} className="flex items-center gap-2 text-sm text-theme-text1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(disciple.id)}
                        onChange={() => toggleSelection(disciple.id)}
                      />
                      <span>{disciple.name || "Inconnu"}</span>
                      <span className="text-xs text-theme-text2">({disciple.phone})</span>
                    </label>
                  ))}
                </div>

                <p className="mt-2 text-xs text-theme-text2">{selectedIds.length} sélectionné(s)</p>
              </div>
            ) : null}
          </section>

          <section className="space-y-2 rounded-lg border border-theme-border p-3">
            <p className="text-sm font-semibold text-theme-text1">Type d'envoi</p>

            <label className="flex items-center gap-2 text-sm text-theme-text1">
              <input
                type="radio"
                checked={sendMode === "structured"}
                onChange={() => setSendMode("structured")}
              />
              Check-in structuré
            </label>

            <label className="flex items-center gap-2 text-sm text-theme-text1">
              <input
                type="radio"
                checked={sendMode === "message"}
                onChange={() => setSendMode("message")}
              />
              Message libre personnalisé
            </label>

            {sendMode === "structured" ? (
              <div className="space-y-3 pt-1">
                <p className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Ces modifications s'appliquent uniquement à cet envoi.
                </p>

                {customQuestions.map((question, index) => (
                  <div key={`${index}-${question}`} className="flex items-center gap-2 rounded-md border border-theme-border px-2 py-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#6C3FE8] text-xs text-white">{index + 1}</span>
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
                        className="flex-1 rounded-md border border-theme-border bg-transparent px-2 py-1 text-sm text-theme-text1"
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
                    <button type="button" onClick={() => removeQuestion(index)} className="text-theme-text2">
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1 rounded-md border border-theme-border px-2 py-1 text-xs text-theme-text1">
                    <Plus size={12} /> Ajouter
                  </button>
                  <button type="button" onClick={resetQuestions} className="inline-flex items-center gap-1 rounded-md border border-theme-border px-2 py-1 text-xs text-theme-text1">
                    <RotateCcw size={12} /> Réinitialiser
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  {["[prénom]", "[pays]", "[église]", "[pasteur]"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => insertVariable(item)}
                      className="rounded-md border border-theme-border px-2 py-1 text-xs text-theme-text1"
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <textarea
                  value={messageTemplate}
                  onChange={(event) => setMessageTemplate(event.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
                  placeholder="Bonjour [prénom] 🙏 Je pense à toi aujourd'hui"
                />

                <p className="text-xs text-theme-text2">Chaque disciple recevra le message avec ses informations personnelles.</p>

                <div className="rounded-md border border-theme-border px-3 py-2 text-sm text-theme-text1">
                  Aperçu: {preview || "-"}
                </div>
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={sending || selectedRecipients.length === 0}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {sending
              ? "Envoi..."
              : sendMode === "structured"
                ? `Lancer le check-in pour ${selectedRecipients.length} disciples`
                : `Envoyer à ${selectedRecipients.length} disciples`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ManualCheckinModal;
