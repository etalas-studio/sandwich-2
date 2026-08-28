import type { ReactNode } from 'react'
import type { ProjectSummary } from '../lib/conversations'

interface ProjectGroupProps {
  project: ProjectSummary
  count: number
  collapsed: boolean
  isActive: boolean
  isRenaming: boolean
  renameValue: string
  newChatLabel: string
  renameLabel: string
  onToggle: () => void
  onNewChat: () => void
  onRenameStart: () => void
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  children: ReactNode
}

export default function ProjectGroup({
  project,
  count,
  collapsed,
  isActive,
  isRenaming,
  renameValue,
  newChatLabel,
  renameLabel,
  onToggle,
  onNewChat,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  menuOpen,
  onMenuToggle,
  children,
}: ProjectGroupProps) {
  return (
    <div className="mb-1 relative group/proj">
      <div
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors"
        style={{ backgroundColor: isActive || menuOpen ? 'rgba(255,255,255,0.06)' : '' }}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          aria-label={collapsed ? 'Expand project' : 'Collapse project'}
        >
          <iconify-icon
            icon={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'}
            width="12"
            style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}
          />
          <iconify-icon
            icon="solar:folder-linear"
            width="13"
            style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}
          />
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameCommit()
                if (e.key === 'Escape') onRenameCancel()
              }}
              onBlur={onRenameCommit}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent outline-none text-xs min-w-0"
              style={{ color: '#ffffff' }}
            />
          ) : (
            <span
              className="text-[11px] font-semibold uppercase tracking-wide truncate flex-1"
              style={{ color: 'rgba(255,255,255,0.85)' }}
              title={project.title}
            >
              {project.title}
            </span>
          )}
        </button>

        {!isRenaming && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
          >
            {count}
          </span>
        )}

        <button
          onClick={onNewChat}
          aria-label={newChatLabel}
          className="p-1 rounded shrink-0 opacity-100 md:opacity-0 md:group-hover/proj:opacity-100 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <iconify-icon icon="solar:add-circle-linear" width="14" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          aria-label="Project options"
          className="p-1 rounded shrink-0 opacity-100 md:opacity-0 md:group-hover/proj:opacity-100 transition-opacity"
          style={{ opacity: menuOpen ? 1 : undefined, color: 'rgba(255,255,255,0.5)' }}
        >
          <iconify-icon icon="solar:menu-dots-bold" width="14" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onMenuToggle} />
            <div
              className="absolute right-0 top-full mt-0.5 z-50 rounded-xl py-1 min-w-[160px] shadow-xl"
              style={{ backgroundColor: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  onMenuToggle()
                  onRenameStart()
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <iconify-icon icon="solar:pen-2-linear" width="14" />
                {renameLabel}
              </button>
              <button
                onClick={() => {
                  onMenuToggle()
                  onNewChat()
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <iconify-icon icon="solar:chat-round-line-linear" width="14" />
                {newChatLabel}
              </button>
            </div>
          </>
        )}
      </div>

      {!collapsed && <div className="pl-2 mt-0.5">{children}</div>}
    </div>
  )
}
