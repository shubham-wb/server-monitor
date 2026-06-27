import './load-env';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { RemoteServer, RemoteServerStatus } from './remote-servers/entities/remote-server.entity';
import { LogSource, LogSourceStatus, LogSourceType } from './log-sources/entities/log-source.entity';
import {
  LogAnalysisJob,
  LogAnalysisJobStatus,
  LogAnalysisJobType,
} from './log-analysis/log-analysis-jobs/entities/log-analysis-job.entity';
import {
  Anomaly,
  AnomalySeverity,
  AnomalyStatus,
} from './log-analysis/log-analysis-jobs/entities/anomaly.entity';
import { Ticket } from './ticketing/entities/ticket.entity';
import { TicketSeverity, TicketStatus } from './ticketing/ticketing.types';

const OWNER_ID = 'default-user-1';

const ds = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? 'db.sqlite',
  synchronize: true,
  entities: [RemoteServer, LogSource, LogAnalysisJob, Anomaly, Ticket],
});

async function seed() {
  await ds.initialize();

  const serverRepo = ds.getRepository(RemoteServer);
  const sourceRepo = ds.getRepository(LogSource);
  const jobRepo = ds.getRepository(LogAnalysisJob);
  const anomalyRepo = ds.getRepository(Anomaly);
  const ticketRepo = ds.getRepository(Ticket);

  const existing = await serverRepo.count({ where: { ownerId: OWNER_ID } });
  if (existing > 0) {
    console.log(`Seed data already present (${existing} servers found). Skipping.`);
    await ds.destroy();
    return;
  }

  console.log('Seeding database...');

  // --- Remote Servers ---
  const servers = await serverRepo.save([
    serverRepo.create({
      ownerId: OWNER_ID,
      name: 'Production API Server',
      description: 'Primary production API cluster running in us-east-1',
      status: RemoteServerStatus.ONLINE,
      config: { host: '10.0.1.10', port: 22, region: 'us-east-1', tags: ['prod', 'api'] },
    }),
    serverRepo.create({
      ownerId: OWNER_ID,
      name: 'Production Database Server',
      description: 'Primary PostgreSQL cluster with read replicas',
      status: RemoteServerStatus.ONLINE,
      config: { host: '10.0.1.20', port: 5432, region: 'us-east-1', tags: ['prod', 'db'] },
    }),
    serverRepo.create({
      ownerId: OWNER_ID,
      name: 'Staging Environment',
      description: 'Staging cluster for pre-release validation',
      status: RemoteServerStatus.ONLINE,
      config: { host: '10.0.2.10', port: 22, region: 'us-west-2', tags: ['staging'] },
    }),
    serverRepo.create({
      ownerId: OWNER_ID,
      name: 'EU Gateway Server',
      description: 'European region API gateway',
      status: RemoteServerStatus.MAINTENANCE,
      config: { host: '10.1.0.10', port: 22, region: 'eu-central-1', tags: ['prod', 'eu'] },
    }),
  ]);
  console.log(`  ✓ ${servers.length} remote servers`);

  // --- Log Sources ---
  const sources = await sourceRepo.save([
    sourceRepo.create({
      ownerId: OWNER_ID,
      name: 'Prometheus — Prod API',
      description: 'Prometheus scraping the production API cluster',
      status: LogSourceStatus.ONLINE,
      type: LogSourceType.PROMETHEUS,
      config: { url: 'http://prometheus.prod:9090', scrapeInterval: '15s' },
    }),
    sourceRepo.create({
      ownerId: OWNER_ID,
      name: 'Zabbix — Infrastructure',
      description: 'Zabbix monitoring for servers and network devices',
      status: LogSourceStatus.ONLINE,
      type: LogSourceType.ZABBIX,
      config: { url: 'http://zabbix.internal', apiToken: 'zb_tok_demo_0001' },
    }),
    sourceRepo.create({
      ownerId: OWNER_ID,
      name: 'Prometheus — Staging',
      description: 'Prometheus for the staging environment',
      status: LogSourceStatus.OFFLINE,
      type: LogSourceType.PROMETHEUS,
      config: { url: 'http://prometheus.staging:9090', scrapeInterval: '30s' },
    }),
  ]);
  console.log(`  ✓ ${sources.length} log sources`);

  // --- Jobs ---
  const [prodServer, dbServer, stagingServer, euServer] = servers;
  const [promProd, zabbix, promStaging] = sources;

  const jobs = await jobRepo.save([
    jobRepo.create({
      ownerId: OWNER_ID,
      name: 'Prod API — Live Monitor',
      description: 'Continuous log analysis for the production API. Alerts on error spikes.',
      status: LogAnalysisJobStatus.RUNNING,
      type: LogAnalysisJobType.RECURRING,
      remoteServer: prodServer,
      logSource: promProd,
      ticketingSystemConfig: { type: 'internal' },
    }),
    jobRepo.create({
      ownerId: OWNER_ID,
      name: 'Database Health Monitor',
      description: 'Tracks slow queries, connection pool exhaustion, and replication lag.',
      status: LogAnalysisJobStatus.RUNNING,
      type: LogAnalysisJobType.RECURRING,
      remoteServer: dbServer,
      logSource: zabbix,
      ticketingSystemConfig: { type: 'internal' },
    }),
    jobRepo.create({
      ownerId: OWNER_ID,
      name: 'Staging Pre-release Check',
      description: 'One-time analysis run before each release deployment.',
      status: LogAnalysisJobStatus.INITIALIZED,
      type: LogAnalysisJobType.ONE_TIME,
      remoteServer: stagingServer,
      logSource: promStaging,
    }),
    jobRepo.create({
      ownerId: OWNER_ID,
      name: 'EU Gateway Audit',
      description: 'Scheduled audit while the EU gateway is in maintenance mode.',
      status: LogAnalysisJobStatus.PENDING,
      type: LogAnalysisJobType.RECURRING,
      remoteServer: euServer,
      ticketingSystemConfig: { type: 'internal' },
    }),
  ]);
  console.log(`  ✓ ${jobs.length} analysis jobs`);

  const [prodJob, dbJob] = jobs;

  // --- Anomalies (closed history + 1 open per running job) ---
  const anomalyData: Partial<Anomaly>[] = [
    // prodJob history
    {
      logAnalysisJob: prodJob,
      status: AnomalyStatus.CLOSED,
      severity: AnomalySeverity.MEDIUM,
      title: 'API error rate exceeded 5% threshold',
      description: 'Elevated 500 responses detected across /api/orders and /api/payments endpoints for ~8 minutes.',
    },
    {
      logAnalysisJob: prodJob,
      status: AnomalyStatus.CLOSED,
      severity: AnomalySeverity.HIGH,
      title: 'JWT token validation failures spiking',
      description: 'Burst of 401s from auth-service — traced to a clock skew after an NTP resync.',
    },
    {
      logAnalysisJob: prodJob,
      status: AnomalyStatus.CLOSED,
      severity: AnomalySeverity.MEDIUM,
      title: 'Payment service response time degraded',
      description: 'p99 latency on /api/payments/charge rose to 4.2 s. Root cause: upstream gateway throttling.',
    },
    {
      logAnalysisJob: prodJob,
      status: AnomalyStatus.OPEN,
      severity: AnomalySeverity.HIGH,
      title: 'Memory heap allocation failures in worker pool',
      description: 'Recurring OOM errors in the background job workers. Likely a memory leak introduced in v2.14.1.',
    },
    // dbJob history
    {
      logAnalysisJob: dbJob,
      status: AnomalyStatus.CLOSED,
      severity: AnomalySeverity.MEDIUM,
      title: 'Replication lag exceeded 30 s',
      description: 'Read replica fell behind primary during a bulk import. Caught up after import completed.',
    },
    {
      logAnalysisJob: dbJob,
      status: AnomalyStatus.OPEN,
      severity: AnomalySeverity.MEDIUM,
      title: 'Connection pool at 90% capacity',
      description: 'Active connection count near max_connections. Investigate long-running transactions.',
    },
  ];

  const anomalies = await anomalyRepo.save(anomalyRepo.create(anomalyData as Anomaly[]));
  console.log(`  ✓ ${anomalies.length} anomalies`);

  // --- Tickets (one per anomaly that was ever open) ---
  const ticketData = [
    {
      anomaly: anomalies[0],
      title: anomalies[0].title,
      description: anomalies[0].description,
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.CLOSED,
    },
    {
      anomaly: anomalies[1],
      title: anomalies[1].title,
      description: anomalies[1].description,
      severity: TicketSeverity.HIGH,
      status: TicketStatus.CLOSED,
    },
    {
      anomaly: anomalies[2],
      title: anomalies[2].title,
      description: anomalies[2].description,
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.CLOSED,
    },
    {
      anomaly: anomalies[3], // open anomaly
      title: anomalies[3].title,
      description: anomalies[3].description,
      severity: TicketSeverity.HIGH,
      status: TicketStatus.OPEN,
    },
    {
      anomaly: anomalies[4],
      title: anomalies[4].title,
      description: anomalies[4].description,
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.CLOSED,
    },
    {
      anomaly: anomalies[5], // open anomaly
      title: anomalies[5].title,
      description: anomalies[5].description,
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.IN_PROGRESS,
    },
  ];

  const tickets = await ticketRepo.save(ticketRepo.create(ticketData as Ticket[]));

  // Back-fill ticketInfo on open anomalies so the UI links them
  for (let i = 0; i < tickets.length; i++) {
    anomalies[i].ticketInfo = { ticketId: tickets[i].id, status: tickets[i].status };
  }
  await anomalyRepo.save(anomalies);

  console.log(`  ✓ ${tickets.length} tickets`);
  console.log('\nSeed complete.');
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
