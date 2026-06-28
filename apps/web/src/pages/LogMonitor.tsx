import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Terminal,
  Play,
  Square,
  Zap,
  AlertCircle,
  RotateCcw,
  Wifi,
  WifiOff,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logGenApi, type LogEntry } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { jobsApi, ingestApi } from "@/lib/api";

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  debug: "text-gray-500",
  warn: "text-yellow-400",
  error: "text-red-400",
  critical: "text-red-300 font-semibold",
};

const LEVEL_BADGE: Record<
  string,
  "default" | "secondary" | "warning" | "destructive"
> = {
  info: "default",
  debug: "secondary",
  warn: "warning",
  error: "destructive",
  critical: "destructive",
};

const ERROR_TYPES = [
  "database",
  "authentication",
  "network",
  "file",
  "memory",
  "payment",
];
const SEV_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export function LogMonitor() {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStatus, setDemoStatus] = useState('');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latestSeq, setLatestSeq] = useState(0);
  const [polling, setPolling] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [batchCount, setBatchCount] = useState("5");
  const [errorType, setErrorType] = useState("");
  const [linkedJobId, setLinkedJobId] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qc = useQueryClient();

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.list,
  });

  const { data: genStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["gen-status"],
    queryFn: logGenApi.status,
    refetchInterval: polling ? 5000 : false,
    retry: false,
  });
  const genOnline = !!genStatus;

  // Anomalies for linked job
  const anomaliesQuery = useQuery({
    queryKey: ["anomalies", linkedJobId, 1],
    queryFn: () => jobsApi.listAnomalies(linkedJobId, 1, 10),
    enabled: !!linkedJobId,
    refetchInterval: polling ? 4000 : 10000,
  });

  const appendLogs = useCallback((entries: LogEntry[]) => {
    if (!entries.length) return;
    setLogs((prev) => {
      const combined = [...prev, ...entries];
      return combined.slice(-500);
    });
  }, []);

  const doPoll = useCallback(async () => {
    try {
      const { logs: entries, latest } = await logGenApi.recentLogs(
        latestSeq || undefined,
      );
      if (entries.length) {
        appendLogs(entries);
        setLatestSeq(latest);
      }
    } catch {
      // generator offline — don't crash
    }
  }, [latestSeq, appendLogs]);

  // Keep doPoll stable reference
  const doPollRef = useRef(doPoll);
  useEffect(() => {
    doPollRef.current = doPoll;
  }, [doPoll]);

  const startPolling = useCallback(async () => {
    if (pollRef.current) return;
    // Fetch the initial batch first
    try {
      const { logs: entries, latest } = await logGenApi.recentLogs();
      setLogs(entries.slice(-50));
      setLatestSeq(latest);
    } catch {
      toast({ title: "Could not reach log generator", variant: "destructive" });
    }
    setPolling(true);
    pollRef.current = setInterval(() => doPollRef.current(), 2000);
  }, []);

  const stopPolling = useCallback(() => {
    setPolling(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Generator controls
  const startNormal = useMutation({
    mutationFn: logGenApi.startNormal,
    onSuccess: () => {
      toast({ title: "Normal log generation started" });
      refetchStatus();
    },
    onError: () =>
      toast({ title: "Log generator unreachable", variant: "destructive" }),
  });
  const stopNormal = useMutation({
    mutationFn: logGenApi.stopNormal,
    onSuccess: () => {
      toast({ title: "Normal log generation stopped" });
      refetchStatus();
    },
    onError: () =>
      toast({ title: "Log generator unreachable", variant: "destructive" }),
  });
  const startErrors = useMutation({
    mutationFn: logGenApi.startErrors,
    onSuccess: () => {
      toast({ title: "Error generation started" });
      refetchStatus();
    },
    onError: () =>
      toast({ title: "Log generator unreachable", variant: "destructive" }),
  });
  const stopErrors = useMutation({
    mutationFn: logGenApi.stopErrors,
    onSuccess: () => {
      toast({ title: "Error generation stopped" });
      refetchStatus();
    },
    onError: () =>
      toast({ title: "Log generator unreachable", variant: "destructive" }),
  });
  const triggerBatch = useMutation({
    mutationFn: () => logGenApi.generateBatch(Number(batchCount) || 5),
    onSuccess: (data: { triggered: number }) => {
      toast({ title: `Triggered ${data.triggered} error logs` });
      if (linkedJobId)
        setTimeout(
          () => qc.invalidateQueries({ queryKey: ["anomalies", linkedJobId] }),
          3000,
        );
    },
    onError: () =>
      toast({ title: "Failed to trigger batch", variant: "destructive" }),
  });
  const triggerSingle = useMutation({
    mutationFn: () =>
      logGenApi.generateError(errorType ? { type: errorType } : undefined),
    onSuccess: () => {
      toast({ title: "Error log triggered" });
      if (linkedJobId)
        setTimeout(
          () => qc.invalidateQueries({ queryKey: ["anomalies", linkedJobId] }),
          3000,
        );
    },
    onError: () =>
      toast({ title: "Failed to trigger error", variant: "destructive" }),
  });

  const runDemo = async () => {
    if (!selectedJobId) return;
    setDemoRunning(true);
    setDemoStatus('');

    try {
      const before = await logGenApi.recentLogs();
      const sinceSeq = before.latest;

      setDemoStatus('Generating errors...');
      await logGenApi.generateBatch(5);

      await new Promise(r => setTimeout(r, 800));
      const after = await logGenApi.recentLogs(sinceSeq);

      setDemoStatus('Forwarding to job...');
      const records = after.logs.map(l => ({
        level:   l.level === 'error' ? 'critical' : l.level,
        message: l.message,
        service: l.service as string | undefined,
      }));
      await ingestApi.send(selectedJobId, records);

      setDemoStatus('Done — check Anomalies and Tickets');
    } catch (e) {
      setDemoStatus('Error: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setDemoRunning(false);
    }
  };

  const filteredLogs =
    filterLevel === "all" ? logs : logs.filter((l) => l.level === filterLevel);

  return (
    <div className="flex h-full flex-col p-6 gap-4 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Log Monitor</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time logs from the dummy generator
          </p>
        </div>
        <div className="flex items-center gap-2">
          {genOnline ? (
            <Badge variant="success" className="gap-1.5">
              <Wifi className="h-3 w-3" />
              Generator Online
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5">
              <WifiOff className="h-3 w-3" />
              Generator Offline
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Controls panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-400" />
                Generator Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">Normal Logs</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    disabled={
                      !genOnline ||
                      !!genStatus?.generation?.normalLogs ||
                      startNormal.isPending
                    }
                    onClick={() => startNormal.mutate()}
                  >
                    <Play className="h-3.5 w-3.5" /> Start
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={
                      !genOnline ||
                      !genStatus?.generation?.normalLogs ||
                      stopNormal.isPending
                    }
                    onClick={() => stopNormal.mutate()}
                  >
                    <Square className="h-3.5 w-3.5" /> Stop
                  </Button>
                </div>
                <p className="text-xs text-gray-600">
                  {genStatus ? (
                    genStatus.generation.normalLogs ? (
                      <span className="text-green-400">● running</span>
                    ) : (
                      "○ stopped"
                    )
                  ) : (
                    "—"
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">Error Logs</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={
                      !genOnline ||
                      !!genStatus?.generation?.errors ||
                      startErrors.isPending
                    }
                    onClick={() => startErrors.mutate()}
                  >
                    <Play className="h-3.5 w-3.5" /> Start
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={
                      !genOnline ||
                      !genStatus?.generation?.errors ||
                      stopErrors.isPending
                    }
                    onClick={() => stopErrors.mutate()}
                  >
                    <Square className="h-3.5 w-3.5" /> Stop
                  </Button>
                </div>
                <p className="text-xs text-gray-600">
                  {genStatus ? (
                    genStatus.generation.errors ? (
                      <span className="text-red-400">● running</span>
                    ) : (
                      "○ stopped"
                    )
                  ) : (
                    "—"
                  )}
                </p>
              </div>

              <hr className="border-white/6" />

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">
                  Manual Trigger
                </p>
                <Select value={errorType} onValueChange={setErrorType}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Random error type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Random</SelectItem>
                    {ERROR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={!genOnline || triggerSingle.isPending}
                  onClick={() => triggerSingle.mutate()}
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Trigger Single Error
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">
                  Batch Trigger
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value)}
                    min={1}
                    max={50}
                    className="h-8 w-20"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={!genOnline || triggerBatch.isPending}
                    onClick={() => triggerBatch.mutate()}
                  >
                    <Zap className="h-3.5 w-3.5" /> Batch ({batchCount})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked job anomalies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <LinkIcon className="h-4 w-4 text-blue-400" />
                Linked Job Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={linkedJobId} onValueChange={setLinkedJobId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select job to watch..." />
                </SelectTrigger>
                <SelectContent>
                  {(jobs.data || []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {linkedJobId && (
                <div className="space-y-1">
                  {anomaliesQuery.isLoading ? (
                    <p className="text-xs text-gray-600">Loading...</p>
                  ) : (anomaliesQuery.data?.data || []).length === 0 ? (
                    <p className="text-xs text-gray-600">
                      No anomalies yet — trigger some errors above (Fluent Bit
                      must be routing to this job).
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">
                        {anomaliesQuery.data?.total} total anomalies
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {(anomaliesQuery.data?.data || []).map((a) => (
                          <div
                            key={a.id}
                            className="rounded-md bg-white/3 px-3 py-2 space-y-0.5"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant={SEV_VARIANT[a.severity]}>
                                {a.severity}
                              </Badge>
                              <Badge
                                variant={
                                  a.status === "open"
                                    ? "default"
                                    : a.status === "in_progress"
                                      ? "warning"
                                      : "success"
                                }
                              >
                                {a.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-300 truncate">
                              {a.title}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Log terminal */}
        <div className="lg:col-span-2 flex flex-col gap-3">
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

          <div className="flex items-center gap-3 flex-wrap">
            {polling ? (
              <Button size="sm" variant="outline" onClick={stopPolling}>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={startPolling} disabled={!genOnline}>
                <Play className="h-3.5 w-3.5" /> Start Live Stream
              </Button>
            )}
            {polling && (
              <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            )}

            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["all", "info", "debug", "warn", "error", "critical"].map(
                  (l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setLogs([]);
                setLatestSeq(0);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </Button>
            <span className="text-xs text-gray-600 ml-auto">
              {filteredLogs.length} lines
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id="autoscroll"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="autoscroll" className="text-xs">
                Auto-scroll
              </Label>
            </div>
          </div>

          <div className="flex-1 rounded-lg border border-white/6 bg-[#060a10] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/6 px-4 py-2">
              <Terminal className="h-3.5 w-3.5 text-gray-600" />
              <span className="text-xs text-gray-600 font-mono">
                {genOnline ? "dummy-log-generator · live" : "generator offline"}
              </span>
              <div className="ml-auto flex gap-1">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
              </div>
            </div>

            <div className="h-112 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
              {filteredLogs.length === 0 ? (
                <p className="text-gray-700 mt-8 text-center">
                  {!genOnline
                    ? "Generator offline — start it with: pnpm --filter dummy-log-generator dev"
                    : polling
                      ? "Waiting for logs..."
                      : 'Click "Start Live Stream" to begin'}
                </p>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.seq}
                    className="flex items-start gap-2 hover:bg-white/2 px-1 py-0.5 rounded group"
                  >
                    <span className="text-gray-700 shrink-0 tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge
                      variant={LEVEL_BADGE[log.level] ?? "secondary"}
                      className="shrink-0 text-[10px] px-1.5"
                    >
                      {log.level?.toUpperCase()}
                    </Badge>
                    {log.service && (
                      <span className="text-purple-400 shrink-0">
                        [{String(log.service)}]
                      </span>
                    )}
                    <span
                      className={LEVEL_COLORS[log.level] || "text-gray-300"}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
