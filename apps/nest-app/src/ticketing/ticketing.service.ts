import { AnomalyCreatedEvent } from '@/shared/events/anomaly.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class TicketingService {
  @OnEvent(AnomalyCreatedEvent.name)
  handleAnomalyCreatedEvent({ payload: { anomaly } }: AnomalyCreatedEvent) {
    console.log({ anomaly });
  }
}
