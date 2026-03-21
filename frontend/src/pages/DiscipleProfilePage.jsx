import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Flame, History, NotebookPen, Pencil, Trash2, UserRoundCheck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { getErrorMessage } from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
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

function getInitials(name) {
  if (!name) {
    return "?";
  }

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
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR");
}

function displayReadValue(value) {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-theme-text2/70">—</span>;
  }

  return <span>{String(value)}</span>;
}

function capitalizeFirstLetter(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderDynamicFieldValue(fieldType, value, fieldUnit) {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-theme-text2/70">—</span>;
  }

  if (fieldType === "date") {
    return <span>{formatDateFr(value)}</span>;
  }

  if (fieldType === "boolean") {
    return <span>{value === true ? "Oui" : value === false ? "Non" : "—"}</span>;
  }

  if (fieldType === "number") {
    return (
      <span>
        {value}{fieldUnit ? ` ${fieldUnit}` : ""}
      </span>
    );
  }

  if (fieldType === "phone") {
    return (
      <a href={`tel:${value}`} className="text-[#6C3FE8] hover:underline">
        {value}
      </a>
    );
  }

  if (fieldType === "url") {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#6C3FE8] hover:underline">
        {value}
      </a>
    );
  }

  if (fieldType === "longtext") {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }

  return <span>{String(value)}</span>;
}

function formatDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusBadge(status) {
  if (status === "Actif") {
    return "bg-emerald-200 text-emerald-900";
  }

  if (status === "Silencieux") {
    return "bg-red-200 text-red-800";
  }

  return "bg-slate-300 text-slate-700";
}

function normalizeStatus(status) {
  if (status === "Onboarding en cours") {
    return "Onboarding";
  }

  return status || "Onboarding";
}

function EditProfileModal({ isOpen, onClose, initialData, dynamicFields, onSave, saving, theme }) {
  const [form, setForm] = useState(null);

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

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setForm({
      name: initialData.name || "",
      phoneNumber: initialData.phoneNumber || initialData.phone || "",
      originCountry: initialData.originCountry || "",
      currentCountry: initialData.currentCountry || "",
      conversionDate: initialData.conversionDate || "",
      christianLifeStart: initialData.christianLifeStart || "",
      church: initialData.church || "",
      mainPastor: initialData.mainPastor || "",
      discipleMaker: Boolean(initialData.discipleMaker),
      customFields: initialData.customFields || {}
    });
  }, [initialData, isOpen]);

  if (!isOpen || !form) {
    return null;
  }

  const canSave = form.name.trim() && form.phoneNumber.trim();

  function renderDynamicInput(field) {
    const value = form.customFields?.[field.key] ?? "";

    if (field.type === "boolean") {
      return (
        <select
          value={String(value)}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              customFields: {
                ...prev.customFields,
                [field.key]: event.target.value === "true"
              }
            }))
          }
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">Selectionner...</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      );
    }

    if (field.type === "select") {
      return (
        <select
          value={value}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              customFields: {
                ...prev.customFields,
                [field.key]: event.target.value
              }
            }))
          }
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        >
          <option value="">Selectionner...</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "number") {
      return (
        <div>
          <input
            type="number"
            value={value}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                customFields: {
                  ...prev.customFields,
                  [field.key]: event.target.value
                }
              }))
            }
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
          {field.unit && (
            <p className="mt-1 text-xs" style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>
              {field.unit}
            </p>
          )}
        </div>
      );
    }

    if (field.type === "phone") {
      return (
        <input
          type="tel"
          value={value}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              customFields: {
                ...prev.customFields,
                [field.key]: event.target.value
              }
            }))
          }
          placeholder="+XXX..."
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      );
    }

    if (field.type === "url") {
      return (
        <input
          type="url"
          value={value}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              customFields: {
                ...prev.customFields,
                [field.key]: event.target.value
              }
            }))
          }
          placeholder="https://..."
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      );
    }

    if (field.type === "longtext") {
      return (
        <textarea
          value={value}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              customFields: {
                ...prev.customFields,
                [field.key]: event.target.value
              }
            }))
          }
          rows="4"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      );
    }

    return (
      <input
        type={field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            customFields: {
              ...prev.customFields,
              [field.key]: event.target.value
            }
          }))
        }
        className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${field.type === "date" ? "custom-date-input" : ""}`}
        style={inputStyle}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center px-4 py-6"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
        className="w-full max-w-6xl overflow-hidden rounded-2xl border"
        style={{
          ...modalStyle,
          borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD",
          color: theme === "dark" ? "#F0EEFF" : "#111827"
        }}
      >
        <div className="grid lg:grid-cols-2">
          <div
            className="space-y-4 p-5"
            style={{ backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF", color: theme === "dark" ? "#F0EEFF" : "#111827" }}
          >
            <h3 className="text-lg font-semibold" style={{ color: theme === "dark" ? "#F0EEFF" : "#111827" }}>Modifier le profil</h3>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Nom complet *</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: capitalizeFirstLetter(event.target.value) }))
                }
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
                required
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Numéro WhatsApp *</span>
              <input
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))
                }
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
                placeholder="+237 6XX XXX XXX"
                required
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Pays d'origine</span>
                <input
                  value={form.originCountry}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, originCountry: capitalizeFirstLetter(event.target.value) }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Pays actuel</span>
                <input
                  value={form.currentCountry}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, currentCountry: capitalizeFirstLetter(event.target.value) }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Date de conversion</span>
                <input
                  type="date"
                  value={form.conversionDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, conversionDate: event.target.value }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block" style={labelStyle}>Début vie chrétienne</span>
                <input
                  type="date"
                  value={form.christianLifeStart}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, christianLifeStart: event.target.value }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Eglise</span>
              <input
                value={form.church}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, church: capitalizeFirstLetter(event.target.value) }))
                }
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block" style={labelStyle}>Pasteur principal</span>
              <input
                value={form.mainPastor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, mainPastor: capitalizeFirstLetter(event.target.value) }))
                }
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
                onClick={() => setForm((prev) => ({ ...prev, discipleMaker: !prev.discipleMaker }))}
                className="relative h-7 w-14 rounded-full transition-colors"
                style={{ backgroundColor: form.discipleMaker ? "#6C3FE8" : theme === "dark" ? "#2D2A3E" : "#D8D0FF" }}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full transition-all ${
                    form.discipleMaker ? "left-8" : "left-1"
                  }`}
                  style={{ backgroundColor: "#FFFFFF" }}
                />
              </button>
            </div>

            {dynamicFields.length > 0 ? (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide" style={labelStyle}>Champs dynamiques</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {dynamicFields.map((field) => (
                    <label key={field.key} className="block text-sm">
                      <span className="mb-1 block" style={labelStyle}>{field.label}</span>
                      {renderDynamicInput(field)}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="border-l p-5"
            style={{
              borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD",
              backgroundColor: theme === "dark" ? "#0F0E17" : "#F5F3FF",
              color: theme === "dark" ? "#F0EEFF" : "#111827"
            }}
          >
            <h4 className="mb-4 text-base font-semibold" style={{ color: theme === "dark" ? "#F0EEFF" : "#111827" }}>Aperçu profil</h4>

            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold"
                style={{
                  backgroundColor: form.name.trim() ? getAvatarColor(form.name).bg : "#334155",
                  color: form.name.trim() ? getAvatarColor(form.name).text : "#e2e8f0"
                }}
              >
                {getInitials(form.name)}
              </div>
              <div>
                {form.name.trim() ? (
                  <p className="text-base font-semibold">{form.name}</p>
                ) : (
                  <p className="text-base italic" style={{ color: theme === "dark" ? "#94A3B8" : "#4B5563" }}>Nom complet</p>
                )}
                <p className="text-sm" style={{ color: "#6C3FE8" }}>{form.phoneNumber || ""}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Pays d'origine</span>
                {displayReadValue(form.originCountry)}
              </div>
              <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Pays actuel</span>
                {displayReadValue(form.currentCountry)}
              </div>
              <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Date conversion</span>
                {displayReadValue(formatDateFr(form.conversionDate))}
              </div>
              <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Début vie chrétienne</span>
                {displayReadValue(formatDateFr(form.christianLifeStart))}
              </div>
              <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Eglise</span>
                {displayReadValue(form.church)}
              </div>
              <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD" }}>
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Pasteur principal</span>
                {displayReadValue(form.mainPastor)}
              </div>
              <div className="flex justify-between gap-3">
                <span style={{ color: theme === "dark" ? "#9CA3AF" : "#3730A3" }}>Faiseur de disciple</span>
                <span>{form.discipleMaker ? "Oui" : "Non"}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex justify-end gap-2 border-t px-5 py-4"
          style={{
            borderColor: theme === "dark" ? "#2D2A3E" : "#C4B5FD",
            backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
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
            disabled={!canSave || saving}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: !canSave || saving ? (theme === "dark" ? "#9CA3AF" : "#C4B5FD") : "#6C3FE8",
              color: "#FFFFFF"
            }}
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DiscipleProfilePage({ onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [disciple, setDisciple] = useState(null);
  const [fields, setFields] = useState([]);
  const [allCheckins, setAllCheckins] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pastorNote, setPastorNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");

      try {
        const [discipleRes, fieldsRes, checkinsRes] = await Promise.all([
          api.get(`/api/disciples/${encodeURIComponent(id)}`),
          api.get("/api/config/fields"),
          api.get(`/api/checkins/${encodeURIComponent(id)}`)
        ]);

        setDisciple(discipleRes.data);
        setFields(fieldsRes.data.items || []);
        setAllCheckins(checkinsRes.data.items || []);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const dynamicFields = useMemo(() => fields, [fields]);

  async function refreshData() {
    setLoading(true);
    setError("");

    try {
      const [discipleRes, fieldsRes, checkinsRes] = await Promise.all([
        api.get(`/api/disciples/${encodeURIComponent(id)}`),
        api.get("/api/config/fields"),
        api.get(`/api/checkins/${encodeURIComponent(id)}`)
      ]);

      setDisciple(discipleRes.data);
      setFields(fieldsRes.data.items || []);
      setAllCheckins(checkinsRes.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const latestCheckins = useMemo(() => allCheckins.slice(0, 5), [allCheckins]);

  const progressionStats = useMemo(() => {
    const totalCheckins = allCheckins.length;
    const prayedDays = allCheckins.filter((item) => item.prayed === true).length;
    const prayerRate = totalCheckins ? Math.round((prayedDays / totalCheckins) * 100) : 0;
    const lastActivity = allCheckins[0]?.id ? formatDateFr(allCheckins[0].id) : "—";

    const byDate = new Map(allCheckins.map((item) => [item.id, item]));
    const sevenDays = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);

      const key = formatDateKey(day);
      const hit = byDate.get(key);
      const status = hit?.prayed === true ? "prayed" : hit?.prayed === false ? "not_prayed" : "absent";

      sevenDays.push({
        key,
        label: String(day.getDate()).padStart(2, "0"),
        status,
        value: status === "prayed" ? 100 : status === "not_prayed" ? 65 : 35
      });
    }

    return {
      totalCheckins,
      prayerRate,
      lastActivity,
      sevenDays
    };
  }, [allCheckins]);

  const streak = useMemo(() => {
    if (allCheckins.length === 0) return 0;
    const byDate = new Set(allCheckins.map((c) => c.id));
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let offset = 0; offset <= allCheckins.length; offset++) {
      const day = new Date(today);
      day.setDate(day.getDate() - offset);
      if (byDate.has(formatDateKey(day))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [allCheckins]);

  useEffect(() => {
    if (disciple) {
      setPastorNote(disciple.pastorNote || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciple?.id]);

  async function handleSave(formData) {
    setSaving(true);
    setError("");

    try {
      await api.put(`/api/disciples/${encodeURIComponent(id)}`, formData);
      setShowEditModal(false);
      await refreshData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError("");

    try {
      await api.delete(`/api/disciples/${encodeURIComponent(id)}`);
      navigate("/disciples");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleNoteBlur() {
    if (noteSaving) return;
    setNoteSaving(true);
    try {
      await api.put(`/api/disciples/${encodeURIComponent(id)}`, { pastorNote });
    } catch {
      // silent — note save failure is non-critical
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <Layout title="Profil disciple" onLogout={onLogout}>
      <div className="mb-4">
        <Link
          to="/disciples"
          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-[#6C3FE8]/60 px-[14px] py-[6px] text-[13px] font-medium text-[#6C3FE8] transition-colors hover:border-[#6C3FE8]"
          style={{
            backgroundColor: theme === "dark" ? "#1A1825" : "#f3f0ff"
          }}
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-[3px]" /> Retour à la liste
        </Link>
      </div>

      {loading ? <p className="text-theme-muted">Chargement...</p> : null}
      {error ? <p className="text-red-500">{error}</p> : null}

      {!loading && disciple ? (
        <div className="grid min-h-[calc(100vh-8.5rem)] items-stretch gap-4 xl:grid-cols-[280px_1fr]">
          <aside className="flex h-full min-h-[calc(100vh-8.5rem)] flex-col gap-4">
            <section className="rounded-[14px] border border-theme-border bg-theme-surface p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold" style={{ backgroundColor: getAvatarColor(disciple.name).bg, color: getAvatarColor(disciple.name).text }}>
                  {getInitials(disciple.name)}
                </div>
                <div>
                  <p className="text-base font-semibold text-theme-text1">{disciple.name || "Inconnu"}</p>
                  <p className="text-xs text-brand-600">{disciple.phoneNumber || disciple.id}</p>
                </div>
              </div>

              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(
                  normalizeStatus(disciple.status)
                )}`}
              >
                {normalizeStatus(disciple.status)}
              </span>

              <p className="mt-3 text-[11px] text-theme-muted">
                Membre depuis {formatDateFr(disciple.createdAt) || "-"}
              </p>
            </section>

            <section className="flex flex-1 flex-col rounded-[14px] border border-theme-border bg-theme-surface p-4">
              {/* Engagement */}
              <div className="mb-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#6C3FE8]">Engagement</p>
                <div className="mb-3 flex justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <svg width="96" height="96" viewBox="0 0 100 100">
                      <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke={theme === "light" ? "#E5E7EB" : "#2D2A3E"}
                        strokeWidth="7"
                      />
                      <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke="#6C3FE8"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 * (1 - progressionStats.prayerRate / 100)}
                        style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }}
                      />
                      <text
                        x="50" y="57"
                        textAnchor="middle"
                        fontSize="20"
                        fontWeight="bold"
                        fill={theme === "light" ? "#1A1825" : "#F0EEFF"}
                      >
                        {progressionStats.prayerRate}%
                      </text>
                    </svg>
                    <p className="text-[12px] text-theme-text2">Taux de prière</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  {streak > 0 ? (
                    <p className="text-[13px] text-theme-text1">
                      🔥 <span className="font-bold">{streak}</span> jours de suite
                    </p>
                  ) : (
                    <p className="text-[12px] italic text-theme-muted">Pas encore de streak</p>
                  )}
                </div>
              </div>

              {/* Note du pasteur */}
              <div className="mb-5">
                <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6C3FE8]"><NotebookPen size={14} />Note privée</p>
                <textarea
                  value={pastorNote}
                  onChange={(e) => setPastorNote(e.target.value)}
                  onBlur={handleNoteBlur}
                  rows={4}
                  placeholder="Ajouter une note..."
                  className="w-full resize-none rounded-lg border border-[#2D2A3E] bg-transparent px-3 py-2 text-[13px] text-theme-text1 outline-none placeholder:text-theme-text2/60 focus:border-[#6C3FE8]"
                />
                {noteSaving && (
                  <p className="mt-1 text-[11px] text-theme-muted">Sauvegarde...</p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-auto space-y-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C3FE8] px-3 py-2 text-sm font-medium text-white"
                >
                  <Pencil size={15} />
                  Modifier le profil
                </button>

                <button
                  onClick={() => setShowManualModal(true)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === "dark"
                      ? "border-[#2D2A3E] bg-transparent text-theme-text1 hover:border-[#6C3FE8]"
                      : "secondary-accent-button"
                  }`}
                >
                  Envoyer un check-in
                </button>

                <button
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-transparent px-3 py-2 text-sm text-[#EF4444]"
                >
                  <Trash2 size={15} />
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </section>
          </aside>

          <div className="flex h-full min-h-[calc(100vh-8.5rem)] flex-col gap-4">
            <section className="flex-1 rounded-[14px] border border-theme-border bg-theme-surface p-4">
              <h3 className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.5px] text-brand-600">
                <UserRoundCheck size={14} />
                Informations personnelles
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[11px] text-theme-text2">Pays d'origine</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {displayReadValue(disciple.originCountry)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-theme-text2">Pays actuel</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {displayReadValue(disciple.currentCountry)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-theme-text2">Date de conversion</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {displayReadValue(formatDateFr(disciple.conversionDate))}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-theme-text2">Début vie chrétienne</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {displayReadValue(formatDateFr(disciple.christianLifeStart))}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-theme-text2">Eglise</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {displayReadValue(disciple.church)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-theme-text2">Pasteur principal</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {displayReadValue(disciple.mainPastor)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-theme-text2">Faiseur de disciple</p>
                  <p className="text-[13px] font-semibold text-theme-text1">
                    {disciple.discipleMaker ? "Oui" : "Non"}
                  </p>
                </div>

                {dynamicFields.map((field) => (
                  <div key={field.key}>
                    <p className="text-[11px] text-theme-text2">{field.label}</p>
                    <p className="text-[13px] font-semibold text-theme-text1">
                      {renderDynamicFieldValue(field.type, disciple.customFields?.[field.key], field.unit)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex-1 rounded-[14px] border border-theme-border bg-theme-surface p-4">
              <h3 className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.5px] text-brand-600">
                <Flame size={14} />
                Progression spirituelle
              </h3>

              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <article
                  className="rounded-xl border border-theme-border bg-theme-bg p-3"
                  style={
                    theme === "light"
                      ? {
                          backgroundColor: "#FFFFFF",
                          border: "1.5px solid #C4B5FD",
                          boxShadow: "0 2px 8px rgba(108,63,232,0.10)"
                        }
                      : undefined
                  }
                >
                  <div className="mb-1 flex items-center gap-2">
                    <CalendarDays size={16} className="text-[#6C3FE8]" />
                    <p className="text-[11px] text-theme-text2">Jours de check-in</p>
                  </div>
                  <p className="text-[24px] font-semibold text-[#6C3FE8]">{progressionStats.totalCheckins}</p>
                </article>

                <article
                  className="rounded-xl border border-theme-border bg-theme-bg p-3"
                  style={
                    theme === "light"
                      ? {
                          backgroundColor: "#FFFFFF",
                          border: "1.5px solid #C4B5FD",
                          boxShadow: "0 2px 8px rgba(108,63,232,0.10)"
                        }
                      : undefined
                  }
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-base">🙏</span>
                    <p className="text-[11px] text-theme-text2">Taux de prière</p>
                  </div>
                  <p className="text-[24px] font-semibold" style={{ color: progressionStats.prayerRate > 70 ? '#10B981' : progressionStats.prayerRate >= 40 ? '#F59E0B' : '#EF4444' }}>{progressionStats.prayerRate}%</p>
                </article>

                <article
                  className="rounded-xl border border-theme-border bg-theme-bg p-3"
                  style={
                    theme === "light"
                      ? {
                          backgroundColor: "#FFFFFF",
                          border: "1.5px solid #C4B5FD",
                          boxShadow: "0 2px 8px rgba(108,63,232,0.10)"
                        }
                      : undefined
                  }
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Clock3 size={16} className="text-[#F59E0B]" />
                    <p className="text-[11px] text-theme-text2">Dernière activité</p>
                  </div>
                  <p className="text-[24px] font-semibold text-[#F59E0B]">{progressionStats.lastActivity}</p>
                </article>
              </div>

              <div
                className="h-36 rounded-xl border border-theme-border bg-theme-bg p-2"
                style={
                  theme === "light"
                    ? {
                        backgroundColor: "#FFFFFF",
                        border: "1.5px solid #C4B5FD"
                      }
                    : undefined
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressionStats.sevenDays} barCategoryGap="25%">
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme === 'light' ? '#4B5563' : '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF",
                        border: `1px solid ${theme === "dark" ? "#2D2A3E" : "#e5e1ff"}`,
                        borderRadius: "10px",
                        color: theme === "dark" ? "#F0EEFF" : "#1a1040"
                      }}
                      formatter={(_value, _name, item) => {
                        const status = item?.payload?.status;
                        const label =
                          status === "prayed"
                            ? "A prie"
                            : status === "not_prayed"
                              ? "N'a pas prie"
                              : "Absent";
                        return [label];
                      }}
                    />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]} minPointSize={6}>
                      {progressionStats.sevenDays.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={
                            entry.status === "prayed"
                              ? "#10B981"
                              : entry.status === "not_prayed"
                                ? "#EF4444"
                                : theme === 'light' ? '#E5E7EB' : '#2D2A3E'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="flex-1 rounded-[14px] border border-theme-border bg-theme-surface p-4">
              <h3 className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.5px] text-brand-600">
                <History size={14} />
                Derniers check-ins
              </h3>

              {latestCheckins.length === 0 ? (
                <p className="py-8 text-center text-sm text-theme-muted">Aucun check-in enregistre</p>
              ) : (
                <div className="space-y-3">
                  {latestCheckins.map((checkin) => (
                    <article key={checkin.id} className="flex gap-4 border-b border-[#2D2A3E] pb-3">
                      <div className="min-w-[80px] text-[11px] text-theme-muted">{formatDateFr(checkin.id)}</div>

                      <div className="space-y-2">
                        <div>
                          <p className="text-[11px] text-theme-text2">Comment s'est passée ta journée ?</p>
                          <p className="text-[13px] text-theme-text1">{checkin.dayFeeling || "—"}</p>
                        </div>

                        <div>
                          <p className="text-[11px] text-theme-text2">As-tu prie aujourd'hui ?</p>
                          <p className="text-[13px] text-theme-text1">
                            {typeof checkin.prayed === "boolean" ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                  checkin.prayed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {checkin.prayed ? "A prie" : "N'a pas prie"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] text-theme-text2">Un verset ou une pensée du jour ?</p>
                          <p className="text-[13px] text-theme-text1">{checkin.verse || "—"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <Link
                  to={`/suivi?disciple=${encodeURIComponent(id)}`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-[#6C3FE8]/60 bg-transparent px-[14px] py-[6px] text-[13px] font-medium text-[#6C3FE8] transition-colors hover:border-[#6C3FE8] hover:underline"
                >
                  <History size={14} />
                  Voir tout l'historique
                </Link>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={disciple}
        dynamicFields={dynamicFields}
        onSave={handleSave}
        saving={saving}
        theme={theme}
      />

      <SingleDiscipleCheckinModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        disciple={disciple}
      />

      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer ce disciple ?"
          message={`Cette action est irréversible. Toutes les données de ${disciple?.name || "ce disciple"} seront supprimées.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </Layout>
  );
}

export default DiscipleProfilePage;
