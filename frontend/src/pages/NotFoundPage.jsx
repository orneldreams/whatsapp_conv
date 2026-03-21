import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-theme-bg p-6">
      <div className="rounded-xl border border-theme-border bg-theme-surface p-6 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-theme-text1">Page introuvable</h1>
        <Link
          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-[#6C3FE8]/60 bg-[#1A1825] px-[14px] py-[6px] text-[13px] font-medium text-[#6C3FE8] transition-colors hover:border-[#6C3FE8]"
          to="/"
        >
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
