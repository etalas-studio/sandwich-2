import { readFileSync, readdirSync, statSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json", ".ico",
]);

export function getokuiSourceDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "getokui");
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export function copyReferencesTo(workspace: string, sourceDir = getokuiSourceDir()): string {
  if (!existsSync(sourceDir)) {
    throw new Error(`getokui references not found at ${sourceDir}`);
  }
  const dest = join(workspace, ".getokui");
  copyDirRecursive(sourceDir, dest);
  return dest;
}

export function isPrototypeFile(relPath: string): boolean {
  if (relPath === ".getokui" || relPath.startsWith(".getokui/")) return false;
  const dot = relPath.lastIndexOf(".");
  const ext = dot >= 0 ? relPath.slice(dot).toLowerCase() : "";
  return ALLOWED_EXTENSIONS.has(ext);
}

export function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export function readPrototypeFiles(workspace: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  for (const fullPath of listFilesRecursive(workspace)) {
    const relPath = relative(workspace, fullPath).split("\\").join("/");
    if (!isPrototypeFile(relPath)) continue;
    results.push({ path: relPath, content: readFileSync(fullPath, "utf-8") });
  }
  return results;
}
