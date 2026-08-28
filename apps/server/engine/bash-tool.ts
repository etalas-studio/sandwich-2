/**
 * A `bash` tool whose subprocess environment is scrubbed of host secrets.
 *
 * After M2-01 the engines run with `cwd` inside `PROJECTS_ROOT`, and BRIEF.md
 * (M2-02) carries user-controlled attachment text into the agent's context. A
 * prompt-injected `bash` call must not be able to read `DATABASE_URL`,
 * `R2_*`, provider API keys, etc. straight out of `process.env`.
 *
 * This is a mitigation, not isolation — real per-tenant isolation (separate uid
 * / container) is tracked separately on the roadmap. `bash` is dropped entirely
 * from the text engine; the prototype engine keeps it with this scrub.
 */

// Anything matching these is removed from the child env.
const SECRET_ENV_PATTERNS = [
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /_KEY$/i,
  /API_KEY/i,
  /DATABASE_URL/i,
  /REDIS_URL/i,
  /^R2_/i,
  /^AWS_/i,
  /^MIDTRANS/i,
  /^RESEND/i,
  /^POSTHOG/i,
  /^ANTHROPIC/i,
  /^OPENAI/i,
  /^NINEROUTER/i,
  /^PI_/i,
];

export function scrubEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (SECRET_ENV_PATTERNS.some((re) => re.test(key))) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Returns a `customTools` entry: the standard bash tool bound to `cwd` with a
 * spawn hook that scrubs the environment. Pass alongside a `tools` list that
 * does NOT include `"bash"`.
 */
export async function scrubbedBashTool(cwd: string): Promise<unknown> {
  const pi = (await import("@earendil-works/pi-coding-agent")) as unknown as {
    createBashToolDefinition: (
      cwd: string,
      options?: {
        exposeSessionEnvironment?: boolean;
        spawnHook?: (c: { command: string; cwd: string; env: NodeJS.ProcessEnv }) => {
          command: string;
          cwd: string;
          env: NodeJS.ProcessEnv;
        };
      },
    ) => unknown;
  };
  return pi.createBashToolDefinition(cwd, {
    exposeSessionEnvironment: false,
    spawnHook: (c) => ({ ...c, env: scrubEnv(c.env) }),
  });
}
