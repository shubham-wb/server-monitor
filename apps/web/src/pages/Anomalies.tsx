import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { jobsApi, type Anomaly } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

const severityVariant = (s: string) =>
  s === 'high' ? 'destructive' : s === 'medium' ? 'warning' : 'secondary'

const statusVariant = (s: string) =>
  s === 'open' ? 'default' : s === 'in_progress' ? 'warning' : 'success'

export function Anomalies() {
  const [params] = useSearchParams()
  const [selectedJob, setSelectedJob] = useState(params.get('jobId') || '')
  const [page, setPage] = useState(1)

  const qc = useQueryClient()
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: jobsApi.list })

  const { data, isLoading } = useQuery({
    queryKey: ['anomalies', selectedJob, page],
    queryFn: () => jobsApi.listAnomalies(selectedJob, page, 20),
    enabled: !!selectedJob,
  })

  const update = useMutation({
    mutationFn: ({ anomalyId, status }: { anomalyId: string; status: string }) =>
      jobsApi.updateAnomaly(selectedJob, anomalyId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['anomalies'] }); toast({ title: 'Anomaly updated' }) },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">Anomalies</h1>
        <p className="text-xs text-gray-500 mt-0.5">Detected anomalies from analysis jobs</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Job:</span>
        <Select value={selectedJob} onValueChange={v => { setSelectedJob(v); setPage(1) }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a job..." />
          </SelectTrigger>
          <SelectContent>
            {(jobs.data || []).map(j => (
              <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && <span className="text-xs text-gray-600">{data.total} total</span>}
      </div>

      {!selectedJob ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">Select a job to view its anomalies.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="text-xs text-gray-500">Loading...</div>
      ) : (data?.data || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No anomalies for this job.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                <tr>
                  {['Title', 'Severity', 'Status', 'Description', 'Ticket', 'Update Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(data?.data || []).map((a: Anomaly) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-200 max-w-48">
                      <p className="truncate">{a.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(a.status)}>{a.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-52 truncate">{a.description || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {a.ticketInfo
                        ? <Badge variant="secondary">#{(a.ticketInfo as Record<string, string>).ticketId || 'linked'}</Badge>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={a.status}
                        onValueChange={status => update.mutate({ anomalyId: a.id, status })}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Page {data.page} of {data.totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
