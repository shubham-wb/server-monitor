import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { Toaster } from '@/components/Toaster'
import { Dashboard } from '@/pages/Dashboard'
import { RemoteServers } from '@/pages/RemoteServers'
import { LogSources } from '@/pages/LogSources'
import { AnalysisJobs } from '@/pages/AnalysisJobs'
import { Anomalies } from '@/pages/Anomalies'
import { Tickets } from '@/pages/Tickets'
import { LogMonitor } from '@/pages/LogMonitor'
import { Settings } from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="servers" element={<RemoteServers />} />
            <Route path="log-sources" element={<LogSources />} />
            <Route path="jobs" element={<AnalysisJobs />} />
            <Route path="anomalies" element={<Anomalies />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="monitor" element={<LogMonitor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
