const { getToken, refreshToken } = require("../src/auth");
const { Log } = require("../logging-middleware/index");

const BASE_URL = "http://20.207.122.201/evaluation-service";
const TOP_N = 10;

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function computePriorityScore(n, now) {
  const ageHours = (now - new Date(n.Timestamp)) / (1000 * 60 * 60);
  const recency = 1 / (1 + ageHours);
  return (TYPE_WEIGHT[n.Type] || 1) * (1 + recency);
}

function getTopN(notifications, n) {
  const now = new Date();
  return notifications
    .map((notif) => ({ ...notif, score: computePriorityScore(notif, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

async function fetchWithAuth(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  return res.json();
}

async function main() {
  await Log("frontend", "info", "page", "Priority Inbox starting up");

  let token = await getToken();
  let data;
  try {
    data = await fetchWithAuth(`${BASE_URL}/notifications`, token);
  } catch (e) {
    if (e.message === "UNAUTHORIZED") {
      token = await refreshToken();
      data = await fetchWithAuth(`${BASE_URL}/notifications`, token);
    } else throw e;
  }

  const notifications = data.notifications;
  await Log("frontend", "info", "api", `Fetched ${notifications.length} notifications`);

  const top = getTopN(notifications, TOP_N);
  await Log("frontend", "info", "page", `Computed top ${TOP_N} notifications by weight+recency`);

  console.log("\n========================================");
  console.log(`  Priority Inbox - Top ${TOP_N} Notifications`);
  console.log("========================================\n");

  top.forEach((n, i) => {
    console.log(`#${i + 1} [${n.Type}] ${n.Message}`);
    console.log(`     ID: ${n.ID}`);
    console.log(`     Time: ${n.Timestamp}`);
    console.log(`     Score: ${n.score.toFixed(4)}`);
    console.log();
  });
}

main().catch(async (err) => {
  await Log("frontend", "fatal", "page", `Priority inbox crashed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
