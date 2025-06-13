const fetch = require("node-fetch");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "Figsh";
const REPO = "ekuApp";
const FILE_PATH = "app/src/main/assets/index.html";
const BRANCH = "master";
const WORKFLOW_FILENAME = "build.yml"; // adjust if needed

exports.handler = async function (event, context) {
  const { content } = JSON.parse(event.body);

  // 1. Get current file SHA
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const file = await res.json();

  // 2. Commit update
  const commit = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Edited via Netlify editor",
      content: Buffer.from(content).toString("base64"),
      sha: file.sha,
      branch: BRANCH
    })
  });

  // 3. Trigger the GitHub Action workflow manually
  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ref: BRANCH })
  });

  // 4. Poll for workflow run to complete
  let runId, status;
  for (let i = 0; i < 20; i++) {
    const runsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const runs = await runsRes.json();
    const latestRun = runs.workflow_runs.find(r => r.name === "Build Android App" && r.head_branch === BRANCH);
    if (latestRun) {
      runId = latestRun.id;
      status = latestRun.status;
      if (status === "completed") break;
    }
    await new Promise(r => setTimeout(r, 10000)); // wait 10s
  }

  if (status !== "completed") {
    return {
      statusCode: 202,
      body: JSON.stringify({ message: "Saved but build is still running. Try again later." })
    };
  }

  // 5. Get artifacts (APK + AAB)
  const artifactsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/artifacts`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const artifacts = await artifactsRes.json();

  const apkArtifact = artifacts.artifacts.find(a => a.name.includes("apk") || a.name.includes("android-binaries"));
  const aabArtifact = artifacts.artifacts.find(a => a.name.includes("aab") || a.name.includes("android-binaries"));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "File saved and build complete.",
      apk_url: apkArtifact?.archive_download_url,
      aab_url: aabArtifact?.archive_download_url
    })
  };
};
