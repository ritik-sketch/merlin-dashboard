require("dotenv").config();
const connectDB = require("./db");
const Bug = require("./models/Bug");

function mapPriority(level) {
  if (level === "critical") return "P0";
  if (level === "error") return "P1";
  if (level === "warning") return "P2";
  return "P3";
}

function cleanTitle(title) {
  if (!title) return "Unknown error";
  let t = title.replace(/Env:\s*\[[^\]]*\]:\s*/i, "");
  if (t.length > 500) t = t.slice(0, 500) + "...";
  return t.trim();
}

async function run() {  
  const token = process.env.ROLLBAR_TOKEN;
  if (!token) {
    console.log("ROLLBAR_TOKEN nahi mila .env me!");
    return;
  }

  const url = "https://api.rollbar.com/api/1/items/?status=active&limit=20";
  const response = await fetch(url, {
    headers: { "X-Rollbar-Access-Token": token }
  });
  const data = await response.json();

  if (data.err) {
    console.log("Rollbar ne error diya:", data.message);
    return;
  }

  const items = data.result.items;
  console.log("Rollbar se", items.length, "items mile. Saving...");

  let added = 0;
  let updated = 0;

  for (const item of items) {
    const signature = "rollbar-" + item.counter;

    const bugData = {
      endpoint: item.environment ? "[" + item.environment + "]" : "",
      message: cleanTitle(item.title),
      source: "Rollbar",
      priority: mapPriority(item.level),
      count: item.total_occurrences || 1,
      errorType: item.level || "",
      browser: "",
      lastSeen: item.last_occurrence_timestamp
        ? new Date(item.last_occurrence_timestamp * 1000)
        : new Date()
    };

    const existing = await Bug.findOne({ errorSignature: signature });
    const reopenUpdate = {};
    if (!existing) {
      reopenUpdate.status = "New";
    } else if (existing.status === "Done") {
      reopenUpdate.status = "New";
      reopenUpdate.resolvedAt = null;
    }

    await Bug.findOneAndUpdate(
      { errorSignature: signature },
      {
        $set: {
          message: bugData.message,
          source: bugData.source,
          priority: bugData.priority,
          count: bugData.count,
          endpoint: bugData.endpoint,
          errorType: bugData.errorType,
          lastSeen: bugData.lastSeen,
          ...reopenUpdate
        },
        $setOnInsert: {
          createdAt: new Date(),
          archived: false,
          errorSignature: signature
        }
      },
      { upsert: true, returnDocument: "after" }
    );

    if (existing) updated++;
    else added++;
  }

  console.log("Rollbar Done! Added:", added, "| Updated:", updated);
}

module.exports = run;
