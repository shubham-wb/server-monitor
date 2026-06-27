import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ticket, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ticketsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const severityVariant = (s: string) =>
  s === 'high' || s === 'critical' ? 'destructive' : s === 'medium' ? 'warning' : 'secondary'

const statusVariant = (s: string) =>
  s === 'open' ? 'default' : s === 'resolved' || s === 'closed' ? 'success' : 'warning'

export function Tickets() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page],
    queryFn: () => ticketsApi.list(page, 20),
    refetchInterval: 15000,
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Tickets</h1>
          <p className="text-xs text-gray-500 mt-0.5">Auto-generated tickets from anomalies</p>
        </div>
        {data && <span className="text-xs text-gray-600">{data.total} total</span>}
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-500">Loading...</div>
      ) : (data?.data || []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Ticket className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No tickets yet. Tickets are created automatically when anomalies are detected with ticketing configured.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                <tr>
                  {['Title', 'Severity', 'Status', 'Anomaly', 'External Ref', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(data?.data || []).map(t => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-200 max-w-52">
                      <p className="truncate">{t.title}</p>
                      {t.description && <p className="text-xs text-gray-600 truncate mt-0.5">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={severityVariant(t.severity)}>{t.severity}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(t.status)}>{t.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-40 truncate">
                      {t.anomaly?.title || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.externalRef || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
