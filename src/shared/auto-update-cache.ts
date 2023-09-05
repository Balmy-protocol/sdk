import { TimeString } from '@types';
import ms, { StringValue } from 'ms';
type Timestamp = number;
type CacheConstructorParams<Value> = {
  calculate: () => Promise<Value>;
  config: AutoUpdateCacheConfig;
};

const DEFAULT_RETRY_TIME: TimeString = '5M';

export type AutoUpdateCacheConfig = {
  valid?: 'always' | { onlyFor: StringValue };
  update: { every: StringValue; ifFailsTryAgainIn?: StringValue };
};

export class AutoUpdateCache<Value> {
  private readonly calculate: () => Promise<Value>;
  private readonly config: AutoUpdateCacheConfig;
  private cache: { lastUpdated: Timestamp; value: Value | undefined };

  constructor({ calculate, config }: CacheConstructorParams<Value>) {
    this.calculate = calculate;
    this.config = config;
    this.cache = { lastUpdated: 0, value: undefined };

    const isInvalid = config.valid && config.valid !== 'always' && !config.valid.onlyFor;

    if (isInvalid) throw new Error(`'valid' property is misconfigured`);

    this.update();
  }

  private async update() {
    const calculated = this.calculate();
    calculated
      .then((result) => {
        const value = result;
        if (value !== undefined) {
          this.cache = { lastUpdated: Date.now(), value };
        }
        setTimeout(this.update, ms(this.config.update.every));
      })
      .catch(() => {
        setTimeout(this.update, ms(this.config.update.ifFailsTryAgainIn ?? DEFAULT_RETRY_TIME));
      });
  }

  async getValue() {
    const now = Date.now();

    const isValid = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      !this.config.valid ||
      this.config.valid === 'always' ||
      (this.config.valid?.onlyFor && lastUpdated >= now - ms(this.config.valid?.onlyFor));

    return this.cache && isValid(this.cache) ? this.cache.value : undefined;
  }
}
