import ms, { StringValue } from 'ms';
type Timestamp = number;
type CacheConstructorParams<Value> = {
  calculate: () => Promise<Value>;
  config: AutoUpdateCacheConfig;
};

export type AutoUpdateCacheConfig = {
  useCachedValue: 'always' | { ifUnder: StringValue };
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
        setTimeout(this.update, this.config.update.every);
      })
      .catch(() => {
        setTimeout(this.update, this.config.update.ifFailsTryAgainIn);
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
