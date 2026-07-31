import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { generateDashboard } from "./dashboard.js";
import { laneLabel } from "./guardrails.js";
import { exec } from "./proc.js";
import { DEFAULT_RUN_OPTIONS, runTicket } from "./orchestrator.js";
import { startServer } from "./server.js";
import type { Config, TicketInput } from "./types.js";

const DEFAULT_CONFIG = "config/pipeline.json";
const DEFAULT_QUEUE = "queue.json";

interface Flags {
  config: string;
  queue: string;
  planOnly: boolean;
  dryRun: boolean;
  cleanup: boolean;
  ticket: string | null;
  port: number;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    config: DEFAULT_CONFIG,
    queue: DEFAULT_QUEUE,
    planOnly: false,
    dryRun: false,
    cleanup: false,
    ticket: null,
    port: 4319,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--config":
        flags.config = argv[++i] ?? DEFAULT_CONFIG;
        break;
      case "--queue":
        flags.queue = argv[++i] ?? DEFAULT_QUEUE;
        break;
      case "--ticket":
        flags.ticket = argv[++i] ?? null;
        break;
      case "--plan-only":
        flags.planOnly = true;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--cleanup":
        flags.cleanup = true;
        break;
      case "--port": {
        const parsed = Number(argv[++i]);
        if (Number.isFinite(parsed) && parsed > 0) flags.port = parsed;
        break;
      }
      default:
        break;
    }
  }

  return flags;
}

function loadQueue(path: string): TicketInput[] {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(
      `Antrean tidak ditemukan: ${abs}\nSalin queue.example.json jadi queue.json dulu.`,
    );
  }

  const parsed: unknown = JSON.parse(readFileSync(abs, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Antrean harus berupa array tiket: ${abs}`);
  }

  const tickets: TicketInput[] = [];
  for (const [index, item] of parsed.entries()) {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Tiket ke-${String(index)} bukan object`);
    }
    const obj = item as Record<string, unknown>;
    const key = obj["key"];
    const summary = obj["summary"];
    const description = obj["description"];

    if (typeof key !== "string" || key.trim().length === 0) {
      throw new Error(`Tiket ke-${String(index)} tidak punya "key"`);
    }
    if (typeof summary !== "string") {
      throw new Error(`Tiket ${key} tidak punya "summary"`);
    }
    if (typeof description !== "string" || description.trim().length === 0) {
      throw new Error(
        `Tiket ${key} deskripsinya kosong. Tiket tanpa deskripsi bukan kerjaan agent — kembalikan ke PO.`,
      );
    }

    const url = obj["url"];
    tickets.push({
      key,
      summary,
      description,
      url: typeof url === "string" ? url : undefined,
    });
  }

  return tickets;
}

async function cmdRun(flags: Flags): Promise<number> {
  const config = loadConfig(flags.config);
  let tickets = loadQueue(flags.queue);

  if (flags.ticket !== null) {
    tickets = tickets.filter((t) => t.key === flags.ticket);
    if (tickets.length === 0) {
      console.error(`Tiket ${flags.ticket} tidak ada di antrean.`);
      return 1;
    }
  }

  console.log(`Engine   : ${config.engine.name}`);
  console.log(`Repo     : ${config.repoPath}`);
  console.log(`Tiket    : ${String(tickets.length)}`);
  console.log(
    `Jalur 1  : ${config.laneRules.lane1Enabled ? "AKTIF" : "mati (default selama pilot)"}`,
  );
  if (flags.dryRun) console.log("Mode     : DRY RUN — agent tidak dipanggil");
  if (flags.planOnly) console.log("Mode     : PLAN ONLY — kode tidak disentuh");
  console.log("");

  let failures = 0;

  for (const ticket of tickets) {
    console.log(`── ${ticket.key} — ${ticket.summary}`);

    const record = await runTicket(ticket, config, {
      ...DEFAULT_RUN_OPTIONS,
      planOnly: flags.planOnly,
      dryRun: flags.dryRun,
    });

    console.log(`   hasil    : ${record.outcome}`);
    console.log(`   jalur    : ${laneLabel(record.lane)}`);
    console.log(
      `   diff     : ${String(record.filesChanged)} file, ${String(record.diffLines)} baris, ${String(record.addedTestFiles)} spec baru`,
    );
    console.log(`   durasi   : ${(record.durationSec / 60).toFixed(1)} menit`);
    if (record.blockedBy.length > 0) {
      console.log(`   dicegat  : ${record.blockedBy.join("; ")}`);
    }
    if (record.violations.length > 0) {
      console.log(`   pelangg. : ${record.violations.join("; ")}`);
    }
    if (record.notes) console.log(`   catatan  : ${record.notes}`);
    console.log("");

    if (record.outcome !== "ready_for_review") failures += 1;
  }

  const dashboard = generateDashboard(config.runsRoot);
  console.log(`Dashboard: ${dashboard}`);
  console.log(
    `Selesai: ${String(tickets.length - failures)}/${String(tickets.length)} siap direview.`,
  );

  return 0;
}

function cmdServe(flags: Flags): number {
  const config = loadConfig(flags.config);
  startServer({
    config,
    configPath: resolve(flags.config),
    queuePath: resolve(flags.queue),
    port: flags.port,
    webRoot: resolve("web"),
  });
  return 0;
}

function cmdDashboard(flags: Flags): number {
  const config = loadConfig(flags.config);
  console.log(generateDashboard(config.runsRoot));
  return 0;
}

/** Periksa prasyarat sebelum percobaan pertama, supaya gagalnya jelas di mana. */
async function cmdDoctor(flags: Flags): Promise<number> {
  let config: Config;
  try {
    config = loadConfig(flags.config);
  } catch (err) {
    console.log(`✗ config: ${(err as Error).message}`);
    return 1;
  }
  console.log(`✓ config  : ${resolve(flags.config)}`);
  console.log(`✓ repo    : ${config.repoPath}`);

  let failed = 0;

  const git = await exec("git", ["-C", config.repoPath, "rev-parse", "--is-inside-work-tree"], {
    timeoutMs: 30_000,
  });
  if (git.exitCode === 0) {
    console.log("✓ git     : repo terbaca");
  } else {
    console.log("✗ git     : bukan git repo atau git tidak ada");
    failed += 1;
  }

  const status = await exec("git", ["-C", config.repoPath, "status", "--porcelain"], {
    timeoutMs: 30_000,
  });
  if (status.exitCode === 0 && status.stdout.trim().length === 0) {
    console.log("✓ working : bersih");
  } else if (status.exitCode === 0) {
    console.log("✗ working : ada perubahan belum di-commit — orchestrator akan menolak jalan");
    failed += 1;
  }

  const agent = await exec(config.engine.plan.bin, ["--version"], { timeoutMs: 30_000 });
  if (agent.exitCode === 0) {
    console.log(`✓ agent   : ${config.engine.plan.bin} — ${agent.stdout.trim().split("\n")[0] ?? ""}`);
  } else {
    console.log(
      `✗ agent   : "${config.engine.plan.bin}" tidak bisa dijalankan. Pastikan sudah terpasang dan sudah login.`,
    );
    failed += 1;
  }

  const bundle = await exec("bundle", ["--version"], {
    cwd: config.repoPath,
    timeoutMs: 60_000,
  });
  if (bundle.exitCode === 0) {
    console.log(`✓ bundler : ${bundle.stdout.trim()}`);
  } else {
    console.log("✗ bundler : tidak ada — rspec tidak akan bisa jalan");
    failed += 1;
  }

  const masterKey =
    existsSync(resolve(config.repoPath, "config/master.key")) ||
    (process.env["RAILS_MASTER_KEY"] ?? "").length > 0;
  if (masterKey) {
    console.log("✓ rails key: ada");
  } else {
    console.log(
      "✗ rails key: RAILS_MASTER_KEY tidak ada dan config/master.key tidak ada — test suite tidak akan jalan. Ini blocker nomor satu; minta ke Runchise.",
    );
    failed += 1;
  }

  console.log("");
  console.log(failed === 0 ? "Semua prasyarat terpenuhi." : `${String(failed)} prasyarat belum siap.`);
  return failed === 0 ? 0 : 1;
}

function usage(): void {
  console.log(`runchise-agent-pipeline

  node dist/cli.js doctor      Periksa prasyarat (jalankan ini dulu)
  node dist/cli.js run         Jalankan antrean tiket dari terminal
  node dist/cli.js serve       Jalankan UI di http://127.0.0.1:4319
  node dist/cli.js dashboard   Bangkitkan ulang dashboard HTML statis

Opsi:
  --config <path>   default config/pipeline.json
  --queue <path>    default queue.json
  --ticket <KEY>    jalankan satu tiket saja dari antrean
  --plan-only       berhenti setelah tahap rencana, kode tidak disentuh
  --dry-run         jangan panggil agent atau rspec, cuma periksa alur
  --cleanup         hapus worktree walau percobaan gagal
  --port <n>        port untuk serve, default 4319
`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (flags.cleanup) DEFAULT_RUN_OPTIONS.keepOnFailure = false;

  let code = 0;

  switch (command) {
    case "run":
      code = await cmdRun(flags);
      break;
    case "serve":
      code = cmdServe(flags);
      break;
    case "dashboard":
      code = cmdDashboard(flags);
      break;
    case "doctor":
      code = await cmdDoctor(flags);
      break;
    default:
      usage();
      code = command === undefined ? 0 : 1;
  }

  process.exitCode = code;
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
