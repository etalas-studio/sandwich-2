interface ConfirmDeleteModalProps {
  open: boolean
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDeleteModal({ open, itemName, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="ds-card-outer ds-shadow-elevated w-full max-w-sm" style={{ height: 'auto' }}>
          <div className="ds-card-inner p-6" style={{ height: 'auto' }}>
            <h3 className="text-base font-normal tracking-tight text-white ds-text-shadow mb-2">Delete Ticket</h3>
            <p className="text-sm text-white/50 font-light mb-6">
              Are you sure you want to delete <span className="text-white/70 font-mono">{itemName}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-[#ff8a8a]/20 border border-[#ff8a8a]/30 text-[#ff8a8a] text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
