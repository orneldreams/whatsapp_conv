import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock3, Eye, GripVertical, PlusCircle, Save, Smartphone } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
import Layout from "../components/Layout";
import PhoneInput from "../components/PhoneInput";
import { useTheme } from "../context/ThemeContext";

function normalizeQuestionAccents(text) {
  if (typeof text !== "string") return text;

  return text
    .replace(/\bchretien\b/gi, "chrétien")
    .replace(/\bpriere\b/gi, "prière")
    .replace(/\bjournee\b/gi, "journée")
    .replace(/\bpassee\b/gi, "passée")
    .replace(/\bpensee\b/gi, "pensée");
}

function normalizeQuestionsList(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map((question) => normalizeQuestionAccents(question));
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-emerald-600" : "bg-red-600";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-lg ${bgColor} px-4 py-3 text-sm text-white shadow-lg`}
    >
      {message}
    </div>
  );
}

function HourDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="secondary-accent-control flex w-full items-center justify-between rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
      >
        <span>{String(value).padStart(2, "0")}h</span>
        <span className="text-theme-text2">▾</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-theme-border bg-theme-surface p-1 shadow-lg">
          {Array.from({ length: 24 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(i);
                setOpen(false);
              }}
              className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                value === i
                  ? "bg-[#6C3FE8]/15 text-theme-text1"
                  : "text-theme-text2 hover:bg-theme-bg"
              }`}
            >
              {String(i).padStart(2, "0")}h
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MinuteDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const options = [0, 15, 30, 45];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="secondary-accent-control flex w-full items-center justify-between rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
      >
        <span>{String(value).padStart(2, "0")}</span>
        <span className="text-theme-text2">▾</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-theme-border bg-theme-surface p-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                value === option
                  ? "bg-[#6C3FE8]/15 text-theme-text1"
                  : "text-theme-text2 hover:bg-theme-bg"
              }`}
            >
              {String(option).padStart(2, "0")}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortableQuestionRow({ rowId, question, index, onUpdate, onDelete, totalCount }) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(question);

  useEffect(() => {
    setText(question);
  }, [question]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowId
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group mb-2 flex items-center gap-2 rounded-lg border border-theme-border bg-theme-bg px-3 py-3"
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6C3FE8] text-[10px] font-semibold text-white">
        {index + 1}
      </div>

      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-theme-text2"
        aria-label={`Drag question ${index + 1}`}
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={text}
            onChange={(e) => {
              const nextValue = e.target.value;
              setText(nextValue);
              onUpdate(index, nextValue);
            }}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsEditing(false);
              }
            }}
            className="w-full rounded-lg border border-[#6C3FE8] bg-transparent px-2 py-1 text-sm text-theme-text1 outline-none"
          />
        ) : (
          <p
            onClick={() => setIsEditing(true)}
            className="cursor-text truncate text-sm text-theme-text1 hover:text-[#6C3FE8]"
          >
            {question}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(index, totalCount)}
        className={`rounded-md border px-2 py-1 text-[12px] bg-transparent transition-all opacity-0 group-hover:opacity-100 hover:border-[#EF4444] hover:text-[#EF4444] ${
          theme === "dark" ? "text-[#9CA3AF]" : "text-[#4B5563]"
        }`}
        style={{ borderWidth: "0.5px", borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}
      >
        ✕
      </button>
    </div>
  );
}

function QuestionsColumn({ title, icon, questions, onChange, onDelete }) {
  const { theme } = useTheme();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const isEmpty = questions.length === 0;
  const isFull = questions.length >= 5;
  const maxReached = isFull ? "Maximum 5 questions atteint" : null;
  const questionIds = questions.map((_, index) => `q-${index}`);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = Number(String(active.id).replace("q-", ""));
    const newIndex = Number(String(over.id).replace("q-", ""));
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(questions, oldIndex, newIndex));
  }

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-[12px] border p-4 ${
        theme === "dark"
          ? "border-[#2D2A3E] bg-[#1A1825]"
          : "border-[#C4B5FD] bg-white shadow-[0_2px_8px_rgba(108,63,232,0.10)]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-theme-text1">
          {icon}
          {title}
        </h3>
        <span className="inline-flex items-center rounded-full bg-[#6C3FE8]/20 px-2 py-1 text-xs font-medium text-[#6C3FE8]">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isEmpty && (
        <div className="mb-4 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          ⚠ Le bot ne fonctionnera pas sans questions
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {questions.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={questionIds}
              strategy={verticalListSortingStrategy}
            >
              {questions.map((question, index) => (
                <SortableQuestionRow
                  key={`question-row-${index}`}
                  rowId={`q-${index}`}
                  question={question}
                  index={index}
                  onUpdate={(idx, newText) => {
                    const next = [...questions];
                    next[idx] = normalizeQuestionAccents(newText);
                    onChange(next);
                  }}
                  onDelete={onDelete}
                  totalCount={questions.length}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onChange([...questions, ""])}
        disabled={isFull}
        title={maxReached}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-sm font-medium transition-colors ${
          isFull
            ? `${theme === "dark" ? "border-[#2D2A3E] text-[#9CA3AF]" : "border-[#C4B5FD] text-[#4B5563]"} cursor-not-allowed opacity-60`
            : "border-[#6C3FE8] text-[#6C3FE8] hover:bg-[#6C3FE8]/10"
        }`}
        style={{ borderRadius: "8px" }}
      >
        <PlusCircle size={16} />
        Ajouter une question
      </button>
    </section>
  );
}

function BotPage({ onLogout }) {
  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <BotPageContent onLogout={onLogout} />
    </>
  );
}

function BotPageContent({ onLogout }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [previewMode, setPreviewMode] = useState("onboarding");
  const [form, setForm] = useState({
    onboardingQuestions: [],
    checkinQuestions: [],
    checkinHour: 20,
    checkinMinute: 0,
    pastorPhone: ""
  });

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      setError("");

      try {
        const res = await api.get("/api/bot/config");
        setForm({
          onboardingQuestions: normalizeQuestionsList(res.data.onboardingQuestions || []),
          checkinQuestions: normalizeQuestionsList(res.data.checkinQuestions || []),
          checkinHour: Number(res.data.checkinHour || 20),
          checkinMinute: Number(res.data.checkinMinute || 0),
          pastorPhone: (res.data.pastorPhone || "").replace(/^whatsapp:/i, "")
        });
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  function validatePhone(phone) {
    return phone.trim() === "" || phone.startsWith("+");
  }

  function withWhatsappPrefix(phone) {
    if (!phone.trim()) return "";
    return `whatsapp:${phone.replace(/^whatsapp:/i, "")}`;
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    if (!validatePhone(form.pastorPhone)) {
      setToast({ type: "error", message: "Le numéro doit commencer par +" });
      setSaving(false);
      return;
    }

    try {
      await api.put("/api/bot/config", {
        ...form,
        onboardingQuestions: normalizeQuestionsList(form.onboardingQuestions),
        checkinQuestions: normalizeQuestionsList(form.checkinQuestions),
        pastorPhone: withWhatsappPrefix(form.pastorPhone)
      });
      setToast({ type: "success", message: "✓ Paramètres sauvegardés" });
    } catch (err) {
      setToast({ type: "error", message: "Erreur lors de la sauvegarde" });
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteQuestion(questionIndex, section, totalCount) {
    if (totalCount === 1) {
      setConfirmDelete({
        section,
        index: questionIndex,
        title: "Supprimer cette question ?",
        message: `Sans questions, l'${section === "onboardingQuestions" ? "onboarding" : "envoi des check-ins"} ne fonctionnera plus. Confirmer ?`
      });
    } else {
      const next = form[section].filter((_, i) => i !== questionIndex);
      setForm((prev) => ({ ...prev, [section]: next }));
    }
  }

  const previewQuestions =
    previewMode === "onboarding" ? form.onboardingQuestions : form.checkinQuestions;

  return (
    <Layout title="Bot" onLogout={onLogout}>
      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
      {toast ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}

      {!loading ? (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1fr_1fr_0.85fr] xl:min-h-[calc(100vh-8.5rem)]">
          {/* Gauche : Questions onboarding */}
          <QuestionsColumn
            title="Questions d'onboarding"
            icon={<Smartphone size={17} className="text-[#6C3FE8]" />}
            questions={form.onboardingQuestions}
            onChange={(questions) =>
              setForm((prev) => ({ ...prev, onboardingQuestions: questions }))
            }
            onDelete={(idx, total) =>
              handleDeleteQuestion(idx, "onboardingQuestions", total)
            }
          />

          {/* Milieu : Questions check-in */}
          <QuestionsColumn
            title="Questions check-in quotidien"
            icon={<Clock3 size={17} className="text-[#6C3FE8]" />}
            questions={form.checkinQuestions}
            onChange={(questions) =>
              setForm((prev) => ({ ...prev, checkinQuestions: questions }))
            }
            onDelete={(idx, total) =>
              handleDeleteQuestion(idx, "checkinQuestions", total)
            }
          />

          {/* Droite : Paramètres */}
          <section
            className={`flex flex-col rounded-[12px] border p-4 ${
              theme === "dark"
                ? "border-[#2D2A3E] bg-[#1A1825]"
                : "border-[#C4B5FD] bg-white shadow-[0_2px_8px_rgba(108,63,232,0.10)]"
            }`}
          >
            {/* Heure d'envoi */}
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-theme-text1">
                <Clock3 size={16} className="text-[#6C3FE8]" />
                Heure du check-in quotidien
              </h3>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="mb-2 block text-xs text-theme-text2">Heure</label>
                  <HourDropdown
                    value={form.checkinHour}
                    onChange={(hour) =>
                      setForm((prev) => ({ ...prev, checkinHour: hour }))
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-xs text-theme-text2">Minutes</label>
                  <MinuteDropdown
                    value={form.checkinMinute}
                    onChange={(minute) =>
                      setForm((prev) => ({ ...prev, checkinMinute: minute }))
                    }
                  />
                </div>
              </div>
                <p className="text-xs text-theme-muted">
                Le check-in sera envoyé à{" "}
                <span className="font-semibold text-theme-text1">
                  {String(form.checkinHour).padStart(2, "0")}h
                  {String(form.checkinMinute).padStart(2, "0")}
                </span>{" "}
                chaque soir
              </p>
            </div>

            <div className={`mb-6 border-t ${theme === "dark" ? "border-[#2D2A3E]" : "border-[#C4B5FD]"}`} />

            {/* Numéro pasteur */}
            <div className="mb-6">
              <label className="block text-sm">
                <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-theme-text1">
                  <Smartphone size={14} className="text-[#6C3FE8]" />
                  Numéro WhatsApp (résumé hebdo)
                </span>
                <PhoneInput
                  value={form.pastorPhone}
                  onChange={(nextPhone) =>
                    setForm((prev) => ({ ...prev, pastorPhone: nextPhone }))
                  }
                  theme={theme}
                  placeholder="+237 6XX XXX XXX"
                />
                {form.pastorPhone && !validatePhone(form.pastorPhone) && (
                  <p className="mt-1 text-xs text-[#EF4444]">
                    Le numéro doit commencer par +
                  </p>
                )}
              </label>
            </div>

            {/* Bouton sauvegarder */}
            <button
              onClick={handleSave}
              disabled={saving || !validatePhone(form.pastorPhone)}
              className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C3FE8] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>

            <div className={`mb-4 border-t ${theme === "dark" ? "border-[#2D2A3E]" : "border-[#C4B5FD]"}`} />

            {/* Prévisualisation WhatsApp */}
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-theme-text2">
                <Eye size={14} className="text-[#6C3FE8]" />
                Aperçu sur WhatsApp
              </h4>
              <div className={`mb-3 inline-flex rounded-lg border bg-theme-bg p-1 text-xs ${theme === "dark" ? "border-[#2D2A3E]" : "border-[#C4B5FD]"}`}>
                <button
                  type="button"
                  onClick={() => setPreviewMode("onboarding")}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    previewMode === "onboarding"
                      ? "bg-[#6C3FE8] text-white"
                      : "text-theme-text2 hover:text-theme-text1"
                  }`}
                >
                  Onboarding
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("checkin")}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    previewMode === "checkin"
                      ? "bg-[#6C3FE8] text-white"
                      : "text-theme-text2 hover:text-theme-text1"
                  }`}
                >
                  Check-in
                </button>
              </div>
              <div className="rounded-lg bg-theme-bg p-3 space-y-2">
                {previewQuestions.length > 0 ? previewQuestions.slice(0, 3).map((q, idx) => (
                  <div
                    key={`${previewMode}-${idx}`}
                    style={{
                      animation: `fadeInUp 0.35s ease-out ${idx * 120}ms both`
                    }}
                    className="transition-all duration-300"
                  >
                    <div className="inline-block max-w-xs rounded-[12px] bg-[#25D366] px-3 py-2 text-sm text-white break-words">
                      {q ? q : <span className="text-gray-200 italic">(question vide)</span>}
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-theme-muted">
                    Aucune question {previewMode === "onboarding" ? "d'onboarding" : "de check-in"}
                  </p>
                )}
                <p className="mt-3 text-[11px] text-theme-muted">
                  Voici comment vos disciples verront les questions
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <p className="text-theme-muted">Chargement...</p>
      )}

      {confirmDelete ? (
        <ConfirmModal
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => {
            const next = form[confirmDelete.section].filter(
              (_, i) => i !== confirmDelete.index
            );
            setForm((prev) => ({
              ...prev,
              [confirmDelete.section]: next
            }));
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </Layout>
  );
}

export default BotPage;
