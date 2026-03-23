import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Bell,
  CalendarClock,
  ChartColumn,
  CircleCheckBig,
  SendHorizontal,
  TriangleAlert,
  Users
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import api, { getErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import ManualCheckinModal from "../components/ManualCheckinModal";
import { formatCountryWithFlag } from "../utils/countries";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

function formatShortDate(value) {
  if (!value) return "";
  return dayjs(value).isValid() ? dayjs(value).format("DD/MM") : String(value);
}

function formatShortTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function OverviewPage({ onLogout }) {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [disciples, setDisciples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [preselectedDiscipleId, setPreselectedDiscipleId] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");

      try {
        const [statsRes, disciplesRes] = await Promise.all([
          api.get("/api/stats"),
          api.get("/api/disciples")
        ]);
        setStats(statsRes.data);
        setDisciples(disciplesRes.data.items || []);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const silentList = useMemo(() => stats?.silentDisciples || [], [stats]);
  const recentResponses = useMemo(() => stats?.recentResponses || [], [stats]);
  const firstName = profile?.firstName || profile?.displayName?.split(" ")[0] || user?.displayName?.split(" ")[0] || "Pasteur";
  const greetingTitle = `Bonjour, ${firstName} 👋`;
  const greetingSubtitle = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <Layout title={greetingTitle} subtitle={greetingSubtitle} onLogout={onLogout}>
      {loading ? <p className="py-10 text-theme-muted">Chargement...</p> : null}
      {error ? <p className="py-10 text-red-500">{error}</p> : null}

      {!loading && !error && stats ? (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users size={18} />} label="Total disciples" value={stats.totalDisciples} tone="primary" />
            <StatCard icon={<CircleCheckBig size={18} />} label="Actifs aujourd'hui" value={stats.activeToday} tone="success" />
            <StatCard icon={<TriangleAlert size={18} />} label="Silencieux +3j" value={stats.silentOver3Days} tone="warning" />
            <StatCard
              icon={<CalendarClock size={18} />}
              label="Prochain check-in"
              value={formatDateTime(stats.nextCheckin)}
              tone="danger"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-theme-border bg-theme-surface p-4 shadow-card lg:col-span-2">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <ChartColumn size={18} className="text-[#6C3FE8]" />
                Taux de réponse sur 7 jours
              </h3>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dailyResponseRate || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4B556333" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(value) => formatShortDate(value)} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme === "dark" ? "#1A1825" : "#FFFFFF",
                        border: `1px solid ${theme === "dark" ? "#2D2A3E" : "#C4B5FD"}`,
                        borderRadius: "12px",
                        color: theme === "dark" ? "#F0EEFF" : "#1a1040"
                      }}
                      labelStyle={{ color: theme === "dark" ? "#F0EEFF" : "#1a1040", fontWeight: 600 }}
                      itemStyle={{ color: theme === "dark" ? "#F0EEFF" : "#1a1040" }}
                      formatter={(value) => [`${value}%`, "Taux de réponse"]}
                    />
                    <Bar dataKey="rate" fill="#6C3FE8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-theme-border bg-theme-surface p-4 shadow-card">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <Bell size={18} className="text-[#6C3FE8]" />
                Alertes silencieux
              </h3>
              <div className="space-y-3">
                {silentList.length === 0 ? (
                  <p className="text-[14px] text-theme-muted">Aucune alerte.</p>
                ) : (
                  silentList.map((disciple) => (
                    <div key={disciple.discipleId} className="rounded-lg border border-theme-border p-3">
                      <p className="text-[14px] font-semibold">{disciple.name}</p>
                      <p className="text-[12px] text-theme-muted">{disciple.displayPhone || disciple.phone}</p>
                      <button
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-[12px] text-white sm:w-auto sm:justify-start sm:py-1"
                        onClick={() => {
                          setPreselectedDiscipleId(disciple.discipleId);
                          setShowModal(true);
                        }}
                      >
                        <SendHorizontal size={14} />
                        Envoyer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-theme-border bg-theme-surface p-4 shadow-card">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Bell size={18} className="text-[#6C3FE8]" />
              Dernières réponses
            </h3>
            {recentResponses.length === 0 ? (
              <p className="text-[14px] text-theme-muted">Aucune réponse reçue aujourd'hui</p>
            ) : (
              <div className="space-y-3">
                {recentResponses.map((item, index) => (
                  <div key={`${item.discipleId}-${index}`} className="flex flex-col gap-3 border-b border-theme-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{item.name}</p>
                      <p className="text-[11px] text-theme-muted">Check-in du {formatShortDate(item.date)}</p>
                      {item.responseAt ? (
                        <p className="text-[11px] text-theme-muted">Réponse à {formatShortTime(item.responseAt)}</p>
                      ) : null}
                      {item.currentCountry || item.country || item.originCountry ? (
                        <p className="text-[12px] text-theme-muted">
                          {formatCountryWithFlag(item.currentCountry || item.country || item.originCountry)}
                        </p>
                      ) : null}
                      <p className="break-words text-[13px] text-theme-muted">{item.excerpt}</p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-2 py-1 text-[12px] font-medium ${
                        item.prayed === true
                          ? "bg-emerald-100 text-emerald-700"
                          : item.prayed === false
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.prayed === true ? "A prié" : item.prayed === false ? "N'a pas prié" : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      <ManualCheckinModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        disciples={disciples}
        preselectedDiscipleId={preselectedDiscipleId}
      />
    </Layout>
  );
}

export default OverviewPage;
