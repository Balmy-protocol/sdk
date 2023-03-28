import { ITriggerablePromise } from '../source-lists/types';

export class TriggerablePromise<T> implements ITriggerablePromise<T> {
  private promise: Promise<T> | undefined;

  constructor(private readonly trigger: () => Promise<T>) {}

  request(): Promise<T> {
    if (!this.promise) {
      this.promise = this.trigger();
    }
    return this.promise;
  }
}
