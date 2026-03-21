import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  MessageSquarePlus,
  Search,
  Table2,
  UserPlus,
  UserRound
} from "lucide-react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
import Layout from "../components/Layout";
import ManualCheckinModal from "../components/ManualCheckinModal";
import SingleDiscipleCheckinModal from "../components/SingleDiscipleCheckinModal";

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

function statusClass(status) {
  if (status === "Actif") return "bg-[#064E3B] text-[#6EE7B7]";
  if (status === "Silencieux") return "bg-[#450A0A] text-[#FCA5A5]";
  return "bg-[#1F2937] text-[#9CA3AF]";
}

function normalizeStatus(status) {
  return status === "Onboarding en cours" ? "Onboarding" : status;
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

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    if (!newDisciple.name.trim() || !newDisciple.phoneNumber.trim()) {
      setError("Nom et numero sont requis");
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

  const canSave = newDisciple.name.trim() && newDisciple.phoneNumber.trim();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4 py-6">
      <form
        onSubmit={handleCreate}
        className="w-full max-w-6xl overflow-hidden rounded-2xl border border-[#2D2A3E] bg-[#1A1825]"
      >
        <div className="grid lg:grid-cols-2">
          <div className="space-y-4 p-5 text-[#F0EEFF]">
            <h3 className="text-lg font-semibold">Ajouter un disciple</h3>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Nom complet *</span>
              <input
                value={newDisciple.name}
                onChange={(e) => setNewDisciple((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Numero WhatsApp *</span>
              <input
                value={newDisciple.phoneNumber}
                onChange={(e) => setNewDisciple((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
                placeholder="+237 6XX XXX XXX"
                required
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Pays d'origine</span>
                <input
                  value={newDisciple.originCountry}
                  onChange={(e) => setNewDisciple((prev) => ({ ...prev, originCountry: e.target.value }))}
                  className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Pays actuel</span>
                <input
                  value={newDisciple.currentCountry}
                  onChange={(e) => setNewDisciple((prev) => ({ ...prev, currentCountry: e.target.value }))}
                  className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Date de conversion</span>
                <input
                  type="date"
                  value={newDisciple.conversionDate}
                  onChange={(e) => setNewDisciple((prev) => ({ ...prev, conversionDate: e.target.value }))}
                  className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Début vie chrétienne</span>
                <input
                  type="date"
                  value={newDisciple.christianLifeStart}
                  onChange={(e) => setNewDisciple((prev) => ({ ...prev, christianLifeStart: e.target.value }))}
                  className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Eglise</span>
              <input
                value={newDisciple.church}
                onChange={(e) => setNewDisciple((prev) => ({ ...prev, church: e.target.value }))}
                className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Pasteur principal</span>
              <input
                value={newDisciple.mainPastor}
                onChange={(e) => setNewDisciple((prev) => ({ ...prev, mainPastor: e.target.value }))}
                className="w-full rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2 text-sm text-[#F0EEFF] outline-none focus:border-[#6C3FE8]"
              />
            </label>

            <div className="flex items-center justify-between rounded-lg border border-[#2D2A3E] bg-[#0F0E17] px-3 py-2">
              <span className="text-sm text-slate-300">Faiseur de disciple</span>
              <button
                type="button"
                onClick={() => setNewDisciple((prev) => ({ ...prev, discipleMaker: !prev.discipleMaker }))}
                className={`relative h-7 w-14 rounded-full transition-colors ${
                  newDisciple.discipleMaker ? "bg-[#6C3FE8]" : "bg-[#2D2A3E]"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                    newDisciple.discipleMaker ? "left-8" : "left-1"
                  }`}
                />
              </button>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </div>

          <div className="border-l border-[#2D2A3E] bg-[#0F0E17] p-5 text-[#F0EEFF]">
            <h4 className="mb-4 text-base font-semibold">Apercu profil</h4>

            <div className="mb-5 flex items-center gap-3">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${
                  newDisciple.name.trim() ? "bg-[#6C3FE8] text-white" : "bg-slate-700 text-slate-200"
                }`}
              >
                {getInitials(newDisciple.name)}
              </div>
              <div>
                {newDisciple.name.trim() ? (
                  <p className="text-base font-semibold">{newDisciple.name}</p>
                ) : (
                  <p className="text-base italic text-slate-400">Nom complet</p>
                )}
                <p className="text-sm text-[#6C3FE8]">{newDisciple.phoneNumber || ""}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#2D2A3E] bg-[#1A1825] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg border border-[#2D2A3E] px-4 py-2 text-sm font-medium text-slate-200"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={!canSave || creating}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              !canSave || creating ? "bg-[#2D2A3E]" : "bg-[#6C3FE8]"
            }`}
          >
            {creating ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DisciplesPage({ onLogout }) {
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

  async function fetchDisciplesAndStats(targetPage = page) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(limit));

      if (search) {
        params.set("search", search);
      }

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (countryFilter !== "all") {
        params.set("country", countryFilter);
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
    fetchDisciplesAndStats(page);
  }, [page, search, statusFilter, countryFilter]);

  useEffect(() => {
    async function loadCountries() {
      try {
        const res = await api.get("/api/disciples?page=1&limit=200");
        const countryValues = (res.data.items || [])
          .map((item) => item.currentCountry)
          .filter(Boolean);

        setCountries(Array.from(new Set(countryValues)).sort((a, b) => a.localeCompare(b, "fr")));
      } catch (_err) {
        setCountries([]);
      }
    }

    loadCountries();
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[#6C3FE8] px-4 py-2 text-sm font-medium text-white"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus size={16} />
              Ajouter un disciple
            </button>

            <button
              className="inline-flex items-center gap-2 rounded-lg border border-theme-border bg-transparent px-4 py-2 text-sm text-theme-text2"
              onClick={() => setShowManualModal(true)}
            >
              <MessageSquarePlus size={16} />
              Check-in manuel
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-theme-text2" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="rounded-lg border border-theme-border bg-theme-surface py-2 pl-9 pr-3 text-sm text-theme-text1"
                placeholder="Rechercher nom ou numero"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text1"
            >
              <option value="all">Tous statuts</option>
              <option value="actif">Actif</option>
              <option value="silencieux">Silencieux</option>
              <option value="onboarding">Onboarding</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text1"
            >
              <option value="all">Tous pays</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>

            <div className="flex overflow-hidden rounded-lg border border-theme-border bg-theme-surface">
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs ${viewMode === "table" ? "bg-[#6C3FE8] text-white" : "text-theme-text2"}`}
                onClick={() => setViewMode("table")}
              >
                <Table2 size={14} />
                Tableau
              </button>
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs ${viewMode === "cards" ? "bg-[#6C3FE8] text-white" : "text-theme-text2"}`}
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid size={14} />
                Cards
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#6C3FE8]" /> <span className="text-[13px] text-theme-text2">Total</span> <strong className="ml-1 text-[15px] text-theme-text1">{stats?.totalDisciples ?? 0}</strong>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> <span className="text-[13px] text-theme-text2">Actifs</span> <strong className="ml-1 text-[15px] text-theme-text1">{stats?.activeToday ?? 0}</strong>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> <span className="text-[13px] text-theme-text2">Silencieux</span> <strong className="ml-1 text-[15px] text-theme-text1">{stats?.silentOver3Days ?? 0}</strong>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-slate-500" /> <span className="text-[13px] text-theme-text2">Onboarding</span> <strong className="ml-1 text-[15px] text-theme-text1">{Math.max(0, (stats?.totalDisciples ?? 0) - ((stats?.activeToday ?? 0) + (stats?.silentOver3Days ?? 0)) )}</strong>
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {viewMode === "table" ? (
          <section className="flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
            {loading ? <p className="px-4 py-6 text-sm text-theme-text2">Chargement...</p> : null}

            {!loading ? (
              <table className="w-full flex-1 overflow-y-auto text-left text-sm">
                <thead className="border-b border-theme-border bg-theme-bg/40 text-[12px] uppercase tracking-wide text-theme-text2">
                  <tr>
                    <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("name")}>Disciple ↕</th>
                    <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("currentCountry")}>Pays ↕</th>
                    <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("church")}>Eglise ↕</th>
                    <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("status")}>Statut ↕</th>
                    <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("lastContact")}>Dernier contact ↕</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#1A1825]">
                  {sortedItems.map((disciple) => (
                    <tr
                      key={disciple.id}
                      className="group hover:bg-[#0F0E17]/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: getAvatarColor(disciple.name).bg, color: getAvatarColor(disciple.name).text }}>
                            {getInitials(disciple.name)}
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-theme-text1">{disciple.name || "Inconnu"}</p>
                            <p className="text-[12px] text-theme-text2">{disciple.phoneNumber}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[14px] text-theme-text2">{disciple.currentCountry || "—"}</td>
                      <td className="px-4 py-3 text-[14px] text-theme-text2">{disciple.church || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[12px] font-medium ${statusClass(disciple.status)}`}>
                          {normalizeStatus(disciple.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] text-theme-text2">{formatDateFr(disciple.lastContact)}</td>

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
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#0EA5A4] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0B8E8D]"
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
            ) : null}

            {!loading && sortedItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-theme-text2">Aucun disciple trouve.</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme-border px-4 py-3 text-sm">
              <p className="text-theme-text2">
                Affichage {from}–{to} sur {total} disciples
              </p>

              <div className="flex items-center gap-1">
                <button
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-md border border-theme-border px-2 py-1 text-theme-text2 disabled:opacity-40"
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
                        : "border border-theme-border text-theme-text2"
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="rounded-md border border-theme-border px-2 py-1 text-theme-text2 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedItems.map((disciple) => (
              <article key={disciple.id} className="flex flex-col rounded-xl border border-theme-border bg-theme-surface overflow-hidden">
                {/* Header */}
                <div className="border-b border-theme-border px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: getAvatarColor(disciple.name).bg, color: getAvatarColor(disciple.name).text }}>
                        {getInitials(disciple.name)}
                      </div>
                      <div className="flex-1">
                        <p className="text-[15px] font-medium text-theme-text1">{disciple.name || "Inconnu"}</p>
                        <p className="text-[12px] text-[#6C3FE8]">{disciple.phoneNumber}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[12px] font-medium flex-shrink-0 ${statusClass(disciple.status)}`}>
                      {normalizeStatus(disciple.status)}
                    </span>
                  </div>
                </div>

                {/* Body - 2x2 Grid */}
                <div className="flex-1 px-4 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-theme-text2 mb-1">Pays origine</p>
                      <p className="text-[13px] font-semibold text-theme-text1">{disciple.originCountry || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-theme-text2 mb-1">Pays actuel</p>
                      <p className="text-[13px] font-semibold text-theme-text1">{disciple.currentCountry || "—"}</p>
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
                <div className="border-t border-theme-border px-4 py-3 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-theme-text2">Dernier contact: {formatDateFr(disciple.lastContact)}</p>
                  <div className="flex gap-2">
                    <Link
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#6C3FE8] px-5 py-2 text-[12px] font-medium text-white"
                      to={`/disciples/${encodeURIComponent(disciple.id)}`}
                    >
                      <UserRound size={14} />
                      Profil
                    </Link>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#6C3FE8] px-5 py-2 text-[12px] font-medium text-white"
                      onClick={() => {
                        setSelectedDiscipleForCheckin(disciple);
                        setShowSingleCheckinModal(true);
                      }}
                    >
                      <MessageSquarePlus size={14} />
                      Check-in
                    </button>
                    <button
                      className="rounded-lg border border-[#EF4444] px-3 py-2 text-[12px] text-[#EF4444] transition-colors hover:bg-[#EF4444] hover:text-white"
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
        disciples={items}
      />

      <SingleDiscipleCheckinModal
        isOpen={showSingleCheckinModal}
        onClose={() => {
          setShowSingleCheckinModal(false);
          setSelectedDiscipleForCheckin(null);
        }}
        disciple={selectedDiscipleForCheckin}
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
