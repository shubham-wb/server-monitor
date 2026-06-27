import axios from 'axios'

function getConfig() {
  return {
    baseUrl: localStorage.getItem('api_base_url') || 'http://localhost:3000',
    apiKey: localStorage.getItem('api_key') || '',
    ingestKey: localStorage.getItem('ingest_key') || '',
    logGenUrl: localStorage.getItem('log_gen_url') || 'http://localhost:3100',
  }
}

function createApiClient() {
  const { baseUrl, apiKey } = getConfig()
  return axios.create({
    baseURL: baseUrl,
    headers: apiKey ? { 'x-api-key': apiKey } : {},
  })
}

function createLogGenClient() {
  const { logGenUrl } = getConfig()
  return axios.create({ baseURL: logGenUrl })
}

// --- Types ---
export interface RemoteServer {
  id: string
  name: string
  ownerId: string
  description?: string
  config: Record<string, unknown>
  status: 'online' | 'offline' | 'maintenance' | 'unknown'
  createdAt: string
  updatedAt: string
}

export interface LogSource {
  id: string
  ownerId: string
  name: string
  description?: string
  status: 'online' | 'offline' | 'unknown'
  type: 'zabbix' | 'prometheus'
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface LogAnalysisJob {
  id: string
  ownerId: string
  name: string
  description?: string
  status: 'pending' | 'running' | 'completed' | 'initialized' | 'failed'
  type: 'one_time' | 'recurring'
  ticketingSystemConfig?: Record<string, unknown>
  remoteServer: RemoteServer
  logSource?: LogSource
  createdAt: string
  updatedAt: string
}

export interface Anomaly {
  id: string
  status: 'open' | 'in_progress' | 'closed'
  title: string
  description?: string
  severity: 'low' | 'medium' | 'high'
  ticketInfo?: Record<string, unknown>
}

export interface Ticket {
  id: string
  title: string
  description?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  externalRef?: string
  anomaly: Anomaly
  createdAt: string
  updatedAt: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// --- Remote Servers ---
export const remoteServersApi = {
  list: () => createApiClient().get<RemoteServer[]>('/remote-servers').then(r => r.data),
  get: (id: string) => createApiClient().get<RemoteServer>(`/remote-servers/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string; config: Record<string, unknown> }) =>
    createApiClient().post<RemoteServer>('/remote-servers', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; config: Record<string, unknown>; status: string }>) =>
    createApiClient().patch<RemoteServer>(`/remote-servers/${id}`, data).then(r => r.data),
  remove: (id: string) => createApiClient().delete(`/remote-servers/${id}`),
}

// --- Log Sources ---
export const logSourcesApi = {
  list: () => createApiClient().get<LogSource[]>('/log-sources').then(r => r.data),
  get: (id: string) => createApiClient().get<LogSource>(`/log-sources/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string; type: string; config: Record<string, unknown> }) =>
    createApiClient().post<LogSource>('/log-sources', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; type: string; status: string; config: Record<string, unknown> }>) =>
    createApiClient().patch<LogSource>(`/log-sources/${id}`, data).then(r => r.data),
  remove: (id: string) => createApiClient().delete(`/log-sources/${id}`),
}

// --- Analysis Jobs ---
export const jobsApi = {
  list: () => createApiClient().get<LogAnalysisJob[]>('/log-analysis-jobs').then(r => r.data),
  get: (id: string) => createApiClient().get<LogAnalysisJob>(`/log-analysis-jobs/${id}`).then(r => r.data),
  create: (data: {
    name: string
    description?: string
    type: string
    remoteServerId: string
    logSourceId?: string
    ticketingSystemConfig?: Record<string, unknown>
  }) => createApiClient().post<LogAnalysisJob>('/log-analysis-jobs', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; status: string; type: string }>) =>
    createApiClient().patch<LogAnalysisJob>(`/log-analysis-jobs/${id}`, data).then(r => r.data),
  remove: (id: string) => createApiClient().delete(`/log-analysis-jobs/${id}`),
  listAnomalies: (jobId: string, page = 1, limit = 20) =>
    createApiClient()
      .get<PaginatedResult<Anomaly>>(`/log-analysis-jobs/${jobId}/anomalies`, { params: { page, limit } })
      .then(r => r.data),
  updateAnomaly: (jobId: string, anomalyId: string, status: string) =>
    createApiClient()
      .patch<Anomaly>(`/log-analysis-jobs/${jobId}/anomalies/${anomalyId}`, { status })
      .then(r => r.data),
}

// --- Tickets ---
export const ticketsApi = {
  list: (page = 1, limit = 20) =>
    createApiClient()
      .get<PaginatedResult<Ticket>>('/tickets', { params: { page, limit } })
      .then(r => r.data),
  get: (id: string) => createApiClient().get<Ticket>(`/tickets/${id}`).then(r => r.data),
}

// --- Log Generator ---
export interface LogGenStatus {
  status: string
  uptime: number
  generation: { normalLogs: boolean; errors: boolean }
  endpoints: Record<string, string>
}

export interface LogEntry {
  seq: number
  timestamp: string
  level: string
  message: string
  service?: string
  [key: string]: unknown
}

export const logGenApi = {
  status: () => createLogGenClient().get<LogGenStatus>('/status').then(r => r.data),
  recentLogs: (since?: number) =>
    createLogGenClient()
      .get<{ logs: LogEntry[]; latest: number }>('/logs/recent', { params: since ? { since } : {} })
      .then(r => r.data),
  generateError: (body?: { message?: string; type?: string }) =>
    createLogGenClient().post('/generate-error', body || {}).then(r => r.data),
  generateBatch: (count: number) =>
    createLogGenClient().post('/generate-batch', { count }).then(r => r.data),
  startNormal: () => createLogGenClient().post('/start-generation').then(r => r.data),
  stopNormal: () => createLogGenClient().post('/stop-generation').then(r => r.data),
  startErrors: () => createLogGenClient().post('/start-error-generation').then(r => r.data),
  stopErrors: () => createLogGenClient().post('/stop-error-generation').then(r => r.data),
}

// --- Ingest (uses INGEST_KEY, not API_KEY) ---
export interface IngestRecord {
  level: string
  message: string
  service?: string
  [key: string]: unknown
}

function createIngestClient() {
  const { baseUrl, ingestKey } = getConfig()
  return axios.create({
    baseURL: baseUrl,
    headers: ingestKey ? { 'x-api-key': ingestKey } : {},
  })
}

export const ingestApi = {
  send: (jobId: string, records: IngestRecord[]) =>
    createIngestClient().post(`/log-analysis/ingest/${jobId}`, records).then(r => r.data),
}

// --- Health ---
export const healthApi = {
  check: () => createApiClient().get('/').then(r => r.data),
}
