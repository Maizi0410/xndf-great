// Publish non-secret Actions delivery metadata through Git, without touching main.
// This lets clients with Git access read actual run/artifact IDs when the API is blocked.
import { execFileSync } from "node:child_process";
const state = process.argv[2];
if (!["running", "completed"].includes(state))
  throw new Error("Expected running or completed");
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
if (
  !repository ||
  !/^[-\w.]+\/[-\w.]+$/.test(repository) ||
  !/^\d+$/.test(runId ?? "") ||
  server !== "https://github.com"
)
  throw new Error("Expected trusted GitHub Actions run metadata");
const artifactId = process.env.CLASSROOM_ARTIFACT_ID ?? "";
const artifactUrl = process.env.CLASSROOM_ARTIFACT_URL ?? "";
if (artifactId && !/^\d+$/.test(artifactId))
  throw new Error("Invalid artifact ID");
const runUrl = `${server}/${repository}/actions/runs/${runId}`;
if (artifactUrl && artifactUrl !== `${runUrl}/artifacts/${artifactId}`)
  throw new Error("Artifact URL does not belong to this run");
const receipt = {
  format: "permitted-world-classroom-build-v1",
  repository,
  run_id: runId,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT,
  source_commit: process.env.GITHUB_SHA,
  run_url: runUrl,
  state,
  recorded_at: new Date().toISOString(),
  job_result:
    state === "running"
      ? "pending"
      : (process.env.CLASSROOM_JOB_RESULT ?? "unknown"),
  artifact_id: artifactId || null,
  artifact_url: artifactUrl || null,
  artifact_name: artifactId
    ? "The-Permitted-World-Classroom-Mac-Apple-Silicon-arm64"
    : null,
  zip_filename: process.env.CLASSROOM_ZIP_FILENAME || null,
  zip_sha256: process.env.CLASSROOM_ZIP_SHA256 || null,
  package_validation: process.env.CLASSROOM_PACKAGE_RESULT || "not-run",
  offline_runtime_validation: process.env.CLASSROOM_OFFLINE_RESULT || "not-run",
  build_result: process.env.CLASSROOM_BUILD_RESULT || "not-run",
  error_tail: process.env.CLASSROOM_ERROR_TAIL || null,
  physical_camera: "not-tested",
  classroom_mac_installation: "not-tested",
};
const ref = "refs/heads/classroom-build-status";
const git = (args, options = {}) =>
  execFileSync("git", args, { encoding: "utf8", ...options }).trim();
for (let attempt = 0; attempt < 3; attempt++) {
  let parent = null;
  if (git(["ls-remote", "--heads", "origin", ref])) {
    git(["fetch", "--no-tags", "origin", ref]);
    parent = git(["rev-parse", "FETCH_HEAD"]);
    if (git(["ls-tree", "-r", "--name-only", parent]) !== "latest.json")
      throw new Error(
        "Status branch has unrelated files; refusing to replace them",
      );
    const previous = JSON.parse(git(["show", `${parent}:latest.json`]));
    if (
      previous.format !== receipt.format ||
      previous.repository !== repository
    )
      throw new Error("Unrecognized status branch; preserving it");
  }
  const blob = git(["hash-object", "-w", "--stdin"], {
    input: JSON.stringify(receipt, null, 2) + "\n",
  });
  const tree = git(["mktree"], { input: `100644 blob ${blob}\tlatest.json\n` });
  const commit = git(
    [
      "-c",
      "user.name=github-actions[bot]",
      "-c",
      "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit-tree",
      tree,
      ...(parent ? ["-p", parent] : []),
    ],
    { input: `Report classroom run ${runId}: ${state}\n` },
  );
  try {
    git(["push", "origin", `${commit}:${ref}`]);
    console.log(JSON.stringify(receipt, null, 2));
    break;
  } catch (error) {
    if (attempt === 2) throw error;
  }
}
