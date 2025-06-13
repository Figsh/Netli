const fetch = require("node-fetch");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "Figsh";
const REPO = "ekuApp";

exports.handler = async function (event, context) {
  const { run_id } = event.queryStringParameters;
  
  if (!run_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing run_id parameter" })
    };
  }

  try {
    // Get workflow run status
    const runRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run_id}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const run = await runRes.json();
    
    if (!run) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Run not found" })
      };
    }

    // Get artifacts if completed
    let artifacts = [];
    if (run.status === "completed") {
      const artifactsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run_id}/artifacts`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const artifactsData = await artifactsRes.json();
      artifacts = artifactsData.artifacts || [];
    }

    // Format artifact links
    const formattedArtifacts = artifacts.map(artifact => ({
      name: artifact.name,
      download_url: `https://github.com/${OWNER}/${REPO}/actions/runs/${run_id}/artifacts/${artifact.id}`
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        run_url: run.html_url,
        artifacts: formattedArtifacts
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

