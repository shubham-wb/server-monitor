# Milestone 0 — Close the Loop (step-by-step build guide)

> **For learning NestJS.** Each step says _what_ to build, _which file_ it goes in, the _NestJS concept_ you're practicing, the _pattern to copy_, and now a **reference code snippet**. Type the snippets out rather than pasting — you'll learn more, and you'll catch the import paths and decorators as you go. Work top to bottom.

---

## Why this milestone (read first)

The product's promise is: **log in → anomaly recorded → ticket an operator can see and reset.** Right now the chain breaks in two spots:

1. The ticket the provider returns is **thrown away** — [ticketing.service.ts:41](../apps/nest-app/src/ticketing/ticketing.service.ts#L41) returns it, but nothing saves it and nothing can read it.
2. There's **no way to view or close an anomaly**, so the dedupe gate at [log-analysis-jobs.service.ts:118-124](../apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts#L118-L124) latches shut after the first error and that job goes dead forever.

**The loop you're building:**

```
ingest error log
   → Anomaly created (status=open)   [already works]
   → AnomalyCreatedEvent emitted     [already works]
   → TicketingService listener runs  [already works]
       → provider.createTicket()  ──► SAVE a Ticket row        ◄── you add this (0.1, 0.2)
       → write {ticketId,status} onto anomaly.ticketInfo       ◄── you add this (0.3)
   → GET /tickets shows the ticket                              ◄── you add this (0.6)
   → PATCH anomaly status = closed                             ◄── you add this (0.5)
   → next error raises a FRESH anomaly + ticket (gate reopens)
```

---

## Before you start

- Baseline check: `pnpm --filter nest-app start:dev` (Swagger at `/api`).
- `synchronize: true` + `autoLoadEntities: true` are on ([app.module.ts:16-21](../apps/nest-app/src/app.module.ts#L16-L21)), so any entity registered in a `TypeOrmModule.forFeature([...])` auto-creates its table. No central entity list to edit.
- A global `ValidationPipe` is already installed ([main.ts:19](../apps/nest-app/src/main.ts#L19)), so `class-validator` decorators on DTOs are enforced automatically.

---

## Step 0.1 — Add the `Ticket` entity

**File to create:** `apps/nest-app/src/ticketing/entities/ticket.entity.ts`

**Concept:** a TypeORM entity = one table. You reuse the `TicketSeverity`/`TicketStatus` enums (one source of truth) and add a `@ManyToOne` relation to `Anomaly` — TypeORM auto-creates the `anomalyId` foreign-key column from that relation.

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Anomaly } from "@/log-analysis/log-analysis-jobs/entities/anomaly.entity";
import { TicketSeverity, TicketStatus } from "../ticketing.types";

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: "simple-enum", enum: TicketSeverity })
  severity: TicketSeverity;

  @Column({ type: "simple-enum", enum: TicketStatus })
  status: TicketStatus;

  // For real providers later (Jira/ServiceNow ID). Null for the internal one.
  @Column({ nullable: true })
  externalRef?: string;

  // ManyToOne → TypeORM creates an `anomalyId` FK column automatically.
  @ManyToOne(() => Anomaly, { onDelete: "CASCADE" })
  @JoinColumn()
  anomaly: Anomaly;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

> **Pattern reference:** columns/enums → [anomaly.entity.ts](../apps/nest-app/src/log-analysis/log-analysis-jobs/entities/anomaly.entity.ts); timestamps + relation → [log-analysis-job.entity.ts](../apps/nest-app/src/log-analysis/log-analysis-jobs/entities/log-analysis-job.entity.ts). The table only gets created once `Ticket` is in a `forFeature([...])` — that happens in Step 0.2.

---

## Step 0.2 — Build the `InternalTicketingProvider`

First, the provider needs the anomaly id to link the ticket, but the current `TicketCreate` type doesn't carry one. Add it.

**File to edit:** `apps/nest-app/src/ticketing/ticketing.types.ts`

```ts
export interface TicketCreate {
  title: string;
  description?: string;
  severity: TicketSeverity;
  anomalyId?: string; // ← add this
}
```

**File to create:** `apps/nest-app/src/ticketing/ticketing-providers/internal-ticketing-provider.ts`

**The key learning point:** providers are built with plain `new` in the factory ([ticketing-provider.factory.ts:9](../apps/nest-app/src/ticketing/ticketing-providers/ticketing-provider.factory.ts#L9)), so they are **not** managed by Nest DI — `@InjectRepository` inside the provider would not work. Instead the **factory** (which _is_ DI-managed) receives the repository and passes it into the constructor.

Note the import alias: the entity and the type are both named `Ticket`, so the type is imported as `TicketType`.

```ts
import { Repository } from "typeorm";
import {
  Ticket as TicketType,
  TicketCreate,
  TicketStatus,
} from "../ticketing.types";
import { ITicketingProvider } from "./ticketing-provider.interface";
import { Ticket } from "../entities/ticket.entity";
import { Anomaly } from "@/log-analysis/log-analysis-jobs/entities/anomaly.entity";

export class InternalTicketingProvider implements ITicketingProvider {
  constructor(
    private readonly config: Record<string, any>,
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  createTicket(props: TicketCreate): Promise<TicketType> {
    const ticket = this.ticketRepo.create({
      title: props.title,
      description: props.description,
      severity: props.severity,
      status: TicketStatus.OPEN,
      anomaly: props.anomalyId
        ? ({ id: props.anomalyId } as Anomaly)
        : undefined,
    });
    return this.ticketRepo.save(ticket);
  }

  getTicket(ticketId: string): Promise<TicketType | null> {
    return this.ticketRepo.findOne({ where: { id: ticketId } });
  }

  async updateTicket(
    ticketId: string,
    props: Pick<TicketType, "title" | "description" | "status">,
  ): Promise<TicketType> {
    const ticket = await this.ticketRepo.findOneOrFail({
      where: { id: ticketId },
    });
    Object.assign(ticket, props);
    return this.ticketRepo.save(ticket);
  }
}
```

**File to edit (factory):** `apps/nest-app/src/ticketing/ticketing-providers/ticketing-provider.factory.ts`

```ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServiceNowTicketingProvider } from "./service-now-ticketing-provider";
import { InternalTicketingProvider } from "./internal-ticketing-provider";
import { Ticket } from "../entities/ticket.entity";

@Injectable()
export class TicketingProviderFactory {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  create(config: Record<string, any>) {
    switch (config.type) {
      case InternalTicketingProvider.name:
        return new InternalTicketingProvider(config, this.ticketRepo);
      case ServiceNowTicketingProvider.name:
        return new ServiceNowTicketingProvider(config); // stays a stub
      default:
        throw new Error(`Unsupported ticketing provider: ${config.type}`);
    }
  }
}
```

**File to edit (module):** `apps/nest-app/src/ticketing/ticketing.module.ts` — register the entity (creates the table + makes the repo injectable) and wire the tickets controller/service you build in 0.6.

```ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TicketingService } from "./ticketing.service";
import { TicketingProviderFactory } from "./ticketing-providers/ticketing-provider.factory";
import { LogAnalysisJobsModule } from "@/log-analysis/log-analysis-jobs/log-analysis-jobs.module";
import { Ticket } from "./entities/ticket.entity";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), LogAnalysisJobsModule],
  controllers: [TicketsController],
  providers: [TicketingService, TicketingProviderFactory, TicketsService],
})
export class TicketingModule {}
```

> Note: `TicketsController`/`TicketsService` don't exist until Step 0.6 — the module won't compile until you create them, so either stub them now or wire this last.

---

## Step 0.3 & 0.4 — Persist the ticket onto the anomaly, and guard the listener

**File to edit (add a service method):** `apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts`

```ts
async setAnomalyTicketInfo(
  anomalyId: string,
  ownerId: string,
  ticketInfo: Record<string, any>,
) {
  const anomaly = await this.getAnomaly(anomalyId, ownerId);
  if (!anomaly) {
    throw new NotFoundException('Anomaly not found');
  }
  anomaly.ticketInfo = ticketInfo;
  return this.anomalyRepo.save(anomaly);
}
```

**File to edit (the listener):** `apps/nest-app/src/ticketing/ticketing.service.ts` — `await` the created ticket, save the link onto the anomaly, and wrap the whole handler so a provider error is logged instead of vanishing (it's a fire-and-forget `@OnEvent` — nothing awaits it).

```ts
import { Injectable, Logger } from "@nestjs/common";
// ...existing imports...

@Injectable()
export class TicketingService {
  private readonly logger = new Logger(TicketingService.name);

  constructor(
    private readonly ticketingProviderFactory: TicketingProviderFactory,
    private readonly logAnalysisJobsService: LogAnalysisJobsService,
  ) {}

  @OnEvent(AnomalyCreatedEvent.name)
  async handleAnomalyCreatedEvent(event: AnomalyCreatedEvent) {
    const { anomalyId, jobId, ownerId } = event.payload;

    try {
      const providerConfig =
        await this.logAnalysisJobsService.getTicketingSystemConfig(jobId);
      if (!providerConfig?.type) return;

      const anomaly = await this.logAnalysisJobsService.getAnomaly(
        anomalyId,
        ownerId,
      );
      if (!anomaly || anomaly.status !== AnomalyStatus.OPEN) return;

      const provider = this.ticketingProviderFactory.create(providerConfig);

      const ticket = await provider.createTicket({
        title: anomaly.title,
        description: anomaly.description,
        severity: this.mapAnomalyToTicketSeverity(anomaly.severity),
        anomalyId: anomaly.id,
      });

      await this.logAnalysisJobsService.setAnomalyTicketInfo(
        anomaly.id,
        ownerId,
        { ticketId: ticket.id, status: ticket.status },
      );
    } catch (error) {
      this.logger.error(
        `Failed to create ticket for anomaly ${anomalyId} (job ${jobId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // mapAnomalyToTicketSeverity stays unchanged
}
```

---

## Step 0.5 — Anomaly read/manage endpoints (reopen the gate)

**File to create (DTO):** `apps/nest-app/src/log-analysis/log-analysis-jobs/dto/update-anomaly.dto.ts`

```ts
import { IsEnum } from "class-validator";
import { AnomalyStatus } from "../entities/anomaly.entity";

export class UpdateAnomalyDto {
  @IsEnum(AnomalyStatus)
  status: AnomalyStatus;
}
```

**File to edit (service):** `apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts`

```ts
listAnomalies(jobId: string, ownerId: string) {
  return this.anomalyRepo.find({
    where: { logAnalysisJob: { id: jobId, ownerId } },
  });
}

getAnomalyForJob(jobId: string, anomalyId: string, ownerId: string) {
  return this.anomalyRepo.findOne({
    where: { id: anomalyId, logAnalysisJob: { id: jobId, ownerId } },
  });
}

async updateAnomalyStatus(
  jobId: string,
  anomalyId: string,
  ownerId: string,
  status: AnomalyStatus,
) {
  const anomaly = await this.getAnomalyForJob(jobId, anomalyId, ownerId);
  if (!anomaly) {
    throw new NotFoundException('Anomaly not found');
  }
  anomaly.status = status;
  return this.anomalyRepo.save(anomaly);
}
```

**File to edit (controller):** `apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.controller.ts` — add three nested routes. No route conflict: `/:id` is one segment deep, the anomaly routes are deeper.

```ts
// add to imports:
import { UpdateAnomalyDto } from './dto/update-anomaly.dto';

@Get(':jobId/anomalies')
listAnomalies(
  @Param('jobId') jobId: string,
  @CurrentUser() currentUser: ICurrentUser,
) {
  return this.logAnalysisJobsService.listAnomalies(jobId, currentUser.id);
}

@Get(':jobId/anomalies/:id')
getAnomaly(
  @Param('jobId') jobId: string,
  @Param('id') id: string,
  @CurrentUser() currentUser: ICurrentUser,
) {
  return this.logAnalysisJobsService.getAnomalyForJob(jobId, id, currentUser.id);
}

@Patch(':jobId/anomalies/:id')
updateAnomaly(
  @Param('jobId') jobId: string,
  @Param('id') id: string,
  @Body() dto: UpdateAnomalyDto,
  @CurrentUser() currentUser: ICurrentUser,
) {
  return this.logAnalysisJobsService.updateAnomalyStatus(
    jobId,
    id,
    currentUser.id,
    dto.status,
  );
}
```

> **Why this reopens the loop:** the dedupe gate at [log-analysis-jobs.service.ts:118-124](../apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts#L118) looks for an existing `open`/`in_progress` anomaly. Setting it to `closed` means the next error finds none → a fresh anomaly + ticket.

---

## Step 0.6 — Ticket read endpoints

A `Ticket` has no `ownerId` of its own — ownership lives on `ticket → anomaly → logAnalysisJob.ownerId`, so the query filters through nested relations (TypeORM auto-joins them).

**File to create (service):** `apps/nest-app/src/ticketing/tickets.service.ts`

```ts
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ticket } from "./entities/ticket.entity";

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  findAll(ownerId: string) {
    return this.ticketRepo.find({
      where: { anomaly: { logAnalysisJob: { ownerId } } },
    });
  }

  findOne(id: string, ownerId: string) {
    return this.ticketRepo.findOne({
      where: { id, anomaly: { logAnalysisJob: { ownerId } } },
    });
  }
}
```

**File to create (controller):** `apps/nest-app/src/ticketing/tickets.controller.ts`

```ts
import { Controller, Get, Param } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { CurrentUser } from "@/auth/current-user.decorator";
import type { ICurrentUser } from "@/auth/current-user.interface";

@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: ICurrentUser) {
    return this.ticketsService.findAll(currentUser.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() currentUser: ICurrentUser) {
    return this.ticketsService.findOne(id, currentUser.id);
  }
}
```

> These are already wired into `TicketingModule` in the Step 0.2 snippet.

---

## Step 0.7 — Prove the loop with the e2e test

**File to edit:** `apps/nest-app/test/ticket-creation.e2e-spec.ts`

The current test **mocks** the factory and only checks `createTicket` was called. Now that tickets persist, run the _real_ internal provider and assert the DB + the close→reopen cycle.

**1. Stop overriding the factory** — delete the mock setup ([lines 26-41](../apps/nest-app/test/ticket-creation.e2e-spec.ts#L26-L41)) and the `.overrideProvider(TicketingProviderFactory).useValue(...)` chain. Keep the `DatabaseTestModule` override:

```ts
moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideModule(DatabaseModule)
  .useModule(DatabaseTestModule)
  .compile();
```

**2. Point the job at the real internal provider** — change the config in `createLogAnalysisJobDto`:

```ts
ticketingSystemConfig: { type: 'InternalTicketingProvider' },
```

**3. Assert a real ticket exists** (after ingesting the error log). The listener is async and not awaited, so poll:

```ts
let tickets: Array<{ id: string }> = [];
await vi.waitFor(
  async () => {
    const res = await request(app.getHttpServer()).get("/tickets").expect(200);
    tickets = res.body;
    expect(tickets).toHaveLength(1);
  },
  { timeout: 5000 },
);
```

**4. Assert the close→reopen cycle** — find the open anomaly, `PATCH` it to `closed`, ingest a second error, and expect a _second_ ticket:

```ts
const anomalies = (
  await request(app.getHttpServer())
    .get(`/log-analysis-jobs/${jobId}/anomalies`)
    .expect(200)
).body as Array<{ id: string }>;

await request(app.getHttpServer())
  .patch(`/log-analysis-jobs/${jobId}/anomalies/${anomalies[0].id}`)
  .send({ status: "closed" })
  .expect(200);

await request(app.getHttpServer())
  .post(`/log-analysis/ingest/${jobId}`)
  .send([{ message: "second-error-log", level: "error" }])
  .expect(200);

await vi.waitFor(
  async () => {
    const res = await request(app.getHttpServer()).get("/tickets").expect(200);
    expect(res.body).toHaveLength(2); // gate reopened → fresh ticket
  },
  { timeout: 5000 },
);
```

---

## Definition of done (the M0 acceptance check)

- [ ] Ingest an error → `GET /tickets` shows a **real persisted** ticket.
- [ ] The anomaly's `ticketInfo` holds the `ticketId` (link saved).
- [ ] `GET /log-analysis-jobs/:jobId/anomalies` lists it; `PATCH` moves it to `closed`.
- [ ] After closing, a **new** error raises a **fresh** anomaly + ticket.
- [ ] A provider error logs instead of vanishing.
- [ ] e2e spec asserts persistence **and** the close→reopen cycle with the real internal provider.

---

## Suggested order & commit checkpoints

| Order | Steps     | Commit message idea                                              |
| ----- | --------- | ---------------------------------------------------------------- |
| 1     | 0.1 + 0.2 | `feat(ticketing): add Ticket entity + InternalTicketingProvider` |
| 2     | 0.3 + 0.4 | `feat(ticketing): persist ticket onto anomaly; guard listener`   |
| 3     | 0.5       | `feat(anomalies): list/get/close endpoints`                      |
| 4     | 0.6       | `feat(tickets): read endpoints`                                  |
| 5     | 0.7       | `test(e2e): assert persistence + close→reopen loop`              |

Tip: if you build 0.1/0.2 before 0.6, temporarily drop `TicketsController`/`TicketsService` out of the module so it compiles, then add them back in 0.6.

---

## Common pitfalls (NestJS-specific)

- **Injecting a repo into the provider class directly.** Won't work — the factory `new`s it. Inject into the _factory_, pass the repo down (0.2).
- **Forgetting `forFeature([Ticket])`.** No table created + "no repository for Ticket" at runtime.
- **`Ticket` name clash.** The entity and the `ticketing.types` interface share a name — alias one (`Ticket as TicketType`) when both are imported.
- **Re-registering `LogAnalysisJobsService`.** `TicketingModule` already imports `LogAnalysisJobsModule`, which exports the service — just use it.
- **Skipping owner-scoping on tickets.** Filter through `anomaly → logAnalysisJob.ownerId`, or you leak other owners' tickets.

---

> Targeting M0 because tickets aren't persisted yet and the anomaly/ticket endpoints don't exist. For **M1 (auth)** or **M2 (ops)**, ask and I'll write that guide.
