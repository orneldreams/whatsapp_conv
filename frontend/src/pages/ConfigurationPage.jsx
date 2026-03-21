import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ListTree, Pencil, PlusCircle, Settings2, Trash2 } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";

const fieldTypeOptions = [
  { value: "text", label: "Texte" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Oui ou Non" },
  { value: "select", label: "Liste déroulante" },
  { value: "number", label: "Nombre" },
  { value: "phone", label: "Téléphone" },
  { value: "url", label: "Lien URL" },
  { value: "longtext", label: "Note longue" }
];

function slugifyLabelToKey(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function typeToLabel(type) {
  return fieldTypeOptions.find((item) => item.value === type)?.label || type;
}

function TypeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="secondary-accent-control flex w-full items-center justify-between rounded-lg border border-theme-border bg-transparent px-3 py-2 text-left text-sm text-theme-text1"
      >
        <span>{typeToLabel(value)}</span>
        <span className="text-theme-text2">▾</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-theme-border bg-theme-surface p-1 shadow-lg">
          {fieldTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                value === option.value
                  ? "bg-[#6C3FE8]/15 text-theme-text1"
                  : "text-theme-text2 hover:bg-theme-bg"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-theme-border px-3 py-2 text-sm"
    >
      <span className="text-theme-text2">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-300 ${
          checked ? "bg-[#6C3FE8]" : theme === "dark" ? "bg-[#2D2A3E]" : "bg-[#D8D0FF]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 ${
            checked ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

function OptionsEditor({ options, setOptions }) {
  const [nextOption, setNextOption] = useState("");

  function addOption() {
    const clean = nextOption.trim();
    if (!clean) return;
    if (options.includes(clean)) {
      setNextOption("");
      return;
    }
    setOptions((prev) => [...prev, clean]);
    setNextOption("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={nextOption}
          onChange={(event) => setNextOption(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOption();
            }
          }}
          className="flex-1 rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
          placeholder="Ajouter une option"
        />
        <button
          type="button"
          onClick={addOption}
          className="rounded-lg bg-[#6C3FE8] px-3 py-2 text-sm font-medium text-white"
        >
          Ajouter
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <span
            key={option}
            className="inline-flex items-center gap-1 rounded-full border border-theme-border bg-theme-bg px-2 py-1 text-xs text-theme-text1"
          >
            {option}
            <button
              type="button"
              className="text-theme-text2"
              onClick={() => setOptions((prev) => prev.filter((item) => item !== option))}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function EditLabelModal({ isOpen, title, value, onChange, onCancel, onSave, saving }) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className={`w-full max-w-md rounded-[12px] border p-4 ${theme === "dark" ? "border-[#2D2A3E] bg-[#1A1825]" : "border-[#C4B5FD] bg-white shadow-[0_2px_8px_rgba(108,63,232,0.10)]"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className={`mb-3 text-base font-semibold ${theme === "dark" ? "text-[#F0EEFF]" : "text-[#1A1040]"}`}>{title}</h3>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`mb-4 w-full rounded-lg border px-3 py-2 text-sm ${theme === "dark" ? "border-[#2D2A3E] bg-transparent text-[#F0EEFF]" : "border-[#C4B5FD] bg-[#F5F3FF] text-[#1A1040]"}`}
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-lg border px-3 py-2 text-sm ${theme === "dark" ? "border-[#2D2A3E] text-[#F0EEFF]" : "border-[#C4B5FD] text-[#1A1040]"}`}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!value.trim() || saving}
            className="rounded-lg bg-[#6C3FE8] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableFieldRow({ field, onEdit, onDelete }) {
  const { theme } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key
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
      className="mb-2 flex items-center justify-between rounded-xl border border-theme-border bg-theme-bg px-3 py-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-theme-text2"
          aria-label={`Reordonner ${field.label}`}
        >
          <GripVertical size={16} />
        </button>

        <div>
          <p className="text-sm font-semibold text-theme-text1">{field.label}</p>
          <p className="text-xs text-theme-text2">
            {typeToLabel(field.type)} • {field.required ? "Obligatoire" : "Optionnel"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(field)}
          className="inline-flex items-center gap-1 rounded-[6px] border border-[#6C3FE8] px-2 py-1 text-[12px] text-[#6C3FE8] transition-colors hover:bg-[#6C3FE8] hover:text-white"
          style={{ borderWidth: '0.5px' }}
        >
          <Pencil size={13} />
          Modifier
        </button>
        <button
          type="button"
          onClick={() => onDelete(field)}
          className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-1 text-[12px] bg-transparent transition-colors hover:border-[#EF4444] hover:text-[#EF4444] ${theme === "dark" ? "text-[#9CA3AF]" : "text-[#4B5563]"}`}
          style={{ borderWidth: '0.5px', borderColor: theme === "dark" ? '#2D2A3E' : '#C4B5FD' }}
        >
          <Trash2 size={13} />
          Supprimer
        </button>
      </div>
    </div>
  );
}

function ConfigurationPage({ onLogout }) {
  const { theme } = useTheme();
  const [baseFields, setBaseFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState("text");
  const [formOptions, setFormOptions] = useState([]);
  const [formRequired, setFormRequired] = useState(false);
  const [formUnit, setFormUnit] = useState("");

  const [editingBaseField, setEditingBaseField] = useState(null);
  const [editingBaseLabel, setEditingBaseLabel] = useState("");

  const [editingCustomField, setEditingCustomField] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingType, setEditingType] = useState("text");
  const [editingOptions, setEditingOptions] = useState([]);
  const [editingRequired, setEditingRequired] = useState(false);
  const [editingUnit, setEditingUnit] = useState("");

  const [confirmDeleteField, setConfirmDeleteField] = useState(null);
  const [confirmTypeChange, setConfirmTypeChange] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const formKeyPreview = useMemo(() => slugifyLabelToKey(formLabel), [formLabel]);

  const cardStyle =
    theme === "dark"
      ? { backgroundColor: "#1A1825", borderColor: "#2D2A3E", borderWidth: "0.5px" }
      : {
          backgroundColor: "#FFFFFF",
          borderColor: "#C4B5FD",
          borderWidth: "1px",
          boxShadow: "0 2px 8px rgba(108,63,232,0.10)"
        };

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [baseRes, customRes] = await Promise.all([
        api.get("/api/config/base-fields"),
        api.get("/api/config/fields")
      ]);
      setBaseFields(baseRes.data.items || []);
      setCustomFields(customRes.data.items || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddField(event) {
    event.preventDefault();
    setError("");

    const label = formLabel.trim();
    const key = formKeyPreview;

    if (!label || !key) {
      setError("Le label est requis");
      return;
    }

    if (customFields.some((field) => field.key === key)) {
      setError("Un champ similaire existe deja");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post("/api/config/fields", {
        key,
        label,
        type: formType,
        required: formRequired,
        options: formType === "select" ? formOptions : [],
        unit: formType === "number" ? formUnit : ""
      });

      setCustomFields(res.data.items || []);
      setFormLabel("");
      setFormType("text");
      setFormOptions([]);
      setFormRequired(false);
      setFormUnit("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveBaseLabel() {
    if (!editingBaseField) return;
    try {
      setSaving(true);
      const res = await api.put(`/api/config/base-fields/${encodeURIComponent(editingBaseField.key)}`, {
        label: editingBaseLabel.trim()
      });
      setBaseFields(res.data.items || []);
      setEditingBaseField(null);
      setEditingBaseLabel("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openEditCustom(field) {
    setEditingCustomField(field);
    setEditingLabel(field.label || "");
    setEditingType(field.type || "text");
    setEditingOptions(Array.isArray(field.options) ? field.options : []);
    setEditingRequired(Boolean(field.required));
    setEditingUnit(field.unit || "");
  }

  async function persistCustomFields(nextFields) {
    const res = await api.put("/api/config/fields", { items: nextFields });
    setCustomFields(res.data.items || []);
  }

  async function saveCustomFieldDirect() {
    if (!editingCustomField) return;

    const nextFields = customFields.map((field) =>
      field.key === editingCustomField.key
        ? {
            ...field,
            label: editingLabel.trim(),
            type: editingType,
            options: editingType === "select" ? editingOptions : [],
            required: editingRequired,
            unit: editingType === "number" ? editingUnit : ""
          }
        : field
    );

    try {
      setSaving(true);
      await persistCustomFields(nextFields);
      setEditingCustomField(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function requestSaveCustomField() {
    if (!editingCustomField) return;

    if (editingType !== editingCustomField.type) {
      setConfirmTypeChange({
        title: "Changer le type de champ ?",
        message: "Changer le type peut affecter les données déjà enregistrées pour ce champ.",
        onConfirm: async () => {
          setConfirmTypeChange(null);
          await saveCustomFieldDirect();
        }
      });
      return;
    }

    saveCustomFieldDirect();
  }

  async function handleDeleteField() {
    if (!confirmDeleteField) return;
    try {
      setSaving(true);
      const res = await api.delete(`/api/config/fields/${encodeURIComponent(confirmDeleteField.key)}`);
      setCustomFields(res.data.items || []);
      setConfirmDeleteField(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = customFields.findIndex((field) => field.key === active.id);
    const newIndex = customFields.findIndex((field) => field.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(customFields, oldIndex, newIndex);
    setCustomFields(next);

    try {
      await persistCustomFields(next);
    } catch (err) {
      setError(getErrorMessage(err));
      await loadAll();
    }
  }

  return (
    <Layout title="Configuration" onLogout={onLogout}>
      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}

      <div className="grid min-h-[calc(100vh-8.5rem)] gap-4 xl:grid-cols-[1.05fr_0.95fr_1.2fr]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border p-4" style={cardStyle}>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-theme-text1">
            <Settings2 size={17} className="text-[#6C3FE8]" />
            Champs de base
          </h3>
          <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {loading ? <p className="text-sm text-theme-muted">Chargement...</p> : null}

            {baseFields.map((field) => (
              <article key={field.key} className="rounded-xl border border-theme-border bg-theme-bg p-3">
                <p className="text-sm font-semibold text-theme-text1">{field.label}</p>
                <p className="mb-3 text-xs text-theme-muted">{typeToLabel(field.type)}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBaseField(field);
                    setEditingBaseLabel(field.label || "");
                  }}
                  className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-1 text-[12px] transition-colors ${
                    theme === "dark"
                      ? "border-[#6C3FE8] text-[#6C3FE8] hover:bg-[#6C3FE8] hover:text-white"
                      : "secondary-accent-button"
                  }`}
                  style={{ borderWidth: '0.5px' }}
                >
                  <Pencil size={13} />
                  Modifier le label
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border p-4" style={cardStyle}>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-theme-text1">
            <PlusCircle size={17} className="text-[#6C3FE8]" />
            Ajouter un champ personnalisé
          </h3>

          <form className="space-y-3" onSubmit={handleAddField}>
            <div>
              <label className="mb-1 block text-sm text-theme-text2">Label</label>
              <input
                value={formLabel}
                onChange={(event) => setFormLabel(event.target.value)}
                className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
                placeholder="Ex: Niveau spirituel"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-theme-text2">Type</label>
              <TypeDropdown value={formType} onChange={setFormType} />
            </div>

            {formType === "select" ? (
              <div>
                <label className="mb-1 block text-sm text-theme-text2">Options de liste</label>
                <OptionsEditor options={formOptions} setOptions={setFormOptions} />
              </div>
            ) : null}

            {formType === "number" ? (
              <div>
                <label className="mb-1 block text-sm text-theme-text2">Unité (ex: années, fois/semaine)</label>
                <input
                  value={formUnit}
                  onChange={(event) => setFormUnit(event.target.value)}
                  className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
                  placeholder="Ex: années"
                />
              </div>
            ) : null}

            <Toggle checked={formRequired} onChange={setFormRequired} label="Obligatoire" />

            <button
              type="submit"
              disabled={!formLabel.trim() || saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C3FE8] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <PlusCircle size={16} />
              Ajouter le champ
            </button>
          </form>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border p-4" style={cardStyle}>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-theme-text1">
            <ListTree size={17} className="text-[#6C3FE8]" />
            Champs personnalisés
          </h3>

          {loading ? <p className="text-sm text-theme-muted">Chargement...</p> : null}

          {!loading && customFields.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-theme-muted">
              Aucun champ personnalisé pour le moment
            </div>
          ) : null}

          {!loading && customFields.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={customFields.map((field) => field.key)}
                  strategy={verticalListSortingStrategy}
                >
                  {customFields.map((field) => (
                    <SortableFieldRow
                      key={field.key}
                      field={field}
                      onEdit={openEditCustom}
                      onDelete={setConfirmDeleteField}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ) : null}
        </section>
      </div>

      <EditLabelModal
        isOpen={Boolean(editingBaseField)}
        title="Modifier le label du champ de base"
        value={editingBaseLabel}
        onChange={setEditingBaseLabel}
        onCancel={() => {
          setEditingBaseField(null);
          setEditingBaseLabel("");
        }}
        onSave={saveBaseLabel}
        saving={saving}
      />

      <div>
        {editingCustomField ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingCustomField(null)}>
            <div
              className={`w-full max-w-lg rounded-[12px] border p-4 ${theme === "dark" ? "border-[#2D2A3E] bg-[#1A1825]" : "border-[#C4B5FD] bg-white shadow-[0_2px_8px_rgba(108,63,232,0.10)]"}`}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className={`mb-3 text-base font-semibold ${theme === "dark" ? "text-[#F0EEFF]" : "text-[#1A1040]"}`}>Modifier le champ</h3>

              <div className="space-y-3">
                <div>
                  <label className={`mb-1 block text-sm ${theme === "dark" ? "text-slate-300" : "text-[#3730A3]"}`}>Label</label>
                  <input
                    value={editingLabel}
                    onChange={(event) => setEditingLabel(event.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${theme === "dark" ? "border-[#2D2A3E] bg-transparent text-[#F0EEFF]" : "border-[#C4B5FD] bg-[#F5F3FF] text-[#1A1040]"}`}
                  />
                </div>

                <div>
                  <label className={`mb-1 block text-sm ${theme === "dark" ? "text-slate-300" : "text-[#3730A3]"}`}>Type</label>
                  <TypeDropdown value={editingType} onChange={setEditingType} />
                </div>

                {editingType === "select" ? (
                  <div>
                    <label className={`mb-1 block text-sm ${theme === "dark" ? "text-slate-300" : "text-[#3730A3]"}`}>Options</label>
                    <OptionsEditor options={editingOptions} setOptions={setEditingOptions} />
                  </div>
                ) : null}

                {editingType === "number" ? (
                  <div>
                    <label className={`mb-1 block text-sm ${theme === "dark" ? "text-slate-300" : "text-[#3730A3]"}`}>Unité (ex: années, fois/semaine)</label>
                    <input
                      value={editingUnit}
                      onChange={(event) => setEditingUnit(event.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${theme === "dark" ? "border-[#2D2A3E] bg-transparent text-[#F0EEFF]" : "border-[#C4B5FD] bg-[#F5F3FF] text-[#1A1040]"}`}
                      placeholder="Ex: années"
                    />
                  </div>
                ) : null}

                <Toggle checked={editingRequired} onChange={setEditingRequired} label="Obligatoire" />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm ${theme === "dark" ? "border-[#2D2A3E] text-[#F0EEFF]" : "border-[#C4B5FD] text-[#1A1040]"}`}
                  onClick={() => setEditingCustomField(null)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#6C3FE8] px-3 py-2 text-sm font-medium text-white"
                  onClick={requestSaveCustomField}
                  disabled={!editingLabel.trim() || saving}
                >
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {confirmDeleteField ? (
        <ConfirmModal
          title="Supprimer ce champ ?"
          message="Ce champ sera supprimé de TOUS les profils disciples existants. Cette action est irréversible."
          confirmLabel="Supprimer"
          danger
          onConfirm={handleDeleteField}
          onCancel={() => setConfirmDeleteField(null)}
        />
      ) : null}

      {confirmTypeChange ? (
        <ConfirmModal
          title={confirmTypeChange.title}
          message={confirmTypeChange.message}
          confirmLabel="Continuer"
          danger
          onConfirm={confirmTypeChange.onConfirm}
          onCancel={() => setConfirmTypeChange(null)}
        />
      ) : null}
    </Layout>
  );
}

export default ConfigurationPage;
