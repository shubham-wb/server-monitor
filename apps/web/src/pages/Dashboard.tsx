import { useQuery } from '@tanstack/react-query'
import { Server, Database, ClipboardList, AlertTriangle, Ticket, Activity, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { remoteServersApi, logSourcesApi, jobsApi, ticketsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color || 'bg-blue-600/15'}`}>
          <Icon className={`h-5 w-5 ${color ? 'text-white' : 'text-blue-400'}`} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-100">{value}</p>
          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' || status === 'running' ? 'bg-green-400'
    : status === 'offline' || status === 'failed' ? 'bg-red-400'
    : status === 'maintenance' ? 'bg-yellow-400'
    : 'bg-gray-400'
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}

export function Dashboard() {
  const servers = useQuery({ queryKey: ['servers'], queryFn: remoteServersApi.list, refetchInterval: 30000 })
  const sources = useQuery({ queryKey: ['log-sources'], queryFn: logSourcesApi.list, refetchInterval: 30000 })
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: jobsApi.list, refetchInterval: 15000 })
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => ticketsApi.list(1, 5), refetchInterval: 15000 })

  const onlineServers = (servers.data || []).filter(s => s.status === 'online').length
  const runningJobs = (jobs.data || []).filter(j => j.status === 'running').length
  const openTickets = tickets.data?.total || 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">Dashboard</h1>
        <p className="text-xs text-gray-500 mt-0.5">System overview and live metrics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={Server}
          label="Remote Servers"
          value={servers.data?.length ?? '—'}
          sub={`${onlineServers} online`}
          color="bg-blue-600/15"
        />
        <StatCard
          icon={Database}
          label="Log Sources"
          value={sources.data?.length ?? '—'}
          color="bg-purple-600/15"
        />
        <StatCard
          icon={ClipboardList}
          label="Analysis Jobs"
          value={jobs.data?.length ?? '—'}
          sub={`${runningJobs} running`}
          color="bg-cyan-600/15"
        />
        <StatCard
          icon={Ticket}
          label="Open Tickets"
          value={openTickets}
          color="bg-orange-600/15"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Jobs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Jobs</CardTitle>
              <Activity className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {jobs.isLoading ? (
              <div className="px-5 pb-5 text-xs text-gray-600">Loading...</div>
            ) : (jobs.data || []).length === 0 ? (
              <div className="px-5 pb-5 text-xs text-gray-600">No jobs yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {(jobs.data || []).slice(0, 6).map(job => (
                  <div key={job.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StatusDot status={job.status} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 truncate">{job.name}</p>
                        <p className="text-xs text-gray-600">{job.remoteServer?.name}</p>
                      </div>
                    </div>
                    <Badge variant={
                      job.status === 'running' ? 'success'
                      : job.status === 'failed' ? 'destructive'
                      : job.status === 'completed' ? 'secondary'
                      : 'outline'
                    }>{job.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Servers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Remote Servers</CardTitle>
              <Server className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {servers.isLoading ? (
              <div className="px-5 pb-5 text-xs text-gray-600">Loading...</div>
            ) : (servers.data || []).length === 0 ? (
              <div className="px-5 pb-5 text-xs text-gray-600">No servers configured.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {(servers.data || []).slice(0, 6).map(s => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={s.status} />
                      <div>
                        <p className="text-sm text-gray-200">{s.name}</p>
                        <p className="text-xs text-gray-600">{formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                    <Badge variant={
                      s.status === 'online' ? 'success'
                      : s.status === 'offline' ? 'destructive'
                      : s.status === 'maintenance' ? 'warning'
                      : 'secondary'
                    }>{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Recent Tickets</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tickets.isLoading ? (
            <div className="px-5 pb-5 text-xs text-gray-600">Loading...</div>
          ) : (tickets.data?.data || []).length === 0 ? (
            <div className="px-5 pb-5 text-xs text-gray-600">No tickets yet.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {(tickets.data?.data || []).map(ticket => (
                <div key={ticket.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-gray-200">{ticket.title}</p>
                    <p className="text-xs text-gray-600">{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ticket.severity === 'high' || ticket.severity === 'critical' ? 'destructive' : ticket.severity === 'medium' ? 'warning' : 'secondary'}>
                      {ticket.severity}
                    </Badge>
                    <Badge variant={ticket.status === 'open' ? 'default' : ticket.status === 'resolved' ? 'success' : 'secondary'}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
