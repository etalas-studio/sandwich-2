import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import { upsertTicket } from "./tickets.js";
import { insertRun } from "./runs.js";
import { insertReview, getReviewForRun } from "./reviews.js";

function openTestDbWithRun() {
  const dir = mkdtempSync(join(tmpdir(), "reviews-test-"));
  const db = openDb(join(dir, "db.sqlite"));
  upsertTicket(db, { key: "PROJ-1", summary: "Fix typo", description: "Fix the typo" });
  const run = insertRun(db, {
    ticketKey: "PROJ-1",
    engine: "claude-code-headless",
    outcome: "ready_for_review",
    startedAt: new Date().toISOString(),
  });
  return { db, run };
}

function testInsertsAndReadsBackAReview(): void {
  const { db, run } = openTestDbWithRun();
  insertReview(db, {
    runId: run.id,
    mergeOutcome: "merged",
    editEffort: "minor_edits",
    reviewRounds: 2,
    reviewedAt: new Date().toISOString(),
  });

  const review = getReviewForRun(db, run.id);
  assert.ok(review);
  assert.equal(review!.mergeOutcome, "merged");
  assert.equal(review!.reviewRounds, 2);
  console.log("PASS: testInsertsAndReadsBackAReview");
}

function testOnlyOneReviewAllowedPerRun(): void {
  const { db, run } = openTestDbWithRun();
  insertReview(db, {
    runId: run.id,
    mergeOutcome: "merged",
    editEffort: "merged_as_is",
    reviewRounds: 1,
    reviewedAt: new Date().toISOString(),
  });

  assert.throws(() => {
    insertReview(db, {
      runId: run.id,
      mergeOutcome: "not_merged",
      editEffort: "major_edits",
      reviewRounds: 3,
      reviewedAt: new Date().toISOString(),
    });
  });
  console.log("PASS: testOnlyOneReviewAllowedPerRun");
}

function testGetReviewForRunReturnsNullWhenNotReviewedYet(): void {
  const { db, run } = openTestDbWithRun();
  assert.equal(getReviewForRun(db, run.id), null);
  console.log("PASS: testGetReviewForRunReturnsNullWhenNotReviewedYet");
}

function main(): void {
  testInsertsAndReadsBackAReview();
  testOnlyOneReviewAllowedPerRun();
  testGetReviewForRunReturnsNullWhenNotReviewedYet();
}

main();
