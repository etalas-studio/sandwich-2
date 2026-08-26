'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
} from '../../../components/ui/select'
import {
  fetchAdminEngine,
  updateAdminEngine,
  connectProvider,
  testProvider,
  pingProvider,
  disconnectProvider,
  type EngineConfig,
  type IntegrationStatus,
} from '../../../api/admin'

const STAGE_LABELS: Record<string, string> = {
  chat: 'Chat / PRD / Quotation / Specs',
  prototype: 'Prototype (pass-1)',
  glowup: 'Glowup (design polish)',
  vision: 'Vision (attachment & screenshot)',
}

export default function ConfigPage() {
  const { state } = useAuth()

  const [config, setConfig] = useState<EngineConfig | null>(null)
  const [stageValues, setStageValues] = useState<Record<string, string>>({})
  const [formState, setFormState] = useState<Record<string, { apiKey: string; baseUrl: string }>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const toggleKey = useCallback((providerId: string) => {
    setShowKey((prev) => ({ ...prev, [providerId]: !prev[providerId] }))
  }, [])
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Record<string, { kind: 'error' | 'notice'; text: string }>>({})
  const setMsg = useCallback((section: string, kind: 'error' | 'notice', text: string) => {
    setMsgs((prev) => ({ ...prev, [section]: { kind, text } }))
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminEngine()
      setConfig(data)
      const values: Record<string, string> = {}
      for (const [stage, cfg] of Object.entries(data.stages)) {
        values[stage] = cfg.value
      }
      setStageValues(values)
      const forms: Record<string, { apiKey: string; baseUrl: string }> = {}
      for (const integration of data.integrations) {
        forms[integration.id] = {
          apiKey: integration.apiKey ?? '',
          baseUrl: integration.baseUrl ?? '',
        }
      }
      setFormState(forms)
    } catch (err) {
      setMsg('engine', 'error', err instanceof Error ? err.message : 'failed to load admin config')
    }
  }, [setMsg])

  useEffect(() => {
    if (state.status === 'authenticated') {
      void load()
    }
  }, [state.status, load])

  const models = (config?.integrations ?? [])
    .filter((i) => i.connected)
    .flatMap((i) => i.models)

  const run = async (section: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true)
    try {
      const result = await fn()
      await load()
      const text = okMsg ?? (typeof result === 'string' ? result : undefined)
      if (text) setMsg(section, 'notice', text)
    } catch (err) {
      setMsg(section, 'error', err instanceof Error ? err.message : 'request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl tracking-wide text-white" style={{ fontFamily: "'Bowlby One', sans-serif" }}>Configuration</h1>
        <p className="mt-1 text-sm text-neutral-500">
          AI engine and provider settings. Changes apply immediately (no redeploy).
        </p>
      </header>

      {/* ── Engine config ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Provider / model per stage</h2>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          {msgs['engine'] && (
            <SectionBanner
              kind={msgs['engine']!.kind}
              text={msgs['engine']!.text}
              onDismiss={() => setMsgs((prev) => omitKey(prev, 'engine'))}
            />
          )}
          <div className={msgs['engine'] ? 'mt-4 space-y-4' : 'space-y-4'}>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => (
              <div key={stage} className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-neutral-500">{stage}</div>
                </div>
                <Select<string>
                  value={stageValues[stage] ?? ''}
                  onValueChange={(v) => setStageValues((prev) => ({ ...prev, [stage]: v }))}
                  disabled={models.length === 0}
                >
                  <SelectTrigger className="w-full gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 outline-none focus:border-neutral-500 disabled:opacity-50">
                    <SelectValue placeholder={models.length === 0 ? 'Connect a provider first' : 'Select model'} />
                    <SelectIcon className="ml-auto"><ChevronDown className="h-3.5 w-3.5 text-neutral-500" /></SelectIcon>
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <button
            onClick={() => run('engine', () => updateAdminEngine(stageValues))}
            disabled={busy || models.length === 0}
            className="mt-5 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save engine config'}
          </button>
        </div>
      </section>

      {/* ── Integrations ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Providers</h2>
        {(config?.integrations ?? []).map((integration) => (
          <ProviderCard
            key={integration.id}
            integration={integration}
            form={formState[integration.id] ?? { apiKey: '', baseUrl: '' }}
            msg={msgs[`integ:${integration.id}`]}
            busy={busy}
            showKey={!!showKey[integration.id]}
            onToggleKey={() => toggleKey(integration.id)}
            onDismissMsg={() =>
              setMsgs((prev) => omitKey(prev, `integ:${integration.id}`))
            }
            onFormChange={(patch) =>
              setFormState((prev) => ({
                ...prev,
                [integration.id]: { ...(prev[integration.id] ?? { apiKey: '', baseUrl: '' }), ...patch },
              }))
            }
            onConnect={() =>
              run(
                `integ:${integration.id}`,
                () =>
                  connectProvider(
                    integration.id,
                    formState[integration.id]?.apiKey ?? '',
                    formState[integration.id]?.baseUrl || undefined,
                  ),
                'Connected',
              )
            }
            onTest={() =>
              run(
                `integ:${integration.id}`,
                () =>
                  testProvider(
                    integration.id,
                    formState[integration.id]?.apiKey ?? '',
                    formState[integration.id]?.baseUrl || undefined,
                  ),
              )
            }
            onPing={() =>
              run(`integ:${integration.id}`, async () => {
                const res = await pingProvider(integration.id)
                if (!res.ok) throw new Error(res.message || 'Ping failed')
                return res.message
              })
            }
            onDisconnect={() =>
              run(`integ:${integration.id}`, () => disconnectProvider(integration.id))
            }
          />
        ))}
      </section>
    </div>
  )
}

function ProviderCard({
  integration,
  form,
  msg,
  busy,
  showKey,
  onToggleKey,
  onDismissMsg,
  onFormChange,
  onConnect,
  onTest,
  onPing,
  onDisconnect,
}: {
  integration: IntegrationStatus
  form: { apiKey: string; baseUrl: string }
  msg?: { kind: 'error' | 'notice'; text: string }
  busy: boolean
  showKey: boolean
  onToggleKey: () => void
  onDismissMsg: () => void
  onFormChange: (patch: { apiKey?: string; baseUrl?: string }) => void
  onConnect: () => void
  onTest: () => void
  onPing: () => void
  onDisconnect: () => void
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">{integration.name}</div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              integration.connected
                ? 'bg-emerald-950 text-emerald-300'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {integration.connected ? 'connected' : 'disconnected'}
          </span>
        </div>
        <div className="text-xs text-neutral-500">
          {integration.models.length} model{integration.models.length === 1 ? '' : 's'}
        </div>
      </div>

      {msg && (
        <div className="mt-3">
          <SectionBanner kind={msg.kind} text={msg.text} onDismiss={onDismissMsg} />
        </div>
      )}

      {integration.error && !integration.connected && (
        <div className="mt-2 text-xs text-amber-400">{integration.error}</div>
      )}

      <div className="mt-4 space-y-2">
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder="API key"
            autoComplete="off"
            spellCheck={false}
            value={form.apiKey}
            onChange={(e) => onFormChange({ apiKey: e.target.value })}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 pr-10 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="button"
            onClick={onToggleKey}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
            title={showKey ? 'Hide API key' : 'Show API key'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-300"
            tabIndex={-1}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {integration.id === '9router' && (
          <input
            type="text"
            placeholder="Base URL (https://…/v1)"
            value={form.baseUrl}
            onChange={(e) => onFormChange({ baseUrl: e.target.value })}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={onConnect}
            disabled={busy || !form.apiKey.trim()}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            Connect & save
          </button>
          <button
            onClick={onTest}
            disabled={busy || !form.apiKey.trim()}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
          >
            Test (no save)
          </button>
          {integration.connected && (
            <>
              <button
                onClick={onPing}
                disabled={busy}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
              >
                Ping
              </button>
              <button
                onClick={onDisconnect}
                disabled={busy}
                className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionBanner({
  kind,
  text,
  onDismiss,
}: {
  kind: 'error' | 'notice'
  text: string
  onDismiss: () => void
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
        kind === 'error'
          ? 'border-red-900 bg-red-950/40 text-red-300'
          : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
      }`}
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded px-1 text-neutral-400 hover:text-neutral-200"
      >
        ✕
      </button>
    </div>
  )
}

function omitKey<K extends string, V>(rec: Record<K, V>, key: string): Record<K, V> {
  const { [key as K]: _dropped, ...rest } = rec
  return rest as Record<K, V>
}
