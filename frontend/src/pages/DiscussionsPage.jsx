import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ChevronLeft, MessageSquare, Pin, Search } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import api, { getErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import ConversationPane from "../components/ConversationPane";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { firestore } from "../services/firebase";

const AVATAR_COLORS = [
  { bg: "#4F46E5", text: "#fff" },
  { bg: "#0F766E", text: "#fff" },
  { bg: "#7C3AED", text: "#fff" },
  { bg: "#B45309", text: "#fff" },
  { bg: "#BE185D", text: "#fff" },
  { bg: "#047857", text: "#fff" },
  { bg: "#B91C1C", text: "#fff" },
  { bg: "#1D4ED8", text: "#fff" }
];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
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

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24 && msgDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (msgDay.getTime() === yesterday.getTime()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function isConversationPinnedActive(item) {
  if (!item?.conversationPinned) {
    return false;
  }

  if (!item?.conversationPinnedUntil) {
    return true;
  }

  const until = new Date(item.conversationPinnedUntil);
  if (Number.isNaN(until.getTime())) {
    return true;
  }

  return until.getTime() > Date.now();
}

function DiscussionsPage({ onLogout }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [archivingId, setArchivingId] = useState("");

  const fetchDiscussions = useCallback(async () => {
    try {
      const res = await api.get("/api/discussions", {
        params: {
          includeArchived: true
        }
      });
      setDiscussions(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const disciplesRef = collection(firestore, "pasteurs", user.uid, "disciples");
    const unsubscribe = onSnapshot(
      disciplesRef,
      () => {
        fetchDiscussions();
      },
      () => {
        // fallback silently handled by manual refreshes
      }
    );

    return () => unsubscribe();
  }, [fetchDiscussions, user?.uid]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    setSelected((prev) => {
      if (!prev) {
        return prev;
      }

      const next = discussions.find((item) => item.discipleId === prev.discipleId);
      return next || prev;
    });
  }, [discussions, selected]);

  const totalUnread = useMemo(
    () => discussions.filter((item) => !item.archived).reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [discussions]
  );

  const filtered = useMemo(() => {
    let list = discussions;

    if (filter === "unread") {
      list = list.filter((item) => !item.archived && item.unreadCount > 0);
    } else if (filter === "waiting") {
      list = list.filter((item) => !item.archived && item.waitingForPastor);
    } else if (filter === "archived") {
      list = list.filter((item) => item.archived);
    } else {
      list = list.filter((item) => !item.archived);
    }

    if (search.trim()) {
      const queryText = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(queryText) ||
          (item.phoneNumber || "").toLowerCase().includes(queryText) ||
          (item.lastMessage?.content || "").toLowerCase().includes(queryText)
      );
    }

    return list;
  }, [discussions, filter, search]);

  const selectedDisciple = useMemo(() => {
    if (!selected) return null;
    return {
      id: selected.discipleId,
      discipleId: selected.discipleId,
      phoneNumber: selected.phoneNumber,
      displayPhone: selected.phoneNumber,
      name: selected.name,
      waitingForPastor: selected.waitingForPastor,
      archived: selected.archived,
      conversationPinned: selected.conversationPinned,
      conversationPinnedAt: selected.conversationPinnedAt || null,
      conversationPinnedUntil: selected.conversationPinnedUntil || null,
      conversationNote: selected.conversationNote || ""
    };
  }, [selected]);

  const handleMessagesRead = useCallback(({ discipleId }) => {
    if (!discipleId) {
      return;
    }

    setDiscussions((prev) => prev.map((item) => (
      item.discipleId === discipleId
        ? { ...item, unreadCount: 0, waitingForPastor: false }
        : item
    )));
  }, []);

  const handleDiscipleUpdate = useCallback((patch) => {
    if (!patch?.id) {
      return;
    }

    setDiscussions((prev) => prev.map((item) => (
      item.discipleId === patch.id ? { ...item, ...patch } : item
    )));
    setSelected((prev) => {
      if (!prev || prev.discipleId !== patch.id) {
        return prev;
      }

      return { ...prev, ...patch };
    });
  }, []);

  async function handleArchiveToggle(event, discussion) {
    event.stopPropagation();
    if (!discussion?.discipleId || archivingId) {
      return;
    }

    const nextArchived = !discussion.archived;
    setArchivingId(discussion.discipleId);
    setDiscussions((prev) => prev.map((item) => (
      item.discipleId === discussion.discipleId ? { ...item, archived: nextArchived } : item
    )));

    try {
      await api.put(`/api/disciples/${encodeURIComponent(discussion.discipleId)}/archive`, {
        archived: nextArchived
      });
      if (selected?.discipleId === discussion.discipleId && nextArchived && filter !== "archived") {
        setSelected(null);
      }
    } catch (err) {
      setDiscussions((prev) => prev.map((item) => (
        item.discipleId === discussion.discipleId ? { ...item, archived: discussion.archived } : item
      )));
      setError(getErrorMessage(err));
    } finally {
      setArchivingId("");
    }
  }

  const sidePanelStyle = isDark
    ? {
      borderColor: "rgba(71, 85, 105, 0.44)",
      background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.98) 100%)"
    }
    : {
      borderColor: "rgba(148, 163, 184, 0.22)",
      background: "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(241,245,249,0.98) 100%)"
    };

  const filterBaseStyle = isDark
    ? {
      border: "1px solid rgba(71,85,105,0.5)",
      background: "rgba(15,23,42,0.72)",
      color: "#cbd5e1",
      boxShadow: "0 1px 2px rgba(2, 6, 23, 0.45)"
    }
    : {
      border: "1px solid rgba(148,163,184,0.28)",
      background: "rgba(255,255,255,0.8)",
      color: "var(--text-secondary)",
      boxShadow: "0 1px 1px rgba(15, 23, 42, 0.05)"
    };

  const filterActiveStyle = {
    border: "1px solid rgba(14, 116, 144, 0.55)",
    background: "linear-gradient(120deg, #0E7490 0%, #0891B2 100%)",
    color: "#ffffff",
    boxShadow: "0 6px 18px rgba(8, 145, 178, 0.3)"
  };

  const listCardBaseStyle = isDark
    ? {
      borderColor: "rgba(71,85,105,0.45)",
      backgroundColor: "rgba(15,23,42,0.62)",
      boxShadow: "0 8px 18px rgba(2, 6, 23, 0.35)"
    }
    : {
      borderColor: "rgba(148,163,184,0.2)",
      backgroundColor: "rgba(255,255,255,0.78)",
      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)"
    };

  const panelHeaderBorder = isDark ? "rgba(71,85,105,0.5)" : "rgba(148,163,184,0.28)";
  const chipBorder = isDark ? "rgba(71,85,105,0.5)" : "rgba(148,163,184,0.28)";
  const chipText = isDark ? "#cbd5e1" : "var(--text-secondary)";
  const searchInputStyle = isDark
    ? {
      backgroundColor: "rgba(15,23,42,0.68)",
      borderColor: "rgba(71,85,105,0.52)",
      color: "#e2e8f0"
    }
    : {
      backgroundColor: "rgba(255,255,255,0.82)",
      borderColor: "rgba(148,163,184,0.3)",
      color: "var(--text-primary)"
    };

  const rightPaneStyle = isDark
    ? { background: "linear-gradient(165deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.85) 100%)" }
    : { background: "linear-gradient(165deg, rgba(241,245,249,0.82) 0%, rgba(226,232,240,0.6) 100%)" };

  const emptyStateStyle = isDark
    ? {
      borderColor: "rgba(71,85,105,0.5)",
      backgroundColor: "rgba(15,23,42,0.72)",
      boxShadow: "0 20px 40px rgba(2,6,23,0.45)"
    }
    : {
      borderColor: "rgba(148,163,184,0.26)",
      backgroundColor: "rgba(255,255,255,0.72)",
      boxShadow: "0 20px 40px rgba(15,23,42,0.08)"
    };

  return (
    <Layout title="Discussions" onLogout={onLogout}>
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        <div
          className={`flex min-w-0 flex-col border-r ${selectedDisciple ? "hidden md:flex md:w-[35%] md:min-w-[320px] md:flex-shrink-0" : "w-full md:w-[35%] md:min-w-[320px] md:flex-shrink-0"}`}
          style={sidePanelStyle}
        >
          <div className="relative border-b px-4 py-4" style={{ borderColor: panelHeaderBorder }}>
            <div
              className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full blur-2xl"
              style={{ background: isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(56, 189, 248, 0.2)" }}
            />
            <div
              className="pointer-events-none absolute -right-8 -bottom-10 h-32 w-32 rounded-full blur-2xl"
              style={{ background: isDark ? "rgba(245, 158, 11, 0.1)" : "rgba(249, 115, 22, 0.15)" }}
            />

            <div className="relative mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-wide text-theme-text1">
                Discussions
                {totalUnread > 0 ? (
                  <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-sm shadow-red-500/30">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                ) : null}
              </h2>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: chipBorder, color: chipText }}>
                {filtered.length} visibles
              </span>
            </div>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un disciple ou un message..."
                className="w-full rounded-xl border py-2.5 pl-8 pr-3 text-sm outline-none"
                style={searchInputStyle}
              />
            </div>

            <div className="relative flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "Tous" },
                { key: "unread", label: "Non lus" },
                { key: "waiting", label: "À traiter" },
                { key: "archived", label: "Archivés" }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                  style={filter === key ? filterActiveStyle : filterBaseStyle}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <p className="px-4 py-6 text-sm text-theme-text2">Chargement…</p>
            ) : error ? (
              <p className="px-4 py-6 text-sm text-red-500">{error}</p>
            ) : filtered.length === 0 ? (
              <div className="mx-2 mt-6 rounded-2xl border p-5 text-center" style={emptyStateStyle}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Aucune discussion pour ce filtre
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Essaie une autre recherche ou change le segment ci-dessus.
                </p>
              </div>
            ) : (
              filtered.map((discussion) => {
                const isSelected = selected?.discipleId === discussion.discipleId;
                const color = getAvatarColor(discussion.name);
                const pinnedConversation = isConversationPinnedActive(discussion);

                return (
                  <div
                    key={discussion.discipleId}
                    className="mb-2 rounded-2xl border px-3 py-3 transition-all hover:-translate-y-[1px]"
                    style={{
                      ...listCardBaseStyle,
                      borderColor: isSelected ? "rgba(8,145,178,0.5)" : listCardBaseStyle.borderColor,
                      backgroundColor: isSelected
                        ? (isDark ? "rgba(8,47,73,0.62)" : "rgba(236, 253, 255, 0.95)")
                        : listCardBaseStyle.backgroundColor,
                      boxShadow: isSelected
                        ? (isDark ? "0 14px 28px rgba(8,145,178,0.22)" : "0 12px 24px rgba(8, 145, 178, 0.16)")
                        : listCardBaseStyle.boxShadow
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setSelected(discussion)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-[13px] font-extrabold shadow-sm"
                          style={{ backgroundColor: color.bg, color: color.text }}
                        >
                          {getInitials(discussion.name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                {discussion.name || discussion.phoneNumber}
                              </span>
                              {pinnedConversation ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold" style={{ color: isDark ? "#fcd34d" : "#d97706" }}>
                                  <Pin size={10} /> Épinglée
                                </span>
                              ) : null}
                              {discussion.waitingForPastor ? (
                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold" style={{ color: isDark ? "#facc15" : "#f59e0b" }}>
                                  À traiter
                                </span>
                              ) : null}
                            </div>
                            <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                              {formatRelativeTime(discussion.lastMessage?.sentAt)}
                            </span>
                          </div>

                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="truncate text-[13px]" style={{ color: "var(--text-muted)" }}>
                              {discussion.lastMessage?.sender === "pastor" ? "Vous : " : ""}
                              {discussion.lastMessage?.content || ""}
                            </p>
                            {discussion.unreadCount > 0 ? (
                              <span className="inline-flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                                {discussion.unreadCount > 99 ? "99+" : discussion.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={archivingId === discussion.discipleId}
                        onClick={(event) => handleArchiveToggle(event, discussion)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border text-theme-text2 transition-colors hover:text-theme-text1 disabled:opacity-50"
                        style={{
                          borderColor: isDark ? "rgba(71,85,105,0.5)" : "rgba(148,163,184,0.3)",
                          backgroundColor: isDark ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.75)"
                        }}
                        title={discussion.archived ? "Désarchiver" : "Archiver"}
                      >
                        {discussion.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          className={`relative min-w-0 flex-1 flex-col overflow-hidden ${selectedDisciple ? "flex" : "hidden md:flex"}`}
          style={rightPaneStyle}
        >
          <div
            className="pointer-events-none absolute right-[-120px] top-[-100px] h-[280px] w-[280px] rounded-full blur-3xl"
            style={{ background: isDark ? "rgba(6, 182, 212, 0.12)" : "rgba(14, 116, 144, 0.16)" }}
          />
          <div
            className="pointer-events-none absolute bottom-[-140px] left-[-80px] h-[260px] w-[260px] rounded-full blur-3xl"
            style={{ background: isDark ? "rgba(251, 146, 60, 0.09)" : "rgba(234, 88, 12, 0.12)" }}
          />
          {selectedDisciple ? (
            <>
              <div className="border-b border-theme-border p-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text1"
                >
                  <ChevronLeft size={16} />
                  Retour aux discussions
                </button>
              </div>
              <ConversationPane
                key={selectedDisciple.discipleId}
                disciple={selectedDisciple}
                className="h-full rounded-none border-0"
                showHeader
                onReadMessages={handleMessagesRead}
                onDiscipleUpdate={handleDiscipleUpdate}
              />
            </>
          ) : (
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-theme-text2">
              <div className="rounded-3xl border p-8" style={emptyStateStyle}>
                <MessageSquare size={48} className="mx-auto opacity-60" />
                <p className="mt-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Sélectionne une conversation
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Reprends la discussion là où elle s'est arrêtée.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default DiscussionsPage;
