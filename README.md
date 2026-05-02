Evaluation
**Roll No:** RA2311027010049  
**Email:** gt7412@srmist.edu.in  
**GitHub:** gari4355

---

## Project Structure

```
├── setup.sh                          # One-time registration + auth setup
├── push.sh                           # Quick git push helper
├── src/
│   └── auth.ts                       # Auth token management
├── logging-middleware/
│   └── src/index.ts                  # Reusable Log(stack,level,pkg,msg) function
├── vehicle_scheduling/
│   └── src/index.ts                  # Vehicle Maintenance Scheduler (knapsack)
└── notification_system/
    ├── priority_inbox.ts             # Stage 6: Priority Inbox
    └── notification_system_design.md # Stages 1-6 design document
```

---

## Setup

### 1. First-time setup (register + get auth token)
```bash
bash setup.sh
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run Vehicle Scheduler
```bash
npm run vehicle
```

### 4. Run Priority Inbox (Stage 6)
```bash
npm run notifications
```

---

## Logging Middleware

The `Log` function sends structured logs to the evaluation server:

```typescript
import Log from "./logging-middleware/src/index";

await Log("backend", "info", "service", "Application started");
await Log("backend", "error", "handler", "received string, expected bool");
await Log("frontend", "warn", "component", "Missing prop: userId");
```

---

## Vehicle Maintenance Scheduler

Solves the 0/1 Knapsack problem:
- Fetches depots (each with a `MechanicHours` budget) from the API
- Fetches vehicle tasks (each with `Duration` and `Impact`) from the API
- For each depot, selects the optimal subset of tasks to maximize total `Impact` within the `MechanicHours` budget
- Uses dynamic programming — O(n × capacity) time complexity

---

## Campus Notifications (Stages 1-6)

See [`notification_system/notification_system_design.md`](notification_system/notification_system_design.md)

| Stage | Description |
|-------|-------------|
| 1 | REST API design + real-time mechanism (WebSocket) |
| 2 | DB choice (PostgreSQL), schema, scalability strategies |
| 3 | Query analysis, indexing advice, 7-day placement query |
| 4 | Performance strategies: caching, pagination, read replicas |
| 5 | notify_all redesign: batch insert + message queue + workers |
| 6 | Priority Inbox: weight × recency scoring, min-heap for streaming |
