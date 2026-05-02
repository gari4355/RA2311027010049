const { getToken, refreshToken } = require("../src/auth");
const { Log } = require("../logging-middleware/index");

const BASE_URL = "http://20.207.122.201/evaluation-service";

async function fetchWithAuth(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  return res.json();
}

function knapsack(tasks, capacity) {
  const n = tasks.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  const selected = [];
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
  let depotsData;
  try {
    depotsData = await fetchWithAuth(`${BASE_URL}/depots`, token);
  } catch (e) {
    if (e.message === "UNAUTHORIZED") {
      token = await refreshToken();
      depotsData = await fetchWithAuth(`${BASE_URL}/depots`, token);
    } else throw e;
  }

  const depots = depotsData.depots;
  await Log("backend", "info", "service", `Fetched ${depots.length} depots`);

  // Fetch vehicles
  await Log("backend", "info", "service", "Fetching vehicle tasks from evaluation server");
  let vehiclesData;
  try {
    vehiclesData = await fetchWithAuth(`${BASE_URL}/vehicles`, token);
  } catch (e) {
    if (e.message === "UNAUTHORIZED") {
      token = await refreshToken();
      vehiclesData = await fetchWithAuth(`${BASE_URL}/vehicles`, token);
    } else throw e;
  }

  const tasks = vehiclesData.vehicles;
  await Log("backend", "info", "service", `Fetched ${tasks.length} vehicle tasks`);

  console.log("\n========================================");
  console.log("  Vehicle Maintenance Scheduler Results");
  console.log("========================================\n");

  let grandTotalImpact = 0;

  for (const depot of depots) {
    const selected = knapsack(tasks, depot.MechanicHours);
    const totalImpact = selected.reduce((sum, t) => sum + t.Impact, 0);
    const totalHours = selected.reduce((sum, t) => sum + t.Duration, 0);
    grandTotalImpact += totalImpact;

    console.log(`Depot ${depot.ID} (Budget: ${depot.MechanicHours} hours)`);
    console.log(`  Tasks selected: ${selected.length}`);
    console.log(`  Hours used: ${totalHours} / ${depot.MechanicHours}`);
    console.log(`  Total Impact: ${totalImpact}`);
    selected.forEach((t) => {
      console.log(`    - ${t.TaskID} | Duration: ${t.Duration}h | Impact: ${t.Impact}`);
    });
    console.log();

    await Log("backend", "info", "service",
      `Depot ${depot.ID}: ${selected.length} tasks, impact=${totalImpact}, hours=${totalHours}`);
  }

  console.log(`Grand Total Impact: ${grandTotalImpact}`);
  await Log("backend", "info", "service", `Scheduler complete. Grand total impact: ${grandTotalImpact}`);
}

main().catch(async (err) => {
  await Log("backend", "fatal", "service", `Vehicle scheduler crashed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
