import { useEffect, useMemo, useRef, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import { useTheme } from "../context/ThemeContext";

function ManualCheckinModal({ isOpen, onClose, disciples = [], preselectedDiscipleId }) {
  const { theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);

  const normalizedDisciples = useMemo(
    () =>
      disciples.map((disciple) => {
        const id = disciple.id || disciple.discipleId;
        return {
          ...disciple,
          id,
          name: disciple.name || "Inconnu",
          phone: disciple.phoneNumber || disciple.phone || id || ""
        };
      }),
    [disciples]
  );

  const allIds = useMemo(() => normalizedDisciples.map((d) => d.id).filter(Boolean), [normalizedDisciples]);

  const selectedDisciples = useMemo(
    () => normalizedDisciples.filter((disciple) => selectedIds.includes(disciple.id)),
    [normalizedDisciples, selectedIds]
  );

  const silentIds = useMemo(() => {
    const now = new Date();
    return normalizedDisciples
      .filter((disciple) => {
        if (disciple.status === "Silencieux") return true;
        if (!disciple.lastContact) return true;
        const last = new Date(disciple.lastContact);
        if (Number.isNaN(last.getTime())) return false;
        const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 3;
      })
      .map((disciple) => disciple.id);
  }, [normalizedDisciples]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (preselectedDiscipleId) {
      setSelectedIds([preselectedDiscipleId]);
    } else {
      setSelectedIds([]);
    }
    setDropdownOpen(false);
    setError("");
    setToast("");
  }, [preselectedDiscipleId, isOpen]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    function onPointerDown(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function getFirstName(name) {
    if (!name) return "?";
    return String(name).trim().split(/\s+/)[0] || "?";
  }

  function toggleOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.length === allIds.length ? [] : allIds));
  }

  function selectSilentOnly() {
    setSelectedIds(silentIds);
  }

  function removeSelected(id) {
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  }

  const sendDisabled = sending || selectedIds.length === 0 || !message.trim();

  if (!isOpen) {
    return null;
  }

  async function handleSend(event) {
    event.preventDefault();
    setError("");
    setToast("");

    if (selectedIds.length === 0 || !message.trim()) {
      setError("Selectionne au moins un disciple et saisis un message");
      return;
    }

    setSending(true);
    try {
      const payloadMessage = message.trim();
      const results = await Promise.allSettled(
        selectedIds.map((discipleId) =>
          api.post("/api/checkins/send", {
            discipleId,
            message: payloadMessage
          })
        )
      );

      const sentCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - sentCount;

      if (sentCount > 0) {
        setToast(`Message envoye a ${sentCount} disciple${sentCount > 1 ? "s" : ""} ✓`);
      }

      if (failedCount > 0) {
        setError(`${failedCount} envoi(s) ont echoue. Reessaie.`);
      }

      setMessage("");
      if (failedCount === 0) {
        setSelectedIds([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const panelStyle =
    theme === "dark"
      ? { backgroundColor: "#1A1825", borderColor: "#2D2A3E" }
      : { backgroundColor: "#FFFFFF", borderColor: "#E5E1FF" };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      {toast ? (
        <div className="pointer-events-none absolute right-4 top-4 z-50 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 shadow-lg">
          {toast}
        </div>
      ) : null}

      <div
        className="w-full max-w-xl rounded-xl border p-5 shadow-xl"
        style={panelStyle}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text1">Check-in manuel</h3>
          <button
            className="rounded-md border border-theme-border px-3 py-1 text-sm text-theme-text2"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-theme-text2">Disciples</label>

            {selectedDisciples.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedDisciples.map((disciple) => (
                  <span
                    key={disciple.id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-theme-text1"
                    style={panelStyle}
                  >
                    {getFirstName(disciple.name)}
                    <button
                      type="button"
                      onClick={() => removeSelected(disciple.id)}
                      className="text-theme-text2 hover:text-theme-text1"
                      aria-label={`Retirer ${disciple.name}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-theme-text1"
                style={panelStyle}
              >
                <span>
                  {selectedIds.length === 0
                    ? "Selectionner un ou plusieurs disciples"
                    : `${selectedIds.length} selectionne(s)`}
                </span>
                <span className="text-theme-text2">▾</span>
              </button>

              {dropdownOpen ? (
                <div
                  className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
                  style={panelStyle}
                >
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-theme-text1 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px]"
                      style={{
                        borderColor: "#2D2A3E",
                        backgroundColor: selectedIds.length === allIds.length && allIds.length > 0 ? "#6C3FE8" : "transparent",
                        color: "#FFFFFF"
                      }}
                    >
                      {selectedIds.length === allIds.length && allIds.length > 0 ? "✓" : ""}
                    </span>
                    <span>Tous les disciples</span>
                  </button>

                  <button
                    type="button"
                    onClick={selectSilentOnly}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-theme-text1 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px]"
                      style={{
                        borderColor: "#2D2A3E",
                        backgroundColor:
                          selectedIds.length > 0 && selectedIds.length === silentIds.length &&
                          selectedIds.every((id) => silentIds.includes(id))
                            ? "#6C3FE8"
                            : "transparent",
                        color: "#FFFFFF"
                      }}
                    >
                      {selectedIds.length > 0 && selectedIds.length === silentIds.length &&
                      selectedIds.every((id) => silentIds.includes(id))
                        ? "✓"
                        : ""}
                    </span>
                    <span>Silencieux uniquement</span>
                  </button>

                  <div className="my-1 border-t border-theme-border" />

                  {normalizedDisciples.map((disciple) => {
                    const checked = selectedIds.includes(disciple.id);
                    return (
                      <button
                        key={disciple.id}
                        type="button"
                        onClick={() => toggleOne(disciple.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-theme-text1 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px]"
                          style={{
                            borderColor: "#2D2A3E",
                            backgroundColor: checked ? "#6C3FE8" : "transparent",
                            color: "#FFFFFF"
                          }}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span className="flex-1">
                          {disciple.name}
                          <span className="ml-1 text-xs text-theme-text2">({disciple.phone})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-theme-text2">{selectedIds.length} disciple(s) selectionne(s)</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-theme-text2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-28 w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
              placeholder="Ecris un message pastoral..."
            />
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <button
            disabled={sendDisabled}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
          >
            {sending
              ? "Envoi..."
              : `Envoyer a ${selectedIds.length} disciple${selectedIds.length > 1 ? "s" : ""}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ManualCheckinModal;
