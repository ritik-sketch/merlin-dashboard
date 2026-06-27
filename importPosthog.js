require("dotenv").config();
const connectDB = require("./db");
const Bug = require("./models/Bug");

async function run() {
  const key = process.env.POSTHOG_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) {
    console.log("POSTHOG_KEY ya POSTHOG_PROJECT_ID nahi mila .env me!");
    return;
  }

  const url = "https://us.posthog.com/api/projects/" + projectId + "/events/?event=api_error_network&limit=100";
  const response = await fetch(url, {
    headers: { "Authorization": "Bearer " + key }
  });
  const data = await response.json();

  if (data.detail) {
    console.log("PostHog ne error diya:", data.detail);
    return;
  }

  const events = data.results || [];
  console.log("PostHog se", events.length, "events mile. Processing...");

  const grouped = {};

  for (const ev of events) {
    const props = ev.properties || {};
    const endpoint = props.endpoint || props.$current_url || "unknown";
    const eventType = ev.event || "error";
    const signature = "posthog-" + endpoint + "-" + eventType;

    if (!grouped[signature]) {
      grouped[signature] = {
        signature: signature,
        endpoint: endpoint,
        message: (props.error_message || "Error") + ": " + endpoint,
        errorType: eventType,
        method: props.method || "",
        page: props.$current_url || "",
        browser: (props.$browser || "") + (props.$os ? " / " + props.$os : ""),
        account: ev.distinct_id || "",
        count: 0,
        lastSeen: ev.timestamp || new Date()
      };
    }

    grouped[signature].count = grouped[signature].count + 1;

    if (ev.timestamp && new Date(ev.timestamp) > new Date(grouped[signature].lastSeen)) {
      grouped[signature].lastSeen = ev.timestamp;
    }
  }

  const groups = Object.values(grouped);
  console.log("Unique errors (deduped):", groups.length);

  let added = 0;
  let updated = 0;

  for (const g of groups) {
    const existing = await Bug.findOne({ errorSignature: g.signature });
    const reopenUpdate = {};
    if (!existing) {
      reopenUpdate.status = "New";
    } else if (existing.status === "Done") {
      reopenUpdate.status = "New";
      reopenUpdate.resolvedAt = null;
    }

    await Bug.findOneAndUpdate(
      { errorSignature: g.signature },
      {
        $set: {
          message: g.message,
          source: "PostHog",
          priority: "P1",
          count: g.count,
          endpoint: g.endpoint,
          errorType: g.errorType,
          method: g.method,
          page: g.page,
          browser: g.browser,
          account: g.account,
          lastSeen: new Date(g.lastSeen),
          ...reopenUpdate
        },
        $setOnInsert: {
          createdAt: new Date(),
          archived: false,
          errorSignature: g.signature
        }
      },
      { upsert: true, returnDocument: "after" }
    );

    if (existing) updated++;
    else added++;
  }

  console.log("PostHog Done! Added:", added, "| Updated:", updated);
}

module.exports = run;
