# Notification System Design

---

## Stage 1

### REST API Endpoints

#### Base URL
```
/api/v1
```

#### Authentication
All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

### Endpoints

#### 1. GET /api/v1/notifications
Fetch all notifications for the authenticated student.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement | Result | Event",
      "message": "string",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ],
  "total": 100,
  "unread": 12
}
```

---

#### 2. GET /api/v1/notifications/:id
Fetch a specific notification.

**Response:**
```json
{
  "id": "uuid",
  "type": "Placement",
  "message": "CSX Corporation hiring",
  "isRead": false,
  "createdAt": "2026-04-22T17:51:18Z"
}
```

---

#### 3. PATCH /api/v1/notifications/:id/read
Mark a notification as read.

**Response:**
```json
{
  "id": "uuid",
  "isRead": true,
  "updatedAt": "2026-04-22T18:00:00Z"
}
```

---

#### 4. PATCH /api/v1/notifications/read-all
Mark all notifications as read.

**Response:**
```json
{
  "message": "All notifications marked as read",
  "updatedCount": 12
}
```

---

#### 5. GET /api/v1/notifications/priority
Fetch top-N priority notifications (Priority Inbox - Stage 6).

**Query Params:**
- `n` (optional, default: 10) — number of top notifications to return

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement",
      "message": "CSX Corporation hiring",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18Z",
      "priorityScore": 3.42
    }
  ]
}
```

---

### Real-Time Mechanism

Use **WebSockets** for real-time notifications.

- Server pushes events to connected clients instantly.
- Endpoint: `ws://host/api/v1/notifications/live`
- On connect, server sends all unread notifications.
- On new notification, server broadcasts to the relevant student's socket.
- Fallback: HTTP long-polling if WebSocket is unavailable.

**WebSocket Message Format:**
```json
{
  "event": "new_notification",
  "data": {
    "id": "uuid",
    "type": "Placement",
    "message": "New job posting available",
    "createdAt": "2026-04-22T17:51:30Z"
  }
}
```

---

## Stage 2

### Recommended Database: PostgreSQL

**Reasoning:**
- Strong ACID compliance — critical for reliable notification delivery.
- Native support for enums (notification types), UUIDs, and indexes.
- Excellent support for complex queries (filtering, sorting, pagination).
- Scales well with read replicas for high-read workloads.

---

### DB Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  roll_no    VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_student_unread
  ON notifications(student_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_type
  ON notifications(type);
```

---

### Problems as Data Grows

1. **Query slowness** — unindexed columns make filtering expensive.
2. **Table bloat** — 50,000 students × many notifications = millions of rows.
3. **Write amplification** — marking all-read updates many rows at once.

---

### Solutions

1. **Indexing** — Add composite indexes on `(student_id, is_read, created_at)`.
2. **Partitioning** — Partition the `notifications` table by month using `created_at`.
3. **Archiving** — Move read notifications older than 30 days to an archive table.
4. **Caching** — Cache unread counts per student in Redis with TTL.

---

### SQL Queries

**Fetch all unread notifications for a student:**
```sql
SELECT * FROM notifications
WHERE student_id = '1042'
  AND is_read = false
ORDER BY created_at DESC;
```

**Fetch placement notifications from last 7 days:**
```sql
SELECT * FROM notifications
WHERE type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 3

### Query Analysis

The original query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Is this accurate?** Yes, functionally correct — it returns unread notifications for a student.

**Why is it slow?**
- `studentID` and `isRead` have no index → full table scan on 5,000,000 rows.
- `ORDER BY createdAt DESC` on an unindexed column forces a filesort.
- With 50,000 students and 5M notifications this is extremely expensive.

**Computation cost:** O(n) scan = ~5,000,000 rows examined per query.

---

### Colleague's Advice: Index Every Column

**Bad advice.** Indexing every column causes:
- Higher write costs (INSERT/UPDATE must update all indexes).
- Increased storage usage.
- Optimizer confusion — the query planner may choose suboptimal indexes.

---

### Correct Fix

Add a **selective composite index**:
```sql
CREATE INDEX idx_notifications_student_unread
  ON notifications(student_id, is_read, created_at DESC);
```

This index covers all three clauses in one structure → index scan instead of full table scan.

---

### Query: Placement Notifications in Last 7 Days

```sql
SELECT student_id FROM notifications
WHERE type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

Add supporting index:
```sql
CREATE INDEX idx_notifications_type_created
  ON notifications(type, created_at DESC);
```

---

## Stage 4

### Problem

The DB is queried on every page load for every student — causing overload.

---

### Solutions and Tradeoffs

#### Option 1: Redis Cache (Recommended)
- Cache unread notifications per student with TTL of 60 seconds.
- On page load, serve from cache. On new notification, invalidate cache.
- **Tradeoff:** Slight staleness (up to TTL), requires Redis infra.
- **Performance gain:** ~100x faster reads, DB load drops dramatically.

#### Option 2: Pagination
- Never fetch all notifications. Fetch 20 per page.
- **Tradeoff:** UX requires navigation, but DB never scans all rows.
- **Performance gain:** Query cost bounded to page size.

#### Option 3: Read Replicas
- Route all SELECT queries to a read replica.
- **Tradeoff:** Replication lag, added infra cost.
- **Performance gain:** Offloads all reads from primary DB.

#### Option 4: Precomputed Notification Feed
- Maintain a precomputed feed table updated by triggers.
- **Tradeoff:** Complex to keep consistent, but reads are O(1).

**Recommended combo:** Redis cache + pagination + composite index (Stage 3).

---

## Stage 5

### Pseudocode Shortcomings

```
function notify_all(student_ids: array, message: string):
  for student_id in student_ids:
    send_email(student_id, message)   # calls Email API
    save_to_db(student_id, message)   # DB insert
    push_to_app(student_id, message)  # real-time push
```

**Problems identified:**
1. **Sequential processing** — 50,000 students processed one-by-one. Extremely slow.
2. **Single point of failure** — if `send_email` fails at student 200, remaining 49,800 are never notified.
3. **No retry logic** — transient failures cause silent drops.
4. **Email API rate limit** — calling Email API 50,000 times in a loop will hit rate limits.
5. **No atomicity** — email may send but DB insert may fail (inconsistent state).
6. **Blocking** — the function blocks until all 50,000 students are processed.

---

### Should saving to DB and sending email happen together?

Yes — they should be atomic. If the email sends but the DB insert fails, the student has received a notification the system has no record of. If DB saves but email fails, the student is never notified.

**Solution:** Use an **outbox pattern** or a **message queue**.

---

### Revised Pseudocode

```
function notify_all(student_ids: array, message: string):
  // 1. Batch insert all notifications to DB atomically
  batch_insert_notifications(student_ids, message)  # single DB transaction

  // 2. Publish one event per student to message queue (e.g., Redis Queue / RabbitMQ)
  for student_id in student_ids:
    enqueue("notification_queue", { student_id, message })

  // 3. Worker pool (N workers) consumes queue concurrently
  // Each worker:
  //   - Dequeue job
  //   - send_email(student_id, message) with retry (max 3 attempts, exponential backoff)
  //   - push_to_app(student_id, message)
  //   - On permanent failure: log to dead_letter_queue for manual review
```

**Key improvements:**
- Batch DB insert = single transaction, O(1) DB round trips.
- Queue decouples notification dispatch from the HTTP request.
- Concurrent workers handle emails in parallel, respecting rate limits.
- Retry + dead-letter queue ensures reliability.
- Real-time push happens independently (WebSocket/SSE).

---

## Stage 6

### Priority Inbox Approach

**Goal:** Display the top-N most important unread notifications first.

**Priority Score Formula:**
```
priorityScore = typeWeight × (1 + recencyScore)
recencyScore  = 1 / (1 + ageInHours)
```

**Type Weights:**
| Type      | Weight |
|-----------|--------|
| Placement | 3      |
| Result    | 2      |
| Event     | 1      |

**Rationale:**
- Placement notifications are most actionable — students must respond quickly.
- Result notifications are important but not time-critical.
- Event notifications are informational.
- Recency decay ensures fresh notifications rank higher within the same type.

**Algorithm:**
1. Fetch all notifications from the API.
2. Score each notification using the formula.
3. Sort descending by score.
4. Return top N.

**Maintaining Top N with Incoming Notifications:**
- Use a **min-heap of size N** to efficiently track top-N as new notifications arrive.
- When a new notification comes in via WebSocket, compute its score and push to heap.
- If heap size > N, pop the minimum.
- This gives O(log N) insertion — much better than re-sorting the full list.

**Implementation:** See `notification_system/priority_inbox.ts`
