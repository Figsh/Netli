const fetch = require("node-fetch");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "Figsh";
const REPO = "ekuApp";
const FILE_PATH = "app/src/main/assets/index.html";
const NAME_PATH = "app/src/main/res/values/strings.xml";
const BRANCH = "master";
const WORKFLOW_FILENAME = "build.yml";

// Define mipmap directories
const MIPMAP_PATHS = {
  "mipmap-mdpi.png": "app/src/main/res/mipmap-mdpi/ic_launcher.png",
  "mipmap-hdpi.png": "app/src/main/res/mipmap-hdpi/ic_launcher.png",
  "mipmap-xhdpi.png": "app/src/main/res/mipmap-xhdpi/ic_launcher.png",
  "mipmap-xxhdpi.png": "app/src/main/res/mipmap-xxhdpi/ic_launcher.png",
  "mipmap-xxxhdpi.png": "app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", 
  "mipmap-xxxhdpi.png": "app/src/main/ic_launcher-web.png", 
  "mipmap-xxxhdpi.png": "app/src/main/res/ic_launcher.png"
};

exports.handler = async function (event, context) {
  const { content, appName, icons } = JSON.parse(event.body);

  try {
    // 1. Update index.html
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const file = await res.json();

    await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Updated index.html via Netlify",
        content: Buffer.from(content).toString("base64"),
        sha: file.sha,
        branch: BRANCH
      })
    });

    // 2. Update app icons
    if (icons && Array.isArray(icons)) {
      for (const icon of icons) {
        const { name, base64 } = icon;
        const iconPath = MIPMAP_PATHS[name];

        if (!iconPath) {
          throw new Error(`Invalid icon file name: ${name}. Expected one of ${Object.keys(MIPMAP_PATHS).join(", ")}`);
        }

        // Fetch existing file to get SHA
        const iconRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${iconPath}`, {
          headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        const iconFile = await iconRes.json();

        if (!iconFile.sha) {
          throw new Error(`Could not fetch SHA for ${iconPath}. Ensure the file exists in the repository.`);
        }

        // Update icon file
        await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${iconPath}`, {
          method: "PUT",
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: `Updated ${name} via Netlify`,
            content: base64,
            sha: iconFile.sha,
            branch: BRANCH
          })
        });
      }
    } else {
      throw new Error("No icons provided or invalid format.");
    }

    // 3. Update app name in strings.xml
    if (appName) {
      const nameRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${NAME_PATH}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const nameFile = await nameRes.json();
      const xmlDecoded = Buffer.from(nameFile.content, "base64").toString("utf-8");
      const newXml = xmlDecoded.replace(/<string name="app_name">(.*?)<\/string>/, `<string name="app_name">${appName}</string>`);

      await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${NAME_PATH}`, {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Updated app name via Netlify",
          content: Buffer.from(newXml).toString("base64"),
          sha: nameFile.sha,
          branch: BRANCH
        })
      });
    }

    // 4. Trigger GitHub Action
    await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILENAME}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: BRANCH })
    });

    // 5. Poll for workflow run
    let runId, runUrl;
    for (let i = 0; i < 10; i++) {
      const runsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?event=workflow_dispatch`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const runs = await runsRes.json();

      if (runs.workflow_runs && runs.workflow_runs.length > 0) {
        const latestRun = runs.workflow_runs.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];
        runId = latestRun.id;
        runUrl = latestRun.html_url;
        break;
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    if (!runId) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Build started! Run ID not immediately available.",
          run_url: `https://github.com/${OWNER}/${REPO}/actions`
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Build started successfully!",
        run_id: runId,
        run_url: runUrl
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
