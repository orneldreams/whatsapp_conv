import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  CornerUpLeft,
  MessageSquare,
  Paperclip,
  Pin,
  Search,
  Send,
  Smile,
  StickyNote,
  UserRound,
  X
} from "lucide-react";
import { collection, getDocs, limit, onSnapshot, orderBy, query, where, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { firestore, storage } from "../services/firebase";

const PAGE_SIZE = 50;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 120000;
const PIN_DURATION_OPTIONS = [
  { label: "1h", minutes: 60 },
  { label: "24h", minutes: 24 * 60 },
  { label: "7j", minutes: 7 * 24 * 60 },
  { label: "Illimité", minutes: 0 }
];

function ensureWhatsappDocId(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^whatsapp:/i.test(raw)) {
    return `whatsapp:${raw.replace(/^whatsapp:/i, "")}`;
  }

  return `whatsapp:${raw}`;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMillis(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDayLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, yesterday)) return "Hier";
  return date.toLocaleDateString("fr-FR");
}

function formatHour(date) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeFirstName(name) {
  const text = String(name || "").trim();
  return text ? text.split(/\s+/)[0] : "";
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size || size < 1024) {
    return `${size} o`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} Ko`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function stripWhatsAppPrefix(phoneNumber) {
  const phone = String(phoneNumber || "").trim();
  return phone.replace(/^whatsapp:/i, "");
}

function isImageMimeType(mimeType) {
  return String(mimeType || "").toLowerCase().startsWith("image/");
}

function uploadFileWithProgress(storageRef, file, { timeoutMs = UPLOAD_TIMEOUT_MS, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/octet-stream"
    });

    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      uploadTask.cancel();
      reject(new Error("Délai dépassé pendant l'import. Vérifie ta connexion puis réessaie."));
    }, timeoutMs);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (settled) {
          return;
        }

        const total = snapshot.totalBytes || file.size || 0;
        const transferred = snapshot.bytesTransferred || 0;
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
        onProgress?.(Math.min(100, Math.max(0, percent)));
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timer);
        reject(error);
      },
      async () => {
        if (settled) {
          return;
        }

        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          settled = true;
          window.clearTimeout(timer);
          resolve(downloadUrl);
        } catch (error) {
          settled = true;
          window.clearTimeout(timer);
          reject(error);
        }
      }
    );
  });
}

function isActiveUntil(value) {
  if (!value) {
    return true;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  return date.getTime() > Date.now();
}

function formatPinUntil(value) {
  if (!value) {
    return "Épinglé sans limite";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Épinglé";
  }
  return `Épinglé jusqu'au ${date.toLocaleString("fr-FR")}`;
}

function formatProfileFieldValue(value, fallback = "Non renseigné") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function applyLocalVariables(content, disciple) {
  const firstName = normalizeFirstName(disciple?.name);
  const country = String(disciple?.currentCountry || disciple?.originCountry || "").trim();
  const church = String(disciple?.church || "").trim();

  return String(content || "")
    .replace(/\[prénom\]/gi, firstName)
    .replace(/\[prenom\]/gi, firstName)
    .replace(/\[pays\]/gi, country)
    .replace(/\[église\]/gi, church)
    .replace(/\[eglise\]/gi, church);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesMessageSearch(message, queryText) {
  if (!queryText) {
    return true;
  }

  const haystack = normalizeSearchText([
    message.content,
    message.replyTo?.content,
    message.type
  ].filter(Boolean).join(" "));

  return haystack.includes(queryText);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(content, searchQuery) {
  const text = String(content || "");
  const query = String(searchQuery || "").trim();
  if (!query) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="rounded bg-yellow-300/60 px-0.5 text-inherit">
          {part}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let lastKey = "";

  messages.forEach((message) => {
    const date = toDate(message.sentAt);
    const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";

    if (key !== lastKey) {
      groups.push({ type: "separator", id: `sep-${key}-${message.id}`, label: date ? formatDayLabel(date) : "" });
      lastKey = key;
    }

    groups.push({ type: "message", item: message });
  });

  return groups;
}

function mergeMessages(...collections) {
  const map = new Map();

  collections.flat().forEach((message) => {
    if (!message?.id) {
      return;
    }

    const existing = map.get(message.id) || {};
    map.set(message.id, { ...existing, ...message });
  });

  return Array.from(map.values()).sort((left, right) => toMillis(left.sentAt) - toMillis(right.sentAt));
}

function getDeliveryMeta(message) {
  const status = String(message.deliveryStatus || "").trim().toLowerCase();

  if (["sending", "queued", "accepted"].includes(status)) {
    return { icon: "◷", className: "text-white/70", label: "Envoi en cours" };
  }

  if (status === "sent") {
    return { icon: "✓", className: "text-white/80", label: "Envoyé" };
  }

  if (status === "delivered") {
    return { icon: "✓✓", className: "text-white/85", label: "Distribué" };
  }

  if (status === "read" || message.read) {
    return { icon: "✓✓", className: "text-cyan-200", label: "Lu" };
  }

  if (status === "failed") {
    return { icon: "!", className: "text-red-200", label: "Échec" };
  }

  return { icon: "✓", className: "text-white/80", label: "Envoyé" };
}

const EMOJIS = [
  "😊", "😂", "❤️", "🙏", "👍", "🔥", "😍", "🎉",
  "😭", "🤔", "👀", "💯", "🙌", "💪", "😅", "🤣",
  "✨", "🕊️", "📖", "⛪", "🌍", "👐", "😌", "😎",
  "🥹", "💙", "🌿", "🌱", "🕯️", "📝", "✅", "⭐",
  "🌟", "💫", "🎵", "🌹", "🌅", "☀️", "🌙", "🌊",
  "🌈", "💧", "🍃", "🦋", "🤝", "👏", "🫶", "💝"
];

function ConversationPane({
  disciple,
  className = "",
  showHeader = true,
  onBack,
  onReadMessages,
  onDiscipleUpdate
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [recentMessages, setRecentMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [snapshotUnavailable, setSnapshotUnavailable] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [conversationNote, setConversationNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pinningId, setPinningId] = useState("");
  const [pinningConversation, setPinningConversation] = useState(false);
  const [pinDurationPicker, setPinDurationPicker] = useState(null);
  const [customPinMinutes, setCustomPinMinutes] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileData, setProfileData] = useState(null);
  const [focusedMessageId, setFocusedMessageId] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiRef = useRef(null);
  const contextMenuRef = useRef(null);
  const swipeStateRef = useRef({});
  const unreadAutoJumpDoneRef = useRef(false);

  const phoneNumber = useMemo(
    () => ensureWhatsappDocId(disciple?.phoneNumber || disciple?.id || disciple?.discipleId || ""),
    [disciple]
  );
  const pasteurId = useMemo(() => user?.uid || "", [user]);
  const discipleId = phoneNumber;
  const draftStorageKey = useMemo(() => {
    if (!pasteurId || !discipleId) {
      return "";
    }
    return `chat-draft:${pasteurId}:${discipleId}`;
  }, [pasteurId, discipleId]);
  const allMessages = useMemo(
    () => mergeMessages(olderMessages, recentMessages),
    [olderMessages, recentMessages]
  );
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = useMemo(() => normalizeSearchText(deferredSearch), [deferredSearch]);
  const filteredMessages = useMemo(
    () => (normalizedSearch ? allMessages.filter((message) => matchesMessageSearch(message, normalizedSearch)) : allMessages),
    [allMessages, normalizedSearch]
  );
  const unreadDiscipleMessages = useMemo(
    () => allMessages.filter((item) => item.sender === "disciple" && item.read === false),
    [allMessages]
  );
  const grouped = useMemo(() => groupMessagesByDate(filteredMessages), [filteredMessages]);
  const pinnedMessages = useMemo(
    () => allMessages.filter((message) => message.pinned && isActiveUntil(message.pinnedUntil) && message.type !== "typing")
      .sort((left, right) => (toMillis(right.pinnedAt || right.sentAt) - toMillis(left.pinnedAt || left.sentAt))),
    [allMessages]
  );
  const conversationPinnedActive = useMemo(
    () => Boolean(disciple?.conversationPinned) && isActiveUntil(disciple?.conversationPinnedUntil),
    [disciple?.conversationPinned, disciple?.conversationPinnedUntil]
  );
  const profileFields = useMemo(() => {
    const source = profileData || disciple || {};
    const statusValue = source.status === "Onboarding en cours" ? "Onboarding" : source.status;

    return [
      { label: "Nom", value: formatProfileFieldValue(source.name) },
      { label: "WhatsApp", value: formatProfileFieldValue(source.displayPhone || source.phoneNumber || source.id || discipleId) },
      { label: "Pays d'origine", value: formatProfileFieldValue(source.originCountry) },
      { label: "Pays actuel", value: formatProfileFieldValue(source.currentCountry) },
      { label: "Église", value: formatProfileFieldValue(source.church) },
      { label: "Pasteur principal", value: formatProfileFieldValue(source.mainPastor) },
      { label: "Statut", value: formatProfileFieldValue(statusValue, "Onboarding") }
    ];
  }, [disciple, discipleId, profileData]);

  function openPinDurationPicker(payload) {
    setCustomPinMinutes("");
    setPinDurationPicker(payload);
  }

  function closePinDurationPicker() {
    setPinDurationPicker(null);
    setCustomPinMinutes("");
  }

  function updateMessageLocally(messageId, updater) {
    setOlderMessages((prev) => prev.map((item) => (item.id === messageId ? updater(item) : item)));
    setRecentMessages((prev) => prev.map((item) => (item.id === messageId ? updater(item) : item)));
  }

  const fetchConversationPage = useCallback(async (before = "") => {
    if (!discipleId) {
      return;
    }

    const res = await api.get(`/api/disciples/${encodeURIComponent(discipleId)}/conversations`, {
      params: {
        limit: PAGE_SIZE,
        ...(before ? { before } : {})
      }
    });

    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    const pagination = res.data?.pagination || {};
    setHasMore(Boolean(pagination.hasMore));
    setNextCursor(pagination.nextCursor || null);

    if (before) {
      setOlderMessages((prev) => mergeMessages(items, prev));
    } else {
      setRecentMessages(items);
    }
  }, [discipleId]);

  useEffect(() => {
    setRecentMessages([]);
    setOlderMessages([]);
    setHasMore(false);
    setNextCursor(null);
    setLoadingInitial(true);
    setError("");
    setReplyTo(null);
    setSearch("");
    setSearchOpen(false);
    setConversationNote(String(disciple?.conversationNote || ""));

    if (!draftStorageKey) {
      setText("");
    } else {
      try {
        setText(window.localStorage.getItem(draftStorageKey) || "");
      } catch {
        setText("");
      }
    }

    if (!discipleId) {
      setLoadingInitial(false);
      return undefined;
    }

    let cancelled = false;

    fetchConversationPage()
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [discipleId, draftStorageKey, disciple?.conversationNote, fetchConversationPage]);

  useEffect(() => {
    if (!draftStorageKey) {
      return;
    }

    try {
      if (text.trim()) {
        window.localStorage.setItem(draftStorageKey, text);
      } else {
        window.localStorage.removeItem(draftStorageKey);
      }
    } catch {
      // localStorage failure should not block chat
    }
  }, [draftStorageKey, text]);

  useEffect(() => {
    if (!pasteurId || !phoneNumber) {
      return undefined;
    }

    const conversationsRef = query(
      collection(firestore, "pasteurs", pasteurId, "disciples", phoneNumber, "conversations"),
      orderBy("sentAt", "desc"),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      conversationsRef,
      (snapshot) => {
        setSnapshotUnavailable(false);
        setError("");
        const items = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .reverse();
        setRecentMessages(items);
      },
      () => {
        setSnapshotUnavailable(true);
        setError("Temps reel indisponible, mode synchronisation active.");
      }
    );

    return () => unsubscribe();
  }, [pasteurId, phoneNumber]);

  useEffect(() => {
    if (!snapshotUnavailable || !discipleId) {
      return undefined;
    }

    let cancelled = false;

    async function pullLatestMessages() {
      try {
        const res = await api.get(`/api/disciples/${encodeURIComponent(discipleId)}/conversations`, {
          params: { limit: PAGE_SIZE }
        });
        if (!cancelled) {
          setRecentMessages(Array.isArray(res.data?.items) ? res.data.items : []);
        }
      } catch {
        // Keep previous messages; polling will retry.
      }
    }

    pullLatestMessages();
    const intervalId = window.setInterval(pullLatestMessages, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [snapshotUnavailable, discipleId]);

  useEffect(() => {
    setProfileOpen(false);
    setProfileError("");
    setProfileData(null);
    setProfileLoading(false);
  }, [discipleId]);

  useEffect(() => {
    unreadAutoJumpDoneRef.current = false;
  }, [discipleId]);

  useEffect(() => {
    if (loadingInitial || unreadAutoJumpDoneRef.current || unreadDiscipleMessages.length === 0) {
      return;
    }

    const lastUnread = unreadDiscipleMessages[unreadDiscipleMessages.length - 1];
    if (!lastUnread?.id) {
      return;
    }

    scrollToMessage(lastUnread.id);
    unreadAutoJumpDoneRef.current = true;
  }, [loadingInitial, unreadDiscipleMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [recentMessages.length]);

  useEffect(() => {
    if (!discipleId || !pasteurId) {
      return;
    }

    if (unreadDiscipleMessages.length === 0 || markingRead) {
      return;
    }

    const unreadIds = new Set(unreadDiscipleMessages.map((item) => item.id));
    setMarkingRead(true);
    setOlderMessages((prev) => prev.map((item) => (unreadIds.has(item.id) ? { ...item, read: true } : item)));
    setRecentMessages((prev) => prev.map((item) => (unreadIds.has(item.id) ? { ...item, read: true } : item)));
    onReadMessages?.({ discipleId, count: unreadDiscipleMessages.length });
    onDiscipleUpdate?.({ id: discipleId, waitingForPastor: false });

    async function markConversationRead() {
      try {
        if (snapshotUnavailable) {
          await api.put(`/api/disciples/${encodeURIComponent(discipleId)}/conversations/read`);
          return;
        }

        const conversationsRef = collection(
          firestore,
          "pasteurs",
          pasteurId,
          "disciples",
          phoneNumber,
          "conversations"
        );
        const unreadQuery = query(
          conversationsRef,
          where("sender", "==", "disciple"),
          where("read", "==", false)
        );
        const unreadSnapshot = await getDocs(unreadQuery);

        if (!unreadSnapshot.empty) {
          const batch = writeBatch(firestore);
          unreadSnapshot.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, { read: true });
          });
          await batch.commit();
        }
      } catch {
        try {
          await api.put(`/api/disciples/${encodeURIComponent(discipleId)}/conversations/read`);
        } catch {
          setError("Impossible de marquer les messages comme lus pour le moment.");
        }
      } finally {
        setMarkingRead(false);
      }
    }

    markConversationRead();
  }, [discipleId, markingRead, onDiscipleUpdate, onReadMessages, pasteurId, phoneNumber, snapshotUnavailable, unreadDiscipleMessages]);

  useEffect(() => {
    if (!emojiOpen) return undefined;
    function handleClickOutside(event) {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) setEmojiOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiOpen]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    function handleClickOutside(event) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) setContextMenu(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  const isOnline = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i -= 1) {
      if (allMessages[i].sender !== "disciple") continue;
      const sentAt = toDate(allMessages[i].sentAt);
      if (!sentAt) return false;
      return Date.now() - sentAt.getTime() <= 5 * 60 * 1000;
    }
    return false;
  }, [allMessages]);

  function insertEmoji(emoji) {
    const element = inputRef.current;
    if (!element) {
      setText((prev) => `${prev}${emoji}`);
      setEmojiOpen(false);
      return;
    }

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(next);
    setEmojiOpen(false);

    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function insertVariable(value) {
    const element = inputRef.current;
    if (!element) {
      setText((prev) => `${prev}${value}`);
      setVariablesOpen(false);
      return;
    }

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const next = `${text.slice(0, start)}${value}${text.slice(end)}`;
    setText(next);
    setVariablesOpen(false);

    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + value.length;
      element.setSelectionRange(cursor, cursor);
    });
  }

  async function openProfilePanel() {
    setProfileOpen(true);
    setProfileError("");

    if (!discipleId || profileLoading) {
      return;
    }

    setProfileLoading(true);
    try {
      const res = await api.get(`/api/disciples/${encodeURIComponent(discipleId)}`);
      setProfileData(res.data || null);
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  }

  function goToProfileEdit() {
    const targetId = profileData?.id || discipleId;
    if (!targetId) {
      return;
    }

    setProfileOpen(false);
    navigate(`/disciples/${encodeURIComponent(targetId)}`);
  }

  async function handleLoadOlder() {
    if (!nextCursor || loadingOlder) {
      return;
    }

    setLoadingOlder(true);
    try {
      await fetchConversationPage(nextCursor);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleTogglePin(message, selectedDurationMinutes = 0) {
    if (!discipleId || !message?.id || pinningId) {
      return;
    }

    const currentlyPinned = Boolean(message.pinned) && isActiveUntil(message.pinnedUntil);
    const nextPinned = !currentlyPinned;
    const durationMinutes = nextPinned ? Number(selectedDurationMinutes || 0) : 0;

    const nextPinnedUntil = nextPinned && durationMinutes > 0
      ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
      : null;

    setPinningId(message.id);
    updateMessageLocally(message.id, (item) => ({
      ...item,
      pinned: nextPinned,
      pinnedAt: nextPinned ? new Date().toISOString() : null,
      pinnedUntil: nextPinnedUntil
    }));

    try {
      const res = await api.put(
        `/api/disciples/${encodeURIComponent(discipleId)}/conversations/${encodeURIComponent(message.id)}/pin`,
        {
          pinned: nextPinned,
          durationMinutes: nextPinned ? durationMinutes : 0
        }
      );
      const updated = res.data || {};
      updateMessageLocally(message.id, (item) => ({ ...item, ...updated }));
    } catch (err) {
      updateMessageLocally(message.id, (item) => ({
        ...item,
        pinned: message.pinned,
        pinnedAt: message.pinnedAt || null,
        pinnedUntil: message.pinnedUntil || null
      }));
      setError(getErrorMessage(err));
    } finally {
      setPinningId("");
      setContextMenu(null);
    }
  }

  function scrollToMessage(messageId) {
    const targetId = String(messageId || "").trim();
    if (!targetId) {
      return;
    }

    const selector = `[data-message-id="${targetId.replace(/"/g, '\\"')}"]`;
    const node = document.querySelector(selector);
    if (!node) {
      return;
    }

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(targetId);
    window.setTimeout(() => {
      setFocusedMessageId((prev) => (prev === targetId ? "" : prev));
    }, 1400);
  }

  function handleMessageTouchStart(messageId, event) {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }

    swipeStateRef.current[messageId] = {
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now()
    };
  }

  function handleMessageTouchEnd(message, event) {
    const touch = event.changedTouches?.[0];
    const start = swipeStateRef.current[message?.id];
    delete swipeStateRef.current[message?.id];

    if (!touch || !start || !message?.id) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaY > 28 || Math.abs(deltaX) < 64) {
      return;
    }

    if (deltaX > 0) {
      setReplyTo(message);
      return;
    }

    if (Boolean(message.pinned) && isActiveUntil(message.pinnedUntil)) {
      handleTogglePin(message, 0);
      return;
    }

    openPinDurationPicker({ type: "message", message });
  }

  async function handleConversationPinToggle(selectedDurationMinutes = 0) {
    if (!discipleId || pinningConversation) {
      return;
    }

    const nextPinned = !conversationPinnedActive;
    const durationMinutes = nextPinned ? Number(selectedDurationMinutes || 0) : 0;

    setPinningConversation(true);
    try {
      const res = await api.put(`/api/disciples/${encodeURIComponent(discipleId)}/pin`, {
        pinned: nextPinned,
        durationMinutes: nextPinned ? durationMinutes : 0
      });

      const updatedDisciple = res.data || {};
      onDiscipleUpdate?.({
        id: updatedDisciple.id || discipleId,
        conversationPinned: Boolean(updatedDisciple.conversationPinned),
        conversationPinnedAt: updatedDisciple.conversationPinnedAt || null,
        conversationPinnedUntil: updatedDisciple.conversationPinnedUntil || null
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPinningConversation(false);
    }
  }

  async function submitPinDuration(minutes) {
    if (!pinDurationPicker) {
      return;
    }

    if (pinDurationPicker.type === "message") {
      await handleTogglePin(pinDurationPicker.message, minutes);
      closePinDurationPicker();
      return;
    }

    await handleConversationPinToggle(minutes);
    closePinDurationPicker();
  }

  async function submitCustomPinDuration() {
    const minutes = Number(customPinMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      setError("Durée invalide. Entre un nombre de minutes (0 = illimité).");
      return;
    }

    await submitPinDuration(Math.floor(minutes));
  }

  async function handleSaveConversationNote() {
    if (!discipleId || savingNote) {
      return;
    }

    setSavingNote(true);
    try {
      await api.put(`/api/disciples/${encodeURIComponent(discipleId)}/conversation-note`, {
        conversationNote
      });
      onDiscipleUpdate?.({ id: discipleId, conversationNote });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSend() {
    setError("");
    const trimmed = text.trim();
    if (!trimmed || !discipleId) return;

    const currentReplyTo = replyTo;
    setText("");
    setReplyTo(null);
    setSending(true);

    try {
      await api.post(`/api/disciples/${encodeURIComponent(discipleId)}/conversations`, {
        content: applyLocalVariables(trimmed, disciple),
        ...(currentReplyTo
          ? { replyTo: { id: currentReplyTo.id, content: currentReplyTo.content, sender: currentReplyTo.sender } }
          : {})
      });
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      onDiscipleUpdate?.({ id: discipleId, waitingForPastor: false });
    } catch (err) {
      setText(trimmed);
      setReplyTo(currentReplyTo);
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleDocumentSelected(event) {
    const file = event.target.files?.[0];
    if (!file || !discipleId || !pasteurId) {
      return;
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      setError("Fichier trop volumineux. Limite: 16 Mo (comme WhatsApp).");
      event.target.value = "";
      return;
    }

    setError("");
    setUploadingDocument(true);
    setUploadProgress(0);

    const currentReplyTo = replyTo;
    const typedText = text.trim();

    try {
      const safeName = String(file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `chat-docs/${pasteurId}/${discipleId}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      const downloadUrl = await uploadFileWithProgress(storageRef, file, {
        timeoutMs: UPLOAD_TIMEOUT_MS,
        onProgress: (percent) => setUploadProgress(percent)
      });

      const content = typedText || `${isImageMimeType(file.type) ? "Image" : "Document"}: ${file.name}`;
      await api.post(`/api/disciples/${encodeURIComponent(discipleId)}/conversations`, {
        content: applyLocalVariables(content, disciple),
        mediaUrl: [downloadUrl],
        mediaMeta: {
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size
        },
        ...(currentReplyTo
          ? { replyTo: { id: currentReplyTo.id, content: currentReplyTo.content, sender: currentReplyTo.sender } }
          : {})
      });

      setText("");
      setReplyTo(null);
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      onDiscipleUpdate?.({ id: discipleId, waitingForPastor: false });
    } catch (err) {
      if (err?.code === "storage/canceled") {
        setError("Import annulé ou interrompu. Réessaie avec une connexion stable.");
      } else {
        setError(getErrorMessage(err) || "Échec de l'import du document.");
      }
    } finally {
      setUploadingDocument(false);
      setUploadProgress(0);
      event.target.value = "";
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const frameStyle =
    theme === "dark"
      ? {
          background: "linear-gradient(180deg, #0E111B 0%, #141925 100%)",
          borderColor: "#283046",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.35)"
        }
      : {
          background: "linear-gradient(180deg, #F6FAFF 0%, #EEF3FF 100%)",
          borderColor: "#B9C8F9",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 24px rgba(40,84,158,0.08)"
        };

  const headerStyle =
    theme === "dark"
      ? {
          background: "linear-gradient(90deg, #131B2C 0%, #1A2135 100%)",
          borderColor: "#2F3B59"
        }
      : {
          background: "linear-gradient(90deg, #FFFFFF 0%, #F2F7FF 100%)",
          borderColor: "#C6D6FF"
        };

  const messagesPanelStyle =
    theme === "dark"
      ? {
          background:
            "radial-gradient(circle at 15% 20%, rgba(52,119,255,0.10), transparent 28%), radial-gradient(circle at 85% 85%, rgba(16,185,129,0.08), transparent 24%)"
        }
      : {
          background:
            "radial-gradient(circle at 12% 20%, rgba(37,99,235,0.10), transparent 26%), radial-gradient(circle at 88% 82%, rgba(20,184,166,0.10), transparent 24%)"
        };

  const discipleBubbleStyle =
    theme === "dark"
      ? {
          background: "linear-gradient(160deg, #1E2638 0%, #1A2234 100%)",
          color: "#E8F1FF",
          borderRadius: "0 14px 14px 14px",
          border: "1px solid #2E3B58"
        }
      : {
          background: "linear-gradient(160deg, #FFFFFF 0%, #F5F9FF 100%)",
          color: "#0F1C3D",
          borderRadius: "0 14px 14px 14px",
          border: "1px solid #C9D9FF"
        };

  const pastorBubbleStyle = {
    background: "linear-gradient(140deg, #2563EB 0%, #1D4ED8 45%, #1E40AF 100%)",
    color: "#FFFFFF",
    borderRadius: "14px 0 14px 14px",
    boxShadow: "0 8px 18px rgba(29,78,216,0.28)"
  };

  const inputStyle =
    theme === "dark"
      ? { backgroundColor: "#151D2D", borderColor: "#2D3A58", color: "#EAF1FF" }
      : { backgroundColor: "#FFFFFF", borderColor: "#BFD3FF", color: "#0F1C3D" };

  const composerWrapStyle =
    theme === "dark"
      ? {
          background: "linear-gradient(180deg, #141B2B 0%, #101726 100%)",
          borderColor: "#2F3A56"
        }
      : {
          background: "linear-gradient(180deg, #FFFFFF 0%, #F4F8FF 100%)",
          borderColor: "#C8D8FF"
        };

  const messagesZoneStyle = {
    ...messagesPanelStyle,
    WebkitOverflowScrolling: "touch"
  };

  const inputZoneStyle = {
    ...composerWrapStyle,
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
    bottom: 0,
    zIndex: 5
  };

  return (
    <div className={`chat-container relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border ${className}`} style={frameStyle}>
      {showHeader ? (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-3 sm:gap-3 sm:px-4" style={headerStyle}>
          {/* Info du disciple + statut */}
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border text-theme-text2 hover:text-theme-text1 md:hidden"
                aria-label="Retour aux conversations"
              >
                <ChevronLeft size={16} />
              </button>
            ) : null}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-theme-text1">{disciple?.name || "Disciple"}</p>
                {disciple?.waitingForPastor ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    En attente
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-theme-text2">
                <span className="sm:hidden">
                  {stripWhatsAppPrefix(disciple?.displayPhone || disciple?.phoneNumber || discipleId || "").slice(0, 5)}...
                </span>
                <span className="hidden sm:inline">
                  {stripWhatsAppPrefix(disciple?.displayPhone || disciple?.phoneNumber || discipleId || "")}
                </span>
              </p>
            </div>
          </div>

          {/* Boutons d'actions + statut */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-theme-border text-theme-text2 hover:text-theme-text1"
              title="Rechercher"
            >
              <Search size={15} />
            </button>
            <button
              type="button"
              onClick={() => setNoteOpen((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-theme-border text-theme-text2 hover:text-theme-text1"
              title="Note privée (sauvegardée auto)"
            >
              <StickyNote size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (conversationPinnedActive) {
                  handleConversationPinToggle(0);
                } else {
                  openPinDurationPicker({ type: "conversation" });
                }
              }}
              disabled={pinningConversation}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-theme-border ${conversationPinnedActive ? "text-amber-500" : "text-theme-text2"} hover:text-theme-text1 disabled:opacity-60`}
              title={conversationPinnedActive ? "Retirer l'épinglage" : "Épingler"}
            >
              <Pin size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (profileOpen) {
                  setProfileOpen(false);
                  return;
                }
                openProfilePanel();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-theme-border text-theme-text2 hover:text-theme-text1"
              title="Voir le profil"
            >
              <UserRound size={15} />
            </button>

            {/* Statut discret */}
            <div className="relative ml-1 shrink-0 group">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-slate-400"}`}
                title={isOnline ? "En ligne" : "Hors ligne"}
              />
              <span className="absolute right-0 top-full mt-1 hidden rounded-md bg-theme-bg px-2 py-1 text-[10px] text-theme-text2 whitespace-nowrap group-hover:block">
                {isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {unreadDiscipleMessages.length > 0 ? (
        <div className="flex items-center justify-end border-b border-theme-border px-3 py-2 text-[11px] sm:px-4" style={headerStyle}>
          <button
            type="button"
            onClick={() => scrollToMessage(unreadDiscipleMessages[unreadDiscipleMessages.length - 1]?.id)}
            className="rounded-full border border-theme-border px-2 py-0.5 text-theme-text2 hover:text-theme-text1"
          >
            Aller au dernier non lu ({unreadDiscipleMessages.length})
          </button>
        </div>
      ) : null}

      {conversationPinnedActive ? (
        <div className="border-b border-theme-border px-4 py-1.5 text-[11px] text-amber-500" style={headerStyle}>
          <span className="inline-flex items-center gap-1">
            <Pin size={11} /> {formatPinUntil(disciple?.conversationPinnedUntil)}
          </span>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="border-b border-theme-border px-3 py-3 sm:px-4" style={headerStyle}>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-theme-border px-3 py-2" style={inputStyle}>
            <Search size={14} className="text-theme-text2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un mot, un verset, une réponse..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              style={{ color: inputStyle.color }}
            />
            {search ? (
              <span className="w-full text-[11px] text-theme-text2 sm:w-auto">
                {filteredMessages.length} résultat{filteredMessages.length > 1 ? "s" : ""}
              </span>
            ) : null}
            <button type="button" onClick={() => setSearch("")} className="text-theme-text2 hover:text-theme-text1">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {noteOpen ? (
        <div className="border-b border-theme-border px-3 py-3 sm:px-4" style={headerStyle}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-theme-text2 mb-1">📝 Note privée</p>
              <p className="text-[10px] text-theme-text2/70 italic">Visible par toi seulement. Sauvegarde auto.</p>
            </div>
            {savingNote ? (
              <span className="shrink-0 text-[10px] text-amber-500 whitespace-nowrap">Sauvegarde...</span>
            ) : null}
          </div>
          <textarea
            value={conversationNote}
            onChange={(event) => setConversationNote(event.target.value)}
            onBlur={handleSaveConversationNote}
            rows={3}
            placeholder="Résumé pastoral, point à relancer, sujet sensible, contexte personnel..."
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>
      ) : null}

      {pinnedMessages.length > 0 ? (
        <div className="border-b border-theme-border px-3 py-2 sm:px-4" style={headerStyle}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-theme-text2">
            <Pin size={13} />
            {pinnedMessages.length} message{pinnedMessages.length > 1 ? "s" : ""} épinglé{pinnedMessages.length > 1 ? "s" : ""}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pinnedMessages.map((message) => (
              <button
                key={`pin-${message.id}`}
                type="button"
                onClick={() => scrollToMessage(message.id)}
                className="min-w-[200px] rounded-lg border border-theme-border px-3 py-2 text-left text-xs sm:min-w-[220px]"
                style={theme === "dark" ? { backgroundColor: "#141320" } : { backgroundColor: "#FFFFFF" }}
              >
                <p className="mb-1 line-clamp-2 text-theme-text1">{message.content}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-theme-text2">{toDate(message.sentAt) ? formatHour(toDate(message.sentAt)) : ""}</p>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleTogglePin(message, 0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        handleTogglePin(message, 0);
                      }
                    }}
                    className="rounded-md border border-theme-border px-2 py-0.5 text-[11px] text-theme-text2 hover:text-theme-text1"
                  >
                    Désépingler
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="messages-zone flex-1 overflow-y-auto px-2 py-3 sm:px-4" style={messagesZoneStyle}>
        {hasMore ? (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-theme-border px-3 py-1 text-xs text-theme-text2 disabled:opacity-60"
            >
              {loadingOlder ? "Chargement..." : "Charger les messages plus anciens"}
            </button>
          </div>
        ) : null}

        {loadingInitial ? (
          <p className="text-sm text-theme-text2">Chargement de la conversation...</p>
        ) : grouped.length === 0 ? (
          <>
            <div className="flex flex-col items-center gap-2 py-8 text-center text-theme-text2">
              <MessageSquare size={28} className="opacity-60" />
              <p className="text-sm">{search ? "Aucun message ne correspond à ta recherche." : "Aucun message pour le moment."}</p>
            </div>
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="space-y-2">
            {grouped.map((entry) => {
              if (entry.type === "separator") {
                return (
                  <div key={entry.id} className="my-3 flex items-center gap-3 text-xs text-theme-text2">
                    <span className="h-px flex-1 bg-theme-border" />
                    <span>{entry.label}</span>
                    <span className="h-px flex-1 bg-theme-border" />
                  </div>
                );
              }

              const message = entry.item;
              const isPastor = message.sender === "pastor";
              const sentAt = toDate(message.sentAt);
              const delivery = getDeliveryMeta(message);
              const messagePinned = Boolean(message.pinned) && isActiveUntil(message.pinnedUntil);

              if (message.type === "typing") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="px-4 py-3" style={pastorBubbleStyle}>
                      <div className="flex items-center gap-1">
                        <span className="typing-dot" style={{ animationDelay: "0ms" }} />
                        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
                        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className={`group flex items-end gap-1 transition-all ${isPastor ? "justify-end" : "justify-start"} ${focusedMessageId === message.id ? "rounded-lg ring-2 ring-cyan-400/70" : ""}`}
                >
                  {isPastor ? (
                    <button
                      type="button"
                      title="Répondre"
                      onClick={() => setReplyTo(message)}
                      className="mb-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <CornerUpLeft size={14} className="text-theme-text2" />
                    </button>
                  ) : null}

                  <div className={`max-w-[90%] sm:max-w-[80%] ${isPastor ? "items-end" : "items-start"} flex flex-col`}>
                    <div
                      className={`px-3 py-2 text-sm ${messagePinned ? "ring-1 ring-amber-400/60" : ""}`}
                      style={
                        isPastor
                          ? pastorBubbleStyle
                          : discipleBubbleStyle
                      }
                      onTouchStart={(event) => handleMessageTouchStart(message.id, event)}
                      onTouchEnd={(event) => handleMessageTouchEnd(message, event)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContextMenu({ x: event.clientX, y: event.clientY, message });
                      }}
                    >
                      {messagePinned ? (
                        <div className={`mb-1 inline-flex items-center gap-1 text-[10px] font-semibold ${isPastor ? "text-amber-100" : "text-amber-500"}`}>
                          <Pin size={10} /> {formatPinUntil(message.pinnedUntil)}
                        </div>
                      ) : null}

                      {message.replyTo ? (
                        <div className={`mb-2 rounded border-l-2 px-2 py-1 text-xs ${isPastor ? "border-white/40 bg-white/10" : "border-[#6C3FE8]/40 bg-[#6C3FE8]/10"}`}>
                          <p className={`mb-0.5 truncate font-semibold ${isPastor ? "text-white/70" : "text-[#6C3FE8]"}`}>
                            {message.replyTo.sender === "pastor" ? "Vous" : normalizeFirstName(disciple?.name) || "Disciple"}
                          </p>
                          <p className="truncate opacity-80">{renderHighlightedText(message.replyTo.content, search)}</p>
                        </div>
                      ) : null}

                      <p className="whitespace-pre-wrap break-words">{renderHighlightedText(message.content, search)}</p>

                      {Array.isArray(message.mediaUrl) && message.mediaUrl.length > 0 ? (
                        <div className={`mt-2 rounded-lg border px-2 py-1.5 text-xs ${isPastor ? "border-white/25 bg-white/10" : "border-theme-border bg-theme-bg"}`}>
                          {isImageMimeType(message.mediaMeta?.mimeType) ? (
                            <a href={message.mediaUrl[0]} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={message.mediaUrl[0]}
                                alt={message.mediaMeta?.name || "Image"}
                                className="max-h-56 w-auto rounded-md object-cover"
                                loading="lazy"
                              />
                            </a>
                          ) : null}
                          <a
                            href={message.mediaUrl[0]}
                            target="_blank"
                            rel="noreferrer"
                            className={`font-semibold underline ${isPastor ? "text-white" : "text-[#6C3FE8]"} ${isImageMimeType(message.mediaMeta?.mimeType) ? "mt-1 inline-block" : ""}`}
                          >
                            {message.mediaMeta?.name || "Voir le document"}
                          </a>
                          {message.mediaMeta?.size ? (
                            <p className={`${isPastor ? "text-white/70" : "text-theme-text2"}`}>{formatFileSize(message.mediaMeta.size)}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {isPastor && message.deliveryStatus === "failed" && message.errorMessage ? (
                        <p className="mt-1 text-[11px] text-red-200">{message.errorMessage}</p>
                      ) : null}

                      <div className={`mt-1 flex items-center gap-1 text-[11px] ${isPastor ? "text-white/80" : "text-theme-text2"}`}>
                        <span>{sentAt ? formatHour(sentAt) : ""}</span>
                        {isPastor ? (
                          <span className={`inline-block ${delivery.className}`} title={delivery.label}>
                            {delivery.icon}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {message.type === "checkin" ? (
                      <p className="mt-1 text-[10px] text-theme-text2">📋 Check-in</p>
                    ) : null}
                  </div>

                  {!isPastor ? (
                    <button
                      type="button"
                      title="Répondre"
                      onClick={() => setReplyTo(message)}
                      className="mb-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <CornerUpLeft size={14} className="text-theme-text2" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="input-zone sticky border-t p-2 sm:p-3" style={inputZoneStyle}>
        {error ? <p className="mb-2 text-xs text-red-500">{error}</p> : null}

        {draftStorageKey && text.trim() ? (
          <p className="mb-2 text-[11px] text-theme-text2">Brouillon enregistré automatiquement</p>
        ) : null}

        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-theme-border bg-theme-bg px-3 py-2">
            <CornerUpLeft size={14} className="shrink-0 text-[#6C3FE8]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#6C3FE8]">
                {replyTo.sender === "pastor" ? "Vous" : normalizeFirstName(disciple?.name) || "Disciple"}
              </p>
              <p className="truncate text-xs text-theme-text2">{replyTo.content}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 text-theme-text2 hover:text-theme-text1">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={handleDocumentSelected}
          />
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setVariablesOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-lg border border-theme-border px-2 py-2 text-xs text-theme-text2"
              >
                Variables
                <ChevronDown size={12} />
              </button>

              {variablesOpen ? (
                <div className="absolute bottom-11 left-0 z-10 w-40 max-w-[calc(100vw-2rem)] rounded-lg border border-theme-border bg-theme-surface p-1 shadow-lg">
                  {["[prénom]", "[pays]", "[église]"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => insertVariable(item)}
                      className="block w-full rounded-md px-2 py-1 text-left text-xs text-theme-text1 hover:bg-theme-bg"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div ref={emojiRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setEmojiOpen((prev) => !prev)}
                className="inline-flex items-center justify-center rounded-lg border border-theme-border p-2 text-theme-text2 hover:text-theme-text1"
              >
                <Smile size={16} />
              </button>

              {emojiOpen ? (
                <div className="absolute bottom-11 left-0 z-10 w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-theme-border bg-theme-surface p-2 shadow-lg">
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="flex items-center justify-center rounded p-1 text-base hover:bg-theme-bg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDocument || sending}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-theme-border p-2 text-theme-text2 hover:text-theme-text1 disabled:opacity-60"
              title="Importer et envoyer un document"
            >
              <Paperclip size={16} />
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:flex-1">
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrire un message..."
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || uploadingDocument || !text.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#6C3FE8] text-white disabled:opacity-60"
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        {uploadingDocument ? (
          <p className="mt-2 text-[11px] text-theme-text2">
            Import du document en cours... {uploadProgress > 0 ? `${uploadProgress}%` : ""}
          </p>
        ) : null}
      </div>

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border border-theme-border bg-theme-surface p-1 shadow-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            onClick={() => {
              setReplyTo(contextMenu.message);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-theme-text1 hover:bg-theme-bg"
          >
            <CornerUpLeft size={13} />
            Répondre
          </button>
          <button
            type="button"
            onClick={() => {
              const isPinned = Boolean(contextMenu.message?.pinned) && isActiveUntil(contextMenu.message?.pinnedUntil);
              if (isPinned) {
                handleTogglePin(contextMenu.message, 0);
              } else {
                openPinDurationPicker({ type: "message", message: contextMenu.message });
                setContextMenu(null);
              }
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-theme-text1 hover:bg-theme-bg"
          >
            <Pin size={13} />
            {contextMenu.message?.pinned && isActiveUntil(contextMenu.message?.pinnedUntil) ? "Désépingler" : "Épingler (durée...)"}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.message.content).catch(() => {});
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-theme-text1 hover:bg-theme-bg"
          >
            <span className="text-[13px]">📋</span>
            Copier
          </button>
        </div>
      ) : null}

      {pinDurationPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl border border-theme-border bg-theme-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-theme-text1">Durée d'épinglage</p>
              <button
                type="button"
                onClick={closePinDurationPicker}
                className="rounded-md p-1 text-theme-text2 hover:text-theme-text1"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {PIN_DURATION_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => submitPinDuration(option.minutes)}
                  className="rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text1 hover:bg-theme-bg"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={customPinMinutes}
                onChange={(event) => setCustomPinMinutes(event.target.value)}
                placeholder="Minutes personnalisées"
                className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1 outline-none"
              />
              <button
                type="button"
                onClick={submitCustomPinDuration}
                className="rounded-lg bg-[#6C3FE8] px-3 py-2 text-sm font-medium text-white"
              >
                OK
              </button>
            </div>

            <p className="text-[11px] text-theme-text2">0 = épinglage illimité</p>
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <>
          <button
            type="button"
            aria-label="Fermer le panneau profil"
            onClick={() => setProfileOpen(false)}
            className="absolute inset-0 z-30 bg-black/30"
          />

          <aside
            className="absolute inset-0 z-40 w-full border-0 bg-theme-surface p-4 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-w-sm md:border-l"
            style={{
              background: theme === "dark"
                ? "linear-gradient(180deg, #111827 0%, #0b1220 100%)"
                : "linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%)"
            }}
          >
            <div
              className="sticky top-0 z-10 mb-3 -mx-4 flex items-center justify-between border-b px-4 py-2"
              style={{
                borderColor: "var(--border)",
                background: theme === "dark" ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(8px)"
              }}
            >
              <p className="text-sm font-semibold text-theme-text1">Infos du disciple</p>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-md p-1 text-theme-text2 hover:text-theme-text1"
              >
                <X size={14} />
              </button>
            </div>

            {profileLoading ? (
              <p className="text-sm text-theme-text2">Chargement du profil...</p>
            ) : null}

            {profileError ? (
              <p className="mb-3 text-xs text-red-500">{profileError}</p>
            ) : null}

            <div className="space-y-2 overflow-y-auto pb-20" style={{ maxHeight: "calc(100dvh - 200px)" }}>
              {profileFields.map((field) => (
                <div key={field.label} className="rounded-lg border border-theme-border bg-theme-bg px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-text2">{field.label}</p>
                  <p className="text-sm text-theme-text1">{field.value}</p>
                </div>
              ))}
            </div>

            <div
              className="sticky bottom-0 z-10 mt-4 -mx-4 flex justify-end gap-2 border-t px-4 py-3"
              style={{
                borderColor: "var(--border)",
                background: theme === "dark" ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(8px)"
              }}
            >
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text1"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={goToProfileEdit}
                className="rounded-lg bg-[#6C3FE8] px-3 py-2 text-sm font-medium text-white"
              >
                Modifier
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

export default ConversationPane;
