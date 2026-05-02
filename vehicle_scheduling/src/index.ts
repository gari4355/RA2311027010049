import { getToken, refreshToken } from "../../src/auth";
import Log from "../../logging-middleware/src/index";

const BASE_URL = "http://20.207.122.201/evaluation-service";

interface Task {
  TaskID: string;
  Duration: number;
  Impact: number;
}

interface Depot {
  ID: number;
  MechanicHours: number;
}

async function fetchWithAuth(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  return res.json();
}

/**
 * 0/1 Knapsack DP - O(n * capacity)
 * Returns selected tasks that maximize Impact within MechanicHours budget
 */
function knapsack(tasks: Task[], capacity: number): Task[] {
  const n = tasks.length;
  // dp[i][w] = max impact using first i tasks with w hours budget
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]; // don't take task
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  // Backtrack to find selected tasks
  const selected: Task[] = [];
  let w = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  return selected;
}

async function main() {
  await Log("backend", "info", "service", "Vehicle Maintenance Scheduler starting up");

  let token = await getToken();

  // Fetch depots
  await Log("backend", "info", "service", "Fetching depots from evaluation server");
  let depotsData: any;
  try {
    depotsData = await fetchWithAuth(`${BASE_URL}/depots`, token);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") {
      token = await refreshToken();
      depotsData = await fetchWithAuth(`${BASE_URL}/depots`, token);
    } else throw e;
  }
  const depots: Depot[] = depotsData.depots;
  await Log("backend", "info", "service", `Fetched ${depots.length} depots successfully`);

  // Fetch vehicles/tasks
  await Log("backend", "info", "service", "Fetching vehicle tasks from evaluation server");
  let vehiclesData: any;
  try {
    vehiclesData = await fetchWithAuth(`${BASE_URL}/vehicles`, token);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") {
      token = await refreshToken();
      vehiclesData = await fetchWithAuth(`${BASE_URL}/vehicles`, token);
    } else throw e;
  }
  const tasks: Task[] = vehiclesData.vehicles;
  await Log("backend", "info", "service", `Fetched ${tasks.length} vehicle tasks successfully`);

  console.log("\n========================================");
  console.log("  Vehicle Maintenance Scheduler Results");
  console.log("========================================\n");

  let grandTotalImpact = 0;
  let grandTotalHours = 0;

  for (const depot of depots) {
    await Log(
      "backend",
      "info",
      "service",
      `Running knapsack for depot ${depot.ID} with ${depot.MechanicHours} mechanic hours`
    );

    const selected = knapsack(tasks, depot.MechanicHours);
    const totalImpact = selected.reduce((sum, t) => sum + t.Impact, 0);
    const totalHours = selected.reduce((sum, t) => sum + t.Duration, 0);

    grandTotalImpact += totalImpact;
    grandTotalHours += totalHours;

    console.log(`Depot ${depot.ID} (Budget: ${depot.MechanicHours} hours)`);
    console.log(`  Selected ${selected.length} tasks`);
    console.log(`  Total Hours Used: ${totalHours} / ${depot.MechanicHours}`);
    console.log(`  Total Impact Score: ${totalImpact}`);
    console.log(`  Tasks:`);
    selected.forEach((t) => {
      console.log(`    - ${t.TaskID} | Duration: ${t.Duration}h | Impact: ${t.Impact}`);
    });
    console.log();

    await Log(
      "backend",
      "info",
      "service",
      `Depot ${depot.ID} result: ${selected.length} tasks selected, impact=${totalImpact}, hours=${totalHours}`
    );
  }

  console.log("========================================");
  console.log(`Grand Total Impact: ${grandTotalImpact}`);
  console.log(`Grand Total Hours:  ${grandTotalHours}`);
  console.log("========================================\n");

  await Log(
    "backend",
    "info",
    "service",
    `Scheduler complete. Grand total impact: ${grandTotalImpact}, hours: ${grandTotalHours}`
  );
}

main().catch(async (err) => {
  await Log("backend", "fatal", "service", `Vehicle scheduler crashed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
