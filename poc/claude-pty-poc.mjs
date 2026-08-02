// Run this script from the poc/ directory, e.g.:  cd poc && node claude-pty-poc.mjs
import * as pty from "node-pty";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Use a throwaway directory so this never touches a real repo.
const scratchDir = mkdtempSync(join(tmpdir(), "claude-pty-poc-"));
writeFileSync(join(scratchDir, "hello.txt"), "hello from the PoC\n");

console.log(`Scratch dir: ${scratchDir}`);

const claudePath = "/Users/riaenriala/.local/share/claude/versions/2.1.220";

const term = pty.spawn(claudePath, ["What does hello.txt say? Just tell me the contents."], {
  name: "xterm-256color",
  cols: 120,
  rows: 30,
  cwd: scratchDir,
  env: process.env,
});

let rawBuffer = "";
let sawTrustDialog = false;
let sawPermissionDialog = false;
let finished = false;

term.onData((chunk) => {
  rawBuffer += chunk;
  process.stdout.write(chunk); // mirror to our own terminal so we can watch it live

  // Trust dialog: "Is this a project you created or one you trust?"
  if (!sawTrustDialog && /Is.{0,80}this.{0,80}a.{0,80}project.{0,80}you.{0,80}trust\?/i.test(rawBuffer)) {
    sawTrustDialog = true;
    console.log("\n[POC] Detected trust dialog, sending Enter to accept default...");
    setTimeout(() => term.write("\r"), 500);
  }

  // Permission dialog detection (if any tool-use needs approval).
  if (!sawPermissionDialog && /do.{0,20}you.{0,20}want.{0,20}to.{0,20}(proceed|allow)/i.test(rawBuffer)) {
    sawPermissionDialog = true;
    console.log("\n[POC] Detected a permission dialog, sending Enter to accept default...");
    setTimeout(() => term.write("\r"), 500);
  }
});

term.onExit(({ exitCode }) => {
  finished = true;
  console.log(`\n[POC] Process exited with code ${exitCode}`);
  console.log(`[POC] sawTrustDialog=${sawTrustDialog} sawPermissionDialog=${sawPermissionDialog}`);

  // Check if the answer is extractable from the raw buffer
  const matchPoC = /hello.{0,50}from.{0,50}the.{0,50}PoC/i.test(rawBuffer);
  console.log(`[POC] Answer extractable from buffer: ${matchPoC ? "YES" : "NO"}`);
});

// Send /exit after 20s — Claude Code should have finished by then.
// This tests whether a clean exit is possible via the PTY.
setTimeout(() => {
  if (!finished) {
    console.log("\n[POC] Sending /exit to see if the session closes...");
    term.write("/exit\r");
  }
}, 20000);

// Safety timeout: if nothing happens in 90s, kill it and report failure.
setTimeout(() => {
  if (!finished) {
    console.log("\n[POC] TIMEOUT — process did not exit within 90s. Killing.");
    term.kill();
    process.exit(1);
  }
}, 90000);
