import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { remoteServersApi, type RemoteServer } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

const statusVariant = (s: string) =>
  s === 'online' ? 'success' : s === 'offline' ? 'destructive' : s === 'maintenance' ? 'warning' : 'secondary'

function ServerForm({ server, onClose }: { server?: RemoteServer; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(server?.name || '')
  const [description, setDescription] = useState(server?.description || '')
  const [status, setStatus] = useState(server?.status || 'unknown')
  const [configStr, setConfigStr] = useState(server ? JSON.stringify(server.config, null, 2) : '{}')

  const create = useMutation({
    mutationFn: () => remoteServersApi.create({ name, description, config: JSON.parse(configStr) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servers'] }); toast({ title: 'Server created' }); onClose() },
    onError: () => toast({ title: 'Failed to create server', variant: 'destructive' }),
  })

  const update = useMutation({
    mutationFn: () => remoteServersApi.update(server!.id, { name, description, status, config: JSON.parse(configStr) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servers'] }); toast({ title: 'Server updated' }); onClose() },
    onError: () => toast({ title: 'Failed to update server', variant: 'destructive' }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try { JSON.parse(configStr) } catch { toast({ title: 'Invalid JSON in config', variant: 'destructive' }); return }
    server ? update.mutate() : create.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="prod-server-1" required />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      {server && (
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['online', 'offline', 'maintenance', 'unknown'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
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
          className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          placeholder="{}"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {server ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RemoteServers() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RemoteServer | undefined>()
  const { data, isLoading } = useQuery({ queryKey: ['servers'], queryFn: remoteServersApi.list })

  const remove = useMutation({
    mutationFn: remoteServersApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servers'] }); toast({ title: 'Server deleted' }) },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Remote Servers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage monitored servers and hosts</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }} size="sm">
          <Plus className="h-4 w-4" /> Add Server
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-500">Loading...</div>
      ) : (data || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Server className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No servers yet. Add your first server.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.06]">
              <tr>
                {['Name', 'Status', 'Description', 'Updated', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {(data || []).map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{s.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-48 truncate">{s.description || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setFormOpen(true) }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => confirm('Delete this server?') && remove.mutate(s.id)}
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
            <DialogTitle>{editing ? 'Edit Server' : 'Add Remote Server'}</DialogTitle>
          </DialogHeader>
          <ServerForm server={editing} onClose={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
