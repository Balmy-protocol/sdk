// It could happen that we don't want to trigger a promise unless it's necessary. This is specially true with some
// requests (like gas prices) when we might get rate limited, and only a few of the sources need it. So the idea here
// is to have a triggerable promise. It will only be executed when it's requested. At the same time, we will share the
// same promise between all who request it, so that we don't make extra requests
export type ITriggerablePromise<T> = {
  request: () => Promise<T>;
};

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
