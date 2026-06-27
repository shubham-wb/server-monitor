import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { logSourcesApi, type LogSource } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

function SourceForm({ source, onClose }: { source?: LogSource; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(source?.name || '')
  const [description, setDescription] = useState(source?.description || '')
  const [type, setType] = useState(source?.type || 'prometheus')
  const [status, setStatus] = useState(source?.status || 'unknown')
  const [configStr, setConfigStr] = useState(source ? JSON.stringify(source.config, null, 2) : '{}')

  const create = useMutation({
    mutationFn: () => logSourcesApi.create({ name, description, type, config: JSON.parse(configStr) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['log-sources'] }); toast({ title: 'Log source created' }); onClose() },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  })
  const update = useMutation({
    mutationFn: () => logSourcesApi.update(source!.id, { name, description, type, status, config: JSON.parse(configStr) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['log-sources'] }); toast({ title: 'Log source updated' }); onClose() },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try { JSON.parse(configStr) } catch { toast({ title: 'Invalid JSON in config', variant: 'destructive' }); return }
    source ? update.mutate() : create.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="prod-prometheus" required />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      <div className="space-y-1.5">
        <Label>Type *</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="prometheus">Prometheus</SelectItem>
            <SelectItem value="zabbix">Zabbix</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {source && (
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['online', 'offline', 'unknown'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Config (JSON)</Label>
        <textarea
          value={configStr}
          onChange={e => setConfigStr(e.target.value)}
          rows={4}
          className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          placeholder='{"url": "http://..."}'
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {source ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function LogSources() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LogSource | undefined>()
  const { data, isLoading } = useQuery({ queryKey: ['log-sources'], queryFn: logSourcesApi.list })

  const remove = useMutation({
    mutationFn: logSourcesApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['log-sources'] }); toast({ title: 'Log source deleted' }) },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Log Sources</h1>
          <p className="text-xs text-gray-500 mt-0.5">Configure where logs come from</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }} size="sm">
          <Plus className="h-4 w-4" /> Add Source
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-500">Loading...</div>
      ) : (data || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Database className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No log sources yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.06]">
              <tr>
                {['Name', 'Type', 'Status', 'Description', 'Updated', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {(data || []).map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{s.name}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{s.type}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === 'online' ? 'success' : s.status === 'offline' ? 'destructive' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-48 truncate">{s.description || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setFormOpen(true) }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => confirm('Delete this log source?') && remove.mutate(s.id)}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Log Source' : 'Add Log Source'}</DialogTitle>
          </DialogHeader>
          <SourceForm source={editing} onClose={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
