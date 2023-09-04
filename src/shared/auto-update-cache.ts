import { TimeString } from '@types';
import ms, { StringValue } from 'ms';
import { timeoutPromise } from './timeouts';
type Timestamp = number;
type CacheConstructorParams<Value> = {
  calculate: () => Promise<Value>;
  config: AutoUpdateCacheConfig;
};

export type AutoUpdateCacheConfig = {
  options: AutoUpdateConfigOptions;
};

export type AutoUpdateConfigOptions = {
  useCachedValue: 'always' | { ifUnder: StringValue };
  nextUpdate: { ifSuccess: StringValue; ifFails: StringValue };
  timeout?: TimeString;
};

export class AutoUpdateCache<Value> {
  private readonly calculate: () => Promise<Value>;
  private readonly config: AutoUpdateConfigOptions;
  private cache: { lastUpdated: Timestamp; value: Value | undefined };

  constructor({ calculate, config }: CacheConstructorParams<Value>) {
    this.calculate = calculate;
    this.config = config.options;
    this.cache = { lastUpdated: 0, value: undefined };

    this.update();
  }

  async update() {
    const calculated = timeoutPromise(this.calculate(), this.config.timeout);
    calculated
      .then((result) => {
        const value = result;
        if (value !== undefined) {
          this.cache = { lastUpdated: Date.now(), value };
        }
        setTimeout(this.update, this.config.nextUpdate.ifSuccess);
      })
      .catch(() => {
        setTimeout(this.update, this.config.nextUpdate.ifFails);
      });
  }

  async getValue() {
    const now = Date.now();

    const useCachedValue = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      this.config.useCachedValue === 'always' || lastUpdated >= now - ms(this.config.useCachedValue.ifUnder);

    if (!(this.cache && useCachedValue(this.cache))) await this.update();

    return this.cache.value;
  }
}
