import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const TEST_FILES = [
  "tests/firestore/school-isolation.rules.test.mjs",
  "tests/firestore/tutor-professor-access.rules.test.mjs",
  "tests/realtime/chat-creation.rules.test.mjs",
  "tests/realtime/user-tutors.rules.test.mjs",
];

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

async function runTests() {
  let exitCode = 0;

  for (const file of TEST_FILES) {
    const code = await new Promise((resolve) => {
      const proc = spawn(process.execPath, ["--test", file], {
        stdio: "inherit",
      });
      proc.on("close", resolve);
      proc.on("error", () => resolve(1));
    });

    if (code !== 0) {
      exitCode = code ?? 1;
    }
  }

  await cleanupFirebaseDebugLogs();
  process.exit(exitCode);
}

runTests();
