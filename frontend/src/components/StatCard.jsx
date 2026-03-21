function StatCard({ icon, label, value, tone = "primary" }) {
  const toneClass = {
    primary: "bg-brand-50 text-brand-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700"
  }[tone];

  return (
    <article className="rounded-xl border border-theme-border bg-theme-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${toneClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-theme-text2">{label}</p>
          <p className="text-2xl font-semibold text-theme-text1">{value}</p>
        </div>
      </div>
    </article>
  );
}

export default StatCard;
