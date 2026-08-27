import { getModelRuntime, getDbRef, type PiRuntime } from "./integrations/integrations.js";
import { getEngineSetting } from "./db/engine-settings.js";

/**
 * Engine config resolution — the single place that decides which provider/model
 * drives each stage. The admin panel writes these to `engine_settings` (DB);
 * when unset, the hardcoded 9router/Claude defaults below apply.
 */

export type EngineStage = "chat" | "prototype" | "glowup" | "vision";

export const ENGINE_STAGES: EngineStage[] = ["chat", "prototype", "glowup", "vision"];

export const STAGE_SETTING_KEYS: Record<EngineStage, string> = {
  chat: "engine.chat",
  prototype: "engine.prototype",
  glowup: "engine.glowup",
  vision: "engine.vision",
};

export const STAGE_DEFAULTS: Record<EngineStage, string> = {
  chat: "9router/cc/claude-sonnet-5",
  prototype: "9router/cc/claude-sonnet-5",
  glowup: "9router/cc/claude-sonnet-4-6",
  vision: "9router/cc/claude-haiku-4-5-20251001",
};

export type EngineModelId = NonNullable<ReturnType<PiRuntime["getModel"]>>;

let engineSettingsCache: Partial<Record<EngineStage, string>> | null = null;

async function loadEngineSettingsCache(): Promise<void> {
  if (engineSettingsCache) return;
  const cache: Partial<Record<EngineStage, string>> = {};
  const db = getDbRef();
  if (db) {
    await Promise.all(
      ENGINE_STAGES.map(async (stage) => {
        const value = await getEngineSetting(db, STAGE_SETTING_KEYS[stage]);
        if (value) cache[stage] = value;
      }),
    );
  }
  engineSettingsCache = cache;
}

/** Invalidate the in-memory config cache after an admin write. */
export function refreshEngineConfig(): void {
  engineSettingsCache = null;
}

/** Resolve the "provider/model" string for a stage (DB value or default). */
export async function getEngineConfig(
  stage: EngineStage,
): Promise<{ provider: string; model: string }> {
  await loadEngineSettingsCache();
  const value = engineSettingsCache?.[stage] ?? STAGE_DEFAULTS[stage];
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1) {
    throw new Error(
      `Invalid engine config for ${stage}: "${value}" (expected "provider/model")`,
    );
  }
  return { provider: value.slice(0, slash), model: value.slice(slash + 1) };
}

/** Resolve the live Pi model for a stage, or throw with a clear message. */
export async function resolveModel(
  stage: EngineStage,
): Promise<{ runtime: PiRuntime; model: EngineModelId }> {
  const runtime = await getModelRuntime();
  const { provider, model } = await getEngineConfig(stage);
  const resolved = runtime.getModel(provider, model);
  if (!resolved) {
    throw new Error(`Engine model not available: ${provider}/${model}`);
  }
  return { runtime, model: resolved };
}
