function ConfirmModal({ title, message, confirmLabel = "Confirmer", onConfirm, onCancel, danger = false }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[14px] p-6"
        style={{ background: "#1A1825", border: "0.5px solid #2D2A3E" }}
        onClick={(e) => e.stopPropagation()}
      >
        {danger && (
          <div className="mb-4 flex justify-center">
            <span className="text-4xl" style={{ color: "#EF4444" }}>⚠</span>
          </div>
        )}

        <h2 className="mb-2 text-center text-[16px] font-semibold text-theme-text1">{title}</h2>
        {message && (
          <p className="mb-6 text-center text-[13px] text-theme-text2">{message}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border px-4 py-2 text-[13px] font-medium text-theme-text1 transition-colors hover:bg-white/5"
            style={{ borderColor: "#2D2A3E", background: "transparent" }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: danger ? "#EF4444" : "#6C3FE8" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
