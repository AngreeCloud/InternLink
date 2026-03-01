import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

async function cleanupFirebaseDebugLogs() {
  const workspaceRoot = process.cwd();
  const entries = await readdir(workspaceRoot, { withFileTypes: true });

  const debugLogs = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^firebase-debug.*\.log$/i.test(name));

  await Promise.all(
    debugLogs.map(async (name) => {
      try {
        await unlink(join(workspaceRoot, name));
      } catch {
        // Ignore cleanup errors to avoid masking test results.
      }
    })
  );
}

const testProcess = spawn(
  process.execPath,
  ["--test", "tests/firestore/school-isolation.rules.test.mjs"],
  {
    stdio: "inherit",
  }
);

testProcess.on("close", async (code) => {
  await cleanupFirebaseDebugLogs();
  process.exit(code ?? 1);
});

testProcess.on("error", async () => {
  await cleanupFirebaseDebugLogs();
  process.exit(1);
});
