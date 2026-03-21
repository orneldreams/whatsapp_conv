import { useState } from "react";
import api, { getErrorMessage } from "../api/client";
import { useTheme } from "../context/ThemeContext";

function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggleTheme } = useTheme();

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      localStorage.setItem("dashboardPassword", password);
      await api.get("/api/auth/check");
      onLogin(password);
    } catch (err) {
      localStorage.removeItem("dashboardPassword");
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={theme}>
      <div className="flex min-h-screen items-center justify-center bg-theme-bg px-4">
        <button
          onClick={toggleTheme}
          className="absolute right-4 top-4 rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text2"
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-xl border border-theme-border bg-theme-surface p-6 shadow-lg"
        >
          <h1 className="mb-2 text-2xl font-semibold text-theme-text1">DiscipLink</h1>
          <p className="mb-4 text-sm text-theme-text2">Entrez le mot de passe du dashboard</p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded-lg border border-theme-border bg-transparent px-3 py-2 text-theme-text1"
            placeholder="Mot de passe"
            required
          />

          {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Verification..." : "Connexion"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
