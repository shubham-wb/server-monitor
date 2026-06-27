import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, ClipboardList, ChevronRight, Copy, Terminal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { jobsApi, remoteServersApi, logSourcesApi, type LogAnalysisJob } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

const jobStatusVariant = (s: string) =>
  s === 'running' ? 'success' : s === 'failed' ? 'destructive' : s === 'completed' ? 'secondary' : 'outline'

function JobForm({ job, onClose }: { job?: LogAnalysisJob; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(job?.name || '')
  const [description, setDescription] = useState(job?.description || '')
  const [type, setType] = useState(job?.type || 'one_time')
  const [serverId, setServerId] = useState(job?.remoteServer?.id || '')
  const [sourceId, setSourceId] = useState(job?.logSource?.id || '')
  const [ticketingEnabled, setTicketingEnabled] = useState(!!job?.ticketingSystemConfig)
  const [ticketingType, setTicketingType] = useState(
    (job?.ticketingSystemConfig as Record<string, string>)?.type || 'internal'
  )

  const servers = useQuery({ queryKey: ['servers'], queryFn: remoteServersApi.list })
  const sources = useQuery({ queryKey: ['log-sources'], queryFn: logSourcesApi.list })

  const create = useMutation({
    mutationFn: () => jobsApi.create({
      name, description, type, remoteServerId: serverId,
      logSourceId: sourceId || undefined,
      ticketingSystemConfig: ticketingEnabled ? { type: ticketingType } : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast({ title: 'Job created' }); onClose() },
    onError: () => toast({ title: 'Failed to create job', variant: 'destructive' }),
  })

  const update = useMutation({
    mutationFn: () => jobsApi.update(job!.id, { name, description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast({ title: 'Job updated' }); onClose() },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!job && !serverId) { toast({ title: 'Select a server', variant: 'destructive' }); return }
    job ? update.mutate() : create.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="prod-analysis" required />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      {!job && (
        <>
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One-time</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Remote Server *</Label>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger><SelectValue placeholder="Select server..." /></SelectTrigger>
              <SelectContent>
                {(servers.data || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Log Source (optional)</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {(sources.data || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ticketing"
                checked={ticketingEnabled}
                onChange={e => setTicketingEnabled(e.target.checked)}
                className="rounded border-white/20 bg-white/5"
              />
              <Label htmlFor="ticketing">Enable ticketing</Label>
            </div>
            {ticketingEnabled && (
              <Select value={ticketingType} onValueChange={setTicketingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {job ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DockerConnectPanel({ job }: { job: LogAnalysisJob }) {
  const ingestKey = localStorage.getItem('ingest_key') || 'your-ingest-key'

  const psCmd = `$env:LOG_ANALYSIS_JOB_ID="${job.id}"; $env:INGEST_KEY="${ingestKey}"; docker compose up --build`
  const bashCmd = `LOG_ANALYSIS_JOB_ID=${job.id} INGEST_KEY=${ingestKey} docker compose up --build`

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-blue-400" />
        <p className="text-sm font-medium text-blue-300">Connect to Fluent Bit / Docker</p>
      </div>
      <p className="text-xs text-gray-400">
        Run from <code className="bg-white/5 px-1 rounded">apps/dummy-log-generator/</code>. Fluent Bit will forward error logs to this job automatically.
      </p>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Job ID</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-black/40 px-3 py-1.5 text-xs text-gray-300 font-mono break-all">{job.id}</code>
            <button onClick={() => copy(job.id)} className="text-gray-500 hover:text-gray-300 shrink-0">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">PowerShell</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 rounded bg-black/40 px-3 py-2 text-xs text-green-300 font-mono break-all">{psCmd}</code>
            <button onClick={() => copy(psCmd)} className="text-gray-500 hover:text-gray-300 mt-1 shrink-0">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">bash / Git Bash</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 rounded bg-black/40 px-3 py-2 text-xs text-green-300 font-mono break-all">{bashCmd}</code>
            <button onClick={() => copy(bashCmd)} className="text-gray-500 hover:text-gray-300 mt-1 shrink-0">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {ingestKey === 'your-ingest-key' && (
        <p className="text-xs text-yellow-500">
          ⚠ Set your Ingest Key in Settings first so the command above uses the real value.
        </p>
      )}
    </div>
  )
}

export function AnalysisJobs() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LogAnalysisJob | undefined>()
  const [connectJob, setConnectJob] = useState<LogAnalysisJob | undefined>()
  const { data, isLoading } = useQuery({ queryKey: ['jobs'], queryFn: jobsApi.list })

  const remove = useMutation({
    mutationFn: jobsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast({ title: 'Job deleted' }) },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Analysis Jobs</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage log analysis job configurations</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }} size="sm">
          <Plus className="h-4 w-4" /> New Job
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-500">Loading...</div>
      ) : (data || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No jobs yet. Create your first analysis job.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-white/6 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/3 border-b border-white/6">
              <tr>
                {['Name', 'Status', 'Type', 'Server', 'Updated', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {(data || []).map(j => (
                <tr key={j.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-200">{j.name}</p>
                    {j.description && <p className="text-xs text-gray-600 mt-0.5 truncate max-w-40">{j.description}</p>}
                  </td>
                  <td className="px-4 py-3"><Badge variant={jobStatusVariant(j.status)}>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{j.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{j.remoteServer?.name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDistanceToNow(new Date(j.updatedAt), { addSuffix: true })}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-400"
                        title="Connect to Docker / Fluent Bit"
                        onClick={() => setConnectJob(connectJob?.id === j.id ? undefined : j)}
                      >
                        <Terminal className="h-3.5 w-3.5" />
                      </Button>
                      <Link to={`/anomalies?jobId=${j.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View anomalies">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(j); setFormOpen(true) }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => confirm('Delete this job?') && remove.mutate(j.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {connectJob && <DockerConnectPanel job={connectJob} />}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Job' : 'New Analysis Job'}</DialogTitle>
          </DialogHeader>
          <JobForm job={editing} onClose={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
