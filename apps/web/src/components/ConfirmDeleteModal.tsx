interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 rounded-xl mx-4"
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-sm font-semibold mb-2"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {title}
        </h3>
        <p
          className="text-xs mb-5"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity"
            style={{ backgroundColor: "#ef4444" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
