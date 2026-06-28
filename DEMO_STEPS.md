# Demo-Ready Implementation Steps

Three frontend-only changes. No backend restarts needed.

---

## Step 1 — Auto-configure Settings on first load (~30 min)

**Why:** A fresh browser has empty `localStorage` so every API call fails and the dashboard is blank. Pre-filling defaults means the app works immediately for anyone who clones and runs it.

### 1.1 Add first-run initializer to `App.tsx`

Inside the `App()` function, before the `return`, add:

```tsx
import { useEffect } from 'react'

useEffect(() => {
  const defaults: Record<string, string> = {
    api_base_url: 'http://localhost:3000',
    api_key:      'dev-operator-key',
    ingest_key:   'dev-ingest-key',
    log_gen_url:  'http://localhost:3100',
  }
  Object.entries(defaults).forEach(([k, v]) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, v)
  })
}, [])
```

The `!getItem` guard means it never overwrites a value the user has already changed.

### 1.2 Pre-fill Settings form from `localStorage`

In `apps/web/src/pages/Settings.tsx`, find the four `useState` calls at the top and change them to lazy initialisers:

```tsx
// Before
const [baseUrl, setBaseUrl] = useState('')

// After
const [baseUrl, setBaseUrl] = useState(
  () => localStorage.getItem('api_base_url') ?? 'http://localhost:3000'
)
const [apiKey, setApiKey] = useState(
  () => localStorage.getItem('api_key') ?? 'dev-operator-key'
)
const [ingestKey, setIngestKey] = useState(
  () => localStorage.getItem('ingest_key') ?? 'dev-ingest-key'
)
const [logGenUrl, setLogGenUrl] = useState(
  () => localStorage.getItem('log_gen_url') ?? 'http://localhost:3100'
)
```

**Result:** Fresh browser → dashboard shows real seeded data immediately. No manual Settings configuration needed.

---

## Step 2 — Demo Pipeline button (~1.5 hrs)

**Why:** Currently showing the anomaly→ticket pipeline requires Docker + Fluent Bit. This adds a "Run Demo" panel to the Log Monitor page that generates real errors from the dummy generator and forwards them to a job via ingest — all in the browser.

**File:** `apps/web/src/pages/LogMonitor.tsx`

### 2.1 Add state and fetch jobs

At the top of the `LogMonitor` component, add these alongside existing state:

```tsx
import { jobsApi, ingestApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

// state
const [selectedJobId, setSelectedJobId] = useState<string>('')
const [demoRunning, setDemoRunning]     = useState(false)
const [demoStatus, setDemoStatus]       = useState('')

// query
const { data: jobs = [] } = useQuery({
  queryKey: ['jobs'],
  queryFn: jobsApi.list,
})
```

### 2.2 Add the `runDemo` handler

Add this function inside the component, below the state declarations:

```tsx
const runDemo = async () => {
  if (!selectedJobId) return
  setDemoRunning(true)
  setDemoStatus('')

  try {
    // 1. Snapshot current sequence so we only read new logs
    const before = await logGenApi.recentLogs()
    const sinceSeq = before.latest

    // 2. Trigger 5 errors on the dummy generator
    setDemoStatus('Generating errors...')
    await logGenApi.generateBatch(5)

    // 3. Wait briefly then fetch only the new entries
    await new Promise(r => setTimeout(r, 800))
    const after = await logGenApi.recentLogs(sinceSeq)

    // 4. Forward to the selected job via ingest
    setDemoStatus('Forwarding to job...')
    const records = after.logs.map(l => ({
      level:   l.level === 'error' ? 'critical' : l.level,
      message: l.message,
      service: l.service as string | undefined,
    }))
    await ingestApi.send(selectedJobId, records)

    setDemoStatus('Done — check Anomalies and Tickets')
  } catch (e) {
    setDemoStatus('Error: ' + (e instanceof Error ? e.message : 'unknown'))
  } finally {
    setDemoRunning(false)
  }
}
```

### 2.3 Add the Demo Panel UI

Place this card above the existing log stream in the JSX:

```tsx
<Card className="mb-4 border-green-900/40 bg-green-950/20">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm text-green-400">Demo Pipeline</CardTitle>
    <CardDescription>
      Generate errors and forward them to a job in one click
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-3">
      <Select value={selectedJobId} onValueChange={setSelectedJobId}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select a job..." />
        </SelectTrigger>
        <SelectContent>
          {jobs.map(j => (
            <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={runDemo}
        disabled={!selectedJobId || demoRunning}
        className="bg-green-700 hover:bg-green-600"
      >
        {demoRunning ? 'Running...' : 'Run Demo'}
      </Button>
      {demoStatus && (
        <span className="text-xs text-muted-foreground">{demoStatus}</span>
      )}
    </div>
  </CardContent>
</Card>
```

Make sure `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, and `Button` are all imported at the top of the file.

**Result:** Select a job → click Run Demo → navigate to Anomalies to see the new entry → navigate to Tickets to see the auto-created ticket. Full pipeline in under 10 seconds, no Docker needed.

---

## Step 3 — Relative timestamps (~45 min)

**Why:** Raw ISO strings like `2026-06-28T10:12:43.000Z` feel static. "3 hours ago" feels live.

### 3.1 Install date-fns

Run from the monorepo root:

```bash
pnpm --filter web add date-fns
```

### 3.2 Add helper to `utils.ts`

Append to `apps/web/src/lib/utils.ts`:

```ts
import { formatDistanceToNow } from 'date-fns'

export function relativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}
```

### 3.3 Replace raw dates in each page

Import and use in these four files:

| File | Where |
|------|-------|
| `src/pages/Dashboard.tsx` | Recent jobs table, recent tickets table |
| `src/pages/AnalysisJobs.tsx` | Jobs table `createdAt` column |
| `src/pages/Anomalies.tsx` | Anomalies table (if dates shown) |
| `src/pages/Tickets.tsx` | Tickets table `createdAt` column |

Pattern to apply in each file:

```tsx
import { relativeTime } from '@/lib/utils'

// Before
<td>{item.createdAt}</td>

// After — wrap in a span with title so exact date shows on hover
<td>
  <span title={item.createdAt} className="text-muted-foreground text-sm">
    {relativeTime(item.createdAt)}
  </span>
</td>
```

**Result:** All dates across the app show human-readable relative labels. Hovering any date still reveals the full ISO timestamp.
