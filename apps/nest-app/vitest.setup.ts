import { mock } from 'vitest-mock-extended';

(global as typeof globalThis & { mock: typeof mock }).mock = mock;
