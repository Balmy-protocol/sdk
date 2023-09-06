import { TimeString, Timestamp } from '@types';
import ms from 'ms';
type CacheConstructorParams<Value> = {
  calculate: () => Promise<Value>;
  config: AutoUpdateCacheConfig;
};

const DEFAULT_RETRY_TIME: TimeString = '5Minutes';

export type AutoUpdateCacheConfig = {
  valid?: 'always' | { onlyFor: TimeString };
  update: { every: TimeString; ifFailsTryAgainIn?: TimeString };
};

export class AutoUpdateCache<Value> {
  private readonly calculate: () => Promise<Value>;
  private readonly config: AutoUpdateCacheConfig;
  private cache: { lastUpdated: Timestamp; value: Value | undefined };

  constructor({ calculate, config }: CacheConstructorParams<Value>) {
    this.calculate = calculate;
    this.config = config;
    this.cache = { lastUpdated: 0, value: undefined };

    const isInvalid = config.valid && config.valid !== 'always' && ms(config.valid.onlyFor) <= ms(config.update.every);

    if (isInvalid) throw new Error(`'onlyFor' must be greater than 'every'`);

    this.update();
  }

  getValue(): Value | undefined {
    const now = Date.now();

    const isValid = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      !this.config.valid || this.config.valid === 'always' || (this.config.valid.onlyFor && lastUpdated >= now - ms(this.config.valid.onlyFor));

    return this.cache && isValid(this.cache) ? this.cache.value : undefined;
  }

  private async update() {
    try {
      const result = await this.calculate();
      if (result !== undefined) {
        this.cache = { lastUpdated: Date.now(), value: result };
      }
      setTimeout(() => this.update(), ms(this.config.update.every));
    } catch (error) {
      setTimeout(() => this.update(), ms(this.config.update.ifFailsTryAgainIn ?? DEFAULT_RETRY_TIME));
    }
  }
}
