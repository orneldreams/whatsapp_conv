import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api/client";
import { useTheme } from "../context/ThemeContext";

function SingleDiscipleCheckinModal({ isOpen, onClose, disciple }) {
  const { theme } = useTheme();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setMessage("");
    setError("");
    setSuccess("");
  }, [isOpen, disciple?.id]);

  if (!isOpen || !disciple) {
    return null;
  }

  const firstName = String(disciple.name || "ce disciple").trim().split(/\s+/)[0];

  async function handleSend(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!message.trim()) {
      setError("Saisis un message");
      return;
    }

    setSending(true);
    try {
      await api.post("/api/checkins/send", {
        discipleId: disciple.id || disciple.discipleId,
        message: message.trim()
      });

      setSuccess("Message envoye avec succes");
      setMessage("");
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
      <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl" style={panelStyle}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text1">Check-in a {firstName}</h3>
          <button
            className="rounded-md border border-theme-border px-3 py-1 text-sm text-theme-text2"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium text-theme-text2">Disciple</p>
            <div className="rounded-lg border px-3 py-2 text-sm text-theme-text1" style={panelStyle}>
              {disciple.name || "Inconnu"}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-theme-text2">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="h-28 w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-sm text-theme-text1"
              placeholder="Ecris un message pastoral..."
            />
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

          <button
            disabled={sending || !message.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
          >
            {sending ? "Envoi..." : `Envoyer a ${firstName}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SingleDiscipleCheckinModal;
