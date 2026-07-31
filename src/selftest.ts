/**
 * Self-test tanpa dependency. Fokus di logika yang kalau salah, salahnya
 * berbahaya dan tidak berisik: pencocokan daftar cegat, batas aman, dan
 * klasifikasi jalur.
 *
 * Jalankan: npm run selftest
 * Jalankan ulang setiap kali config/pipeline.json diubah.
 */
import { loadConfig } from "./config.js";
import { checkGuardrails, classifyLane, matchBlocklist } from "./guardrails.js";
import { fillArgs } from "./proc.js";
import { parsePlannedFiles, parseVerdict } from "./prompts.js";
import type { Config, DiffStat, DiffSummary, RspecResult } from "./types.js";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function makeDiff(files: Array<[string, number]>, addedTests: string[] = []): DiffSummary {
  const stats: DiffStat[] = files.map(([file, added]) => ({ file, added, removed: 0 }));
  return {
    stats,
    filesChanged: stats.length,
    diffLines: stats.reduce((sum, s) => sum + s.added + s.removed, 0),
    addedTestFiles: addedTests,
    patch: "",
  };
}

const greenRspec: RspecResult = {
  ran: true,
  exitCode: 0,
  timedOut: false,
  targets: ["spec/helpers/file_helper_spec.rb"],
  exampleCount: 12,
  failureCount: 0,
  pendingCount: 0,
  durationSec: 3.2,
};

const redRspec: RspecResult = { ...greenRspec, exitCode: 1, failureCount: 2 };

function run(config: Config): void {
  section("Daftar cegat — path yang HARUS dicegat");
  const mustBlock = [
    "app/domains/accounting/services/costing/calculator.rb",
    "app/domains/jurnal/models/entry.rb",
    "app/models/concerns/product_logic.rb",
    "app/models/order_transaction.rb",
    "db/migrate/20260731_add_column.rb",
    "app/domains/grab_food/services/push_order.rb",
    "app/domains/faspay/client.rb",
    "app/controllers/api/orders_controller.rb",
  ];
  for (const file of mustBlock) {
    const hits = matchBlocklist([file], config.blocklist);
    check(`dicegat: ${file}`, hits.length === 1);
  }

  section("Daftar cegat — path yang HARUS lolos");
  const mustPass = [
    "app/helpers/file_helper.rb",
    "app/domains/excel_generators/fast_excel/worksheet_creator.rb",
    "app/domains/report/queries/cash_closing_query.rb",
    "spec/helpers/file_helper_spec.rb",
    // Nama mirip tapi bukan file yang dicegat.
    "app/models/order_transaction_note.rb",
  ];
  for (const file of mustPass) {
    const hits = matchBlocklist([file], config.blocklist);
    check(`lolos: ${file}`, hits.length === 0, hits[0]?.pattern ?? "");
  }

  section("Batas aman");
  const okDiff = makeDiff([
    ["app/helpers/file_helper.rb", 3],
    ["spec/helpers/file_helper_spec.rb", 20],
  ]);
  check("diff wajar lolos", checkGuardrails(okDiff, config).ok);

  const tooManyFiles = makeDiff(
    Array.from({ length: config.limits.maxFilesChanged + 1 }, (_, i) => [
      `app/helpers/h${String(i)}.rb`,
      2,
    ]),
  );
  check("file kebanyakan ditolak", !checkGuardrails(tooManyFiles, config).ok);

  const tooManyLines = makeDiff([
    ["app/helpers/file_helper.rb", config.limits.maxDiffLines + 1],
  ]);
  check("baris kebanyakan ditolak", !checkGuardrails(tooManyLines, config).ok);

  const blockedDiff = makeDiff([["app/domains/jurnal/models/entry.rb", 5]]);
  const blockedVerdict = checkGuardrails(blockedDiff, config);
  check("diff ke daftar cegat ditolak", !blockedVerdict.ok);
  check("alasan cegat ikut terbawa", blockedVerdict.blocklistHits.length === 1);

  section("Klasifikasi jalur");
  check(
    "daftar cegat selalu Jalur 3",
    classifyLane(blockedDiff, blockedVerdict.blocklistHits, greenRspec, config) === 3,
  );

  const smallGood = makeDiff(
    [
      ["app/helpers/file_helper.rb", 3],
      ["spec/helpers/file_helper_spec.rb", 20],
    ],
    ["spec/helpers/file_helper_spec.rb"],
  );

  check(
    "Jalur 1 mati secara default → Jalur 2",
    classifyLane(smallGood, [], greenRspec, config) === 2,
  );

  const lane1On: Config = {
    ...config,
    laneRules: { ...config.laneRules, lane1Enabled: true },
  };

  check(
    "Jalur 1 aktif + syarat lengkap → Jalur 1",
    classifyLane(smallGood, [], greenRspec, lane1On) === 1,
  );
  check(
    "Jalur 1 aktif tapi test merah → Jalur 2",
    classifyLane(smallGood, [], redRspec, lane1On) === 2,
  );
  check(
    "Jalur 1 aktif tapi test tidak jalan → Jalur 2",
    classifyLane(smallGood, [], null, lane1On) === 2,
  );

  const noNewTests = makeDiff([["app/helpers/file_helper.rb", 3]], []);
  check(
    "Jalur 1 aktif tapi tanpa spec baru → Jalur 2",
    classifyLane(noNewTests, [], greenRspec, lane1On) === 2,
  );

  const bigButClean = makeDiff(
    [
      ["app/helpers/file_helper.rb", lane1On.laneRules.lane1MaxDiffLines + 5],
      ["spec/helpers/file_helper_spec.rb", 10],
    ],
    ["spec/helpers/file_helper_spec.rb"],
  );
  check(
    "Jalur 1 aktif tapi diff terlalu besar → Jalur 2",
    classifyLane(bigButClean, [], greenRspec, lane1On) === 2,
  );

  const outsideCovered = makeDiff(
    [
      ["app/domains/report/queries/cash_closing_query.rb", 4],
      ["spec/domains/report/queries/cash_closing_query_spec.rb", 15],
    ],
    ["spec/domains/report/queries/cash_closing_query_spec.rb"],
  );
  check(
    "Jalur 1 aktif tapi area belum tercakup → Jalur 2",
    classifyLane(outsideCovered, [], greenRspec, lane1On) === 2,
  );

  section("Substitusi argumen command");
  const filled = fillArgs(
    ["-p", "{{prompt}}", "--allowedTools", "{{allowedTools}}"],
    { prompt: "halo dunia", allowedTools: "Read,Grep" },
  );
  check(
    "placeholder tunggal terisi",
    filled.join("|") === "-p|halo dunia|--allowedTools|Read,Grep",
    filled.join("|"),
  );

  const withArray = fillArgs(
    ["exec", "rspec", "--out", "{{outFile}}", "{{targets}}"],
    { outFile: "tmp/x.json", targets: ["spec/a_spec.rb", "spec/b_spec.rb"] },
  );
  check(
    "array jadi beberapa argumen",
    withArray.length === 6 && withArray[4] === "spec/a_spec.rb" && withArray[5] === "spec/b_spec.rb",
    withArray.join("|"),
  );

  const prompty = fillArgs(["{{prompt}}"], { prompt: "$(rm -rf /) `whoami`" });
  check(
    "teks berbahaya tetap satu argumen utuh",
    prompty.length === 1 && prompty[0] === "$(rm -rf /) `whoami`",
  );

  section("Parsing keluaran rencana");
  const planOk = `## Verdict\nOK\n\n## Files to touch\n- app/helpers/file_helper.rb — regex sanitasi\n- spec/helpers/file_helper_spec.rb — tambah spec\n\n## Change\nubah regex\n`;
  check("verdict OK terbaca", parseVerdict(planOk) === "OK");
  check(
    "daftar file rencana terbaca",
    parsePlannedFiles(planOk).length === 2 &&
      parsePlannedFiles(planOk)[0] === "app/helpers/file_helper.rb",
    parsePlannedFiles(planOk).join(","),
  );

  check(
    "verdict OUT_OF_SCOPE terbaca",
    parseVerdict("## Verdict\nOUT_OF_SCOPE\n") === "OUT_OF_SCOPE",
  );
  check(
    "verdict NEEDS_SPEC terbaca",
    parseVerdict("## Verdict\nNEEDS_SPEC\n") === "NEEDS_SPEC",
  );
  check("verdict tidak ada → UNKNOWN", parseVerdict("halo") === "UNKNOWN");

  section("Konsistensi config");
  check(
    "Jalur 1 mati di config yang dikirim",
    config.laneRules.lane1Enabled === false,
    "harus mati sampai ada data yang membuktikan layak",
  );
  check(
    "area tercakup tidak beririsan dengan daftar cegat",
    config.laneRules.coveredPathPrefixes.every(
      (prefix) => matchBlocklist([`${prefix}x.rb`], config.blocklist).length === 0,
    ),
  );
  check("daftar cegat tidak kosong", config.blocklist.length > 0);
  check(
    "setiap entri cegat punya alasan",
    config.blocklist.every((b) => typeof b.reason === "string" && b.reason.length > 0),
  );
}

const configPath = process.argv[2] ?? "config/pipeline.json";
console.log(`Self-test guardrail — config: ${configPath}`);

try {
  run(loadConfig(configPath));
} catch (err) {
  console.log(`\n✗ tidak bisa memuat config: ${(err as Error).message}`);
  failed += 1;
}

console.log(`\n${String(passed)} lolos, ${String(failed)} gagal.`);
process.exitCode = failed === 0 ? 0 : 1;
