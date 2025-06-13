const fetch = require("node-fetch");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "Figsh";
const REPO = "ekuApp";
const FILE_PATH = "app/src/main/assets/index.html";
const BRANCH = "master";
const WORKFLOW_FILENAME = "build.yml";

exports.handler = async function (event, context) {
  const { content } = JSON.parse(event.body);

  try {
    // 1. Get current file SHA
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const file = await res.json();

    // 2. Commit update
    await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
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

    // 3. Trigger GitHub Action
    await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: BRANCH })
    });

    // 4. Find the new workflow run
    let runId;
    for (let i = 0; i < 10; i++) {
      const runsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?event=workflow_dispatch&status=queued`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const runs = await runsRes.json();
      
      if (runs.workflow_runs && runs.workflow_runs.length > 0) {
        runId = runs.workflow_runs[0].id;
        break;
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!runId) {
      return {
        statusCode: 202,
        body: JSON.stringify({ 
          message: "Build started but run ID not found. Check GitHub Actions.",
          status: "pending",
          run_url: `https://github.com/${OWNER}/${REPO}/actions`
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Build started successfully!",
        run_id: runId,
        status: "queued",
        run_url: `https://github.com/${OWNER}/${REPO}/actions/runs/${runId}`
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
