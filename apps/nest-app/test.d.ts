import { mock as mockFn, MockProxy } from 'vitest-mock-extended';

declare global {
  const mock: typeof mockFn;
  type Mocked<T> = MockProxy<T>;
}
