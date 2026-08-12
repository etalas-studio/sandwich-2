/**
 * Integration status — read-only, env-var based.
 * No user-managed API keys. Sandwich owner sets env vars.
 *
 * - OPENCODE_API_KEY → OpenCode Go (Pi SDK) — primary engine
 * - GROQ_API_KEY      → Groq — dev fallback
 */

export interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
}

const PROVIDERS = [
  { id: "opencode-go", name: "OpenCode Go", envKey: "OPENCODE_API_KEY" },
  { id: "groq", name: "Groq", envKey: "GROQ_API_KEY" },
];

export function getIntegrationStatus(): IntegrationStatus[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    connected: !!process.env[p.envKey],
  }));
}
