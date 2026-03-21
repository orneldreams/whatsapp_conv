import { useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { forgotPassword } = useAuth();
  const { theme } = useTheme();

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await forgotPassword(email.trim());
      setSuccess("Email de reinitialisation envoye.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={theme}>
      <div className="flex min-h-screen items-center justify-center bg-theme-bg px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-xl border border-theme-border bg-theme-surface p-6 shadow-lg"
        >
          <h1 className="mb-2 text-2xl font-semibold text-theme-text1">Mot de passe oublie</h1>
          <p className="mb-4 text-sm text-theme-text2">Entre ton email pour recevoir un lien.</p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-theme-text1"
            placeholder="Email"
            required
          />

          {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
          {success ? <p className="mb-3 text-sm text-emerald-500">{success}</p> : null}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Envoi..." : "Envoyer le lien"}
          </button>

          <p className="mt-3 text-center text-sm text-theme-text2">
            <Link to="/login" className="text-brand-600 hover:underline">
              Retour a la connexion
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
