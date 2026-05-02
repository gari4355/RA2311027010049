import { getToken, refreshToken } from "../../src/auth";
import Log from "../../logging-middleware/src/index";

const BASE_URL = "http://20.207.122.201/evaluation-service";

interface Notification {
  ID: string;
  Type: "Placement" | "Result" | "Event";
  Message: string;
  Timestamp: string;
}

interface ScoredNotification extends Notification {
  priorityScore: number;
}

// Weight by type: placement > result > event
const TYPE_WEIGHT: Record<string, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

const TOP_N = 10;

function computePriorityScore(n: Notification, now: Date): number {
  const ageMs = now.getTime() - new Date(n.Timestamp).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  // Recency score: decay over time (higher = more recent)
  const recencyScore = 1 / (1 + ageHours);
  const weight = TYPE_WEIGHT[n.Type] ?? 1;
  return weight * (1 + recencyScore);
}

function getTopN(notifications: Notification[], n: number): ScoredNotification[] {
  const now = new Date();
  const scored = notifications.map((notif) => ({
    ...notif,
    priorityScore: computePriorityScore(notif, now),
  }));
  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  return scored.slice(0, n);
}

async function fetchWithAuth(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  return res.json();
}

async function main() {
  await Log("frontend", "info", "page", "Priority Inbox starting up");

  let token = await getToken();

  await Log("frontend", "info", "api", "Fetching notifications from evaluation server");
  let data: any;
  try {
    data = await fetchWithAuth(`${BASE_URL}/notifications`, token);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") {
      token = await refreshToken();
      data = await fetchWithAuth(`${BASE_URL}/notifications`, token);
    } else throw e;
  }

  const notifications: Notification[] = data.notifications;
  await Log(
    "frontend",
    "info",
    "api",
    `Fetched ${notifications.length} notifications successfully`
  );

  const topNotifications = getTopN(notifications, TOP_N);

  await Log(
    "frontend",
    "info",
    "page",
    `Computed top ${TOP_N} priority notifications using weight+recency scoring`
  );

  console.log("\n========================================");
  console.log(`  Priority Inbox - Top ${TOP_N} Notifications`);
  console.log("========================================\n");

  topNotifications.forEach((n, i) => {
    console.log(`#${i + 1} [${n.Type}] ${n.Message}`);
    console.log(`     ID: ${n.ID}`);
    console.log(`     Time: ${n.Timestamp}`);
    console.log(`     Priority Score: ${n.priorityScore.toFixed(4)}`);
    console.log();
  });

  await Log(
    "frontend",
    "info",
    "page",
    `Priority Inbox displayed top ${TOP_N} notifications successfully`
  );

  return topNotifications;
}

main().catch(async (err) => {
  await Log("frontend", "fatal", "page", `Priority inbox crashed: ${err.message}`);
  console.error(err);
  process.exit(1);
});

export { getTopN, computePriorityScore };
