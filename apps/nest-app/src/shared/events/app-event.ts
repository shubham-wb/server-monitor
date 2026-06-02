export abstract class AppEvent<T = any> {
  constructor(readonly payload: T) {}
}
