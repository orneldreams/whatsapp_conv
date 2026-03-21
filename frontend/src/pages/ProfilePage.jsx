import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import CountrySelect from "../components/CountrySelect";
import PhoneInput from "../components/PhoneInput";

function ProfilePage({ onLogout }) {
  const { profile, saveProfile, changePassword } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    country: ""
  });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setForm({
      firstName: profile.firstName || profile.displayName?.split(" ")[0] || "",
      lastName: profile.lastName || profile.displayName?.split(" ").slice(1).join(" ") || "",
      phone: profile.phone || "",
      country: profile.country || ""
    });
  }, [profile]);

  async function handleSave(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await saveProfile(form);
      setSuccess("Profil mis a jour.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();
    setPasswordLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!password || password.length < 6) {
        throw new Error("Le mot de passe doit contenir au moins 6 caracteres.");
      }
      if (password !== passwordConfirm) {
        throw new Error("La confirmation du mot de passe ne correspond pas.");
      }

      await changePassword(password);
      setPassword("");
      setPasswordConfirm("");
      setSuccess("Mot de passe mis a jour.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <Layout title="Profil" onLogout={onLogout}>
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-theme-border bg-theme-surface p-5 shadow-card"
        >
          <h2 className="mb-4 text-lg font-semibold">Informations pasteur</h2>
          <div className="space-y-4">
            <input
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              placeholder="Prenom"
              className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2"
              required
            />
            <input
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              placeholder="Nom"
              className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2"
            />
            <PhoneInput
              value={form.phone}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />
            <CountrySelect
              value={form.country}
              onChange={(value) => setForm((prev) => ({ ...prev, country: value }))}
              placeholder="Pays"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {loading ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </form>

        <form
          onSubmit={handlePasswordUpdate}
          className="rounded-xl border border-theme-border bg-theme-surface p-5 shadow-card"
        >
          <h2 className="mb-4 text-lg font-semibold">Securite</h2>
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2"
              required
            />
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirmer le mot de passe"
              className="w-full rounded-lg border border-theme-border bg-transparent px-3 py-2"
              required
            />
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full rounded-lg border border-theme-border px-4 py-2 font-medium disabled:opacity-60"
            >
              {passwordLoading ? "Mise a jour..." : "Mettre a jour le mot de passe"}
            </button>
          </div>
        </form>
      </div>

      {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-500">{success}</p> : null}
    </Layout>
  );
}

export default ProfilePage;
