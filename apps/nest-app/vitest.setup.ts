import { mock } from 'vitest-mock-extended';

(global as typeof globalThis & { mock: typeof mock }).mock = mock;

process.env.API_KEY ??= 'test-api-key';
process.env.INGEST_KEY ??= 'test-ingest-key';
