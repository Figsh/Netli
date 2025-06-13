// netlify/functions/save.js
const fetch = require("node-fetch");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "your-username";
const REPO = "your-repo";
const FILE_PATH = "index.html"; // file to update
const BRANCH = "main";

exports.handler = async function (event, context) {
  const { content } = JSON.parse(event.body);

  // Get current file SHA
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });

  const file = await res.json();

  // Commit update
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

  const data = await commit.json();
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "File updated", url: data.content.html_url })
  };
};
