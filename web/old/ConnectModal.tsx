import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Provider {
  id: string
  name: string
  logo: string
  description: string
  docsUrl: string
}

interface ConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: Provider
  connecting: boolean
  error: string | null
  onConnect: (apiKey: string) => void
}

export default function ConnectModal({
  open,
  onOpenChange,
  provider,
  connecting,
  error,
  onConnect,
}: ConnectModalProps) {
  const [apiKey, setApiKey] = useState('')

  const handleConnect = () => {
    const trimmed = apiKey.trim()
    if (!trimmed) return
    onConnect(trimmed)
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) setApiKey('')
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="!bg-[#0f0f0f] !border !border-white/[0.08] !rounded-xl !p-0 !gap-0 !max-w-md"
        style={{
          boxShadow:
            '0 24px 48px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Noise overlay */}
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at center, #ffffff 1px, transparent 1px)',
              backgroundSize: '4px 4px',
              opacity: 0.03,
            }}
          />
        </div>

        <div className="relative z-10 p-5">
          <DialogHeader className="mb-4">
            {/* Provider header */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/[0.06] shrink-0"
                style={
                  provider.id === '9router' ? { background: '#ff4405', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)' }
                  : provider.id === 'anthropic' ? { background: '#d67660', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)' }
                  : provider.id === 'opencode-go' ? { background: '#f0f0f0', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.2)' }
                  : { background: 'linear-gradient(to bottom, #2a2a2a, #161616)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.6)' }
                }
              >
                {provider.logo.startsWith('/') ? (
                  <img src={provider.logo} alt={provider.name} width="20" height="20" className="object-contain" />
                ) : (
                  <iconify-icon
                    icon={provider.logo}
                    width="18"
                    className="text-white/60"
                  />
                )}
              </div>
              <div>
                <DialogTitle className="!text-sm !font-normal !text-white ds-text-shadow !leading-none">
                  {provider.name}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="!text-[11px] !text-white/50 !font-light !leading-relaxed">
              Enter your API key to connect. Get your key at{' '}
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 underline underline-offset-2 hover:text-white/80 transition-colors"
              >
                {provider.docsUrl.replace('https://', '')}
              </a>
              .
            </DialogDescription>
          </DialogHeader>

          {/* Error */}
          {error && (
            <div className="mb-4 p-2.5 rounded-lg border border-[#ff8a8a]/20 bg-[#ff8a8a]/[0.04]">
              <p className="text-[10px] text-[#ff8a8a]/80 font-light leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {/* API Key input */}
          <div className="mb-4">
            <label className="text-[9px] text-white/40 font-normal uppercase tracking-wide mb-1.5 block">
              API Key
            </label>
            <input
              type="password"
              placeholder={provider.id === 'claude' ? 'sk-ant-...' : 'oc-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connecting}
              autoFocus
              className="w-full px-3 py-1.5 rounded-md bg-[#0a0a0a] border border-white/[0.08] text-[11px] text-white/80 placeholder:text-white/20 font-mono outline-none focus:border-white/20 disabled:opacity-40 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.04]">
            <button
              type="button"
              onClick={() => handleClose(false)}
              disabled={connecting}
              className="relative inline-flex group disabled:opacity-40"
            >
              <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/20 to-transparent opacity-40" />
              <span
                className="relative px-3 py-1 rounded-md text-[11px] font-normal text-white/60 bg-gradient-to-b from-[#2a2a2a] to-[#161616]"
                style={{
                  boxShadow:
                    'inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -1px 3px rgba(0,0,0,0.5)',
                }}
              >
                Cancel
              </span>
            </button>

            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="relative inline-flex group disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 rounded-md p-[1px] bg-gradient-to-b from-white/30 to-transparent opacity-80" />
              <span
                className="relative px-3 py-1 rounded-md text-[11px] font-normal text-white bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] flex items-center gap-1.5"
                style={{
                  boxShadow:
                    'inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 3px rgba(0,0,0,0.6)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {connecting ? (
                  <>
                    <iconify-icon
                      icon="solar:refresh-linear"
                      width="14"
                      className="animate-spin"
                    />
                    Adding…
                  </>
                ) : (
                  'Add key'
                )}
              </span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
