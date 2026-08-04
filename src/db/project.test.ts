import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./connection.js";
import {
  createProject,
  getCurrentProject,
  markProjectReady,
  markProjectFailed,
  clearProject,
  getProjectRepoPath,
} from "./project.js";

function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "project-test-"));
  return openDb(join(dir, "db.sqlite"));
}

function testFreshDatabaseHasNoProject(): void {
  const db = openTestDb();
  assert.equal(getCurrentProject(db), null);
  console.log("PASS: testFreshDatabaseHasNoProject");
}

function testCreateProjectStartsInCloningStatus(): void {
  const db = openTestDb();
  const project = createProject(db, {
    provider: "github",
    owner: "acme",
    repoSlug: "widgets",
    defaultBranch: "main",
  });

  assert.equal(project.provider, "github");
  assert.equal(project.owner, "acme");
  assert.equal(project.repoSlug, "widgets");
  assert.equal(project.defaultBranch, "main");
  assert.equal(project.cloneStatus, "cloning");
  assert.equal(project.cloneError, null);
  assert.equal(typeof project.id, "string");
  assert.ok(project.id.length > 0);
  assert.equal(typeof project.connectedAt, "string");
  console.log("PASS: testCreateProjectStartsInCloningStatus");
}

function testGetCurrentProjectReturnsMostRecentlyConnected(): void {
  const db = openTestDb();
  createProject(db, { provider: "github", owner: "acme", repoSlug: "old", defaultBranch: "main" });
  const newest = createProject(db, {
    provider: "bitbucket",
    owner: "acme",
    repoSlug: "new",
    defaultBranch: "main",
  });

  const current = getCurrentProject(db);
  assert.equal(current?.id, newest.id);
  console.log("PASS: testGetCurrentProjectReturnsMostRecentlyConnected");
}

function testMarkProjectReadySetsStatus(): void {
  const db = openTestDb();
  const project = createProject(db, {
    provider: "github",
    owner: "acme",
    repoSlug: "widgets",
    defaultBranch: "main",
  });

  const updated = markProjectReady(db, project.id);
  assert.equal(updated.cloneStatus, "ready");
  assert.equal(updated.cloneError, null);
  console.log("PASS: testMarkProjectReadySetsStatus");
}

function testMarkProjectFailedSetsStatusAndError(): void {
  const db = openTestDb();
  const project = createProject(db, {
    provider: "github",
    owner: "acme",
    repoSlug: "widgets",
    defaultBranch: "main",
  });

  const updated = markProjectFailed(db, project.id, "network timeout");
  assert.equal(updated.cloneStatus, "failed");
  assert.equal(updated.cloneError, "network timeout");
  console.log("PASS: testMarkProjectFailedSetsStatusAndError");
}

function testClearProjectDeletesRow(): void {
  const db = openTestDb();
  const project = createProject(db, {
    provider: "github",
    owner: "acme",
    repoSlug: "widgets",
    defaultBranch: "main",
  });
  markProjectReady(db, project.id);

  clearProject(db);

  assert.equal(getCurrentProject(db), null);
  console.log("PASS: testClearProjectDeletesRow");
}

function testGetProjectRepoPathReturnsNullWhenNoProject(): void {
  const db = openTestDb();
  assert.equal(getProjectRepoPath(db, "/data/repos"), null);
  console.log("PASS: testGetProjectRepoPathReturnsNullWhenNoProject");
}

function testGetProjectRepoPathReturnsNullWhileCloning(): void {
  const db = openTestDb();
  createProject(db, {
    provider: "github",
    owner: "acme",
    repoSlug: "widgets",
    defaultBranch: "main",
  });
  assert.equal(getProjectRepoPath(db, "/data/repos"), null);
  console.log("PASS: testGetProjectRepoPathReturnsNullWhileCloning");
}

function testGetProjectRepoPathReturnsJoinedPathWhenReady(): void {
  const db = openTestDb();
  const project = createProject(db, {
    provider: "github",
    owner: "acme",
    repoSlug: "widgets",
    defaultBranch: "main",
  });
  markProjectReady(db, project.id);

  assert.equal(getProjectRepoPath(db, "/data/repos"), `/data/repos/${project.id}`);
  console.log("PASS: testGetProjectRepoPathReturnsJoinedPathWhenReady");
}

function main(): void {
  testFreshDatabaseHasNoProject();
  testCreateProjectStartsInCloningStatus();
  testGetCurrentProjectReturnsMostRecentlyConnected();
  testMarkProjectReadySetsStatus();
  testMarkProjectFailedSetsStatusAndError();
  testClearProjectDeletesRow();
  testGetProjectRepoPathReturnsNullWhenNoProject();
  testGetProjectRepoPathReturnsNullWhileCloning();
  testGetProjectRepoPathReturnsJoinedPathWhenReady();
}

main();
