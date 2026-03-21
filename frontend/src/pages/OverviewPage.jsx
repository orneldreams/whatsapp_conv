import { useEffect, useMemo, useState } from "react";
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
import StatCard from "../components/StatCard";
import ManualCheckinModal from "../components/ManualCheckinModal";
import { formatCountryWithFlag } from "../utils/countries";

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

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

function OverviewPage({ onLogout }) {
  const { theme } = useTheme();
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

  return (
    <Layout title="Vue d'ensemble" onLogout={onLogout}>
      {loading ? <p className="py-10 text-theme-muted">Chargement...</p> : null}
      {error ? <p className="py-10 text-red-500">{error}</p> : null}

      {!loading && !error && stats ? (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-4">
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
                Taux de reponse sur 7 jours
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dailyResponseRate || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4B556333" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
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
                      formatter={(value) => [`${value}%`, "Taux de reponse"]}
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
                      <p className="text-[12px] text-theme-muted">{disciple.phone}</p>
                      <button
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1 text-[12px] text-white"
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
              Dernieres reponses
            </h3>
            {recentResponses.length === 0 ? (
              <p className="text-[14px] text-theme-muted">Aucune reponse recue aujourd'hui</p>
            ) : (
              <div className="space-y-3">
                {recentResponses.map((item, index) => (
                  <div key={`${item.discipleId}-${index}`} className="flex items-center justify-between border-b border-theme-border pb-3">
                    <div>
                      <p className="text-[14px] font-semibold">{item.name}</p>
                      {item.currentCountry || item.country || item.originCountry ? (
                        <p className="text-[12px] text-theme-muted">
                          {formatCountryWithFlag(item.currentCountry || item.country || item.originCountry)}
                        </p>
                      ) : null}
                      <p className="text-[13px] text-theme-muted">{item.excerpt}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[12px] font-medium ${
                        item.prayed === true
                          ? "bg-emerald-100 text-emerald-700"
                          : item.prayed === false
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.prayed === true ? "A prie" : item.prayed === false ? "N'a pas prie" : "-"}
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
