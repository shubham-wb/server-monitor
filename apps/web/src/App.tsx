import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/Toaster";
import { Dashboard } from "@/pages/Dashboard";
import { RemoteServers } from "@/pages/RemoteServers";
import { LogSources } from "@/pages/LogSources";
import { AnalysisJobs } from "@/pages/AnalysisJobs";
import { Anomalies } from "@/pages/Anomalies";
import { Tickets } from "@/pages/Tickets";
import { LogMonitor } from "@/pages/LogMonitor";
import { Settings } from "@/pages/Settings";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

export default function App() {
  useEffect(() => {
    const defaults: Record<string, string> = {
      api_base_url: import.meta.env.VITE_API_BASE_URL,
      api_key: import.meta.env.VITE_API_KEY,
      ingest_key: import.meta.env.VITE_INGEST_KEY,
      log_gen_url: import.meta.env.VITE_LOG_GEN_URL,
    };

    Object.entries(defaults).forEach(([k, v]) => {
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, v);
      }
    });
  }, []);

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
  );
}
