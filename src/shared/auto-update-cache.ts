import ms, { StringValue } from 'ms';
type Timestamp = number;
type CacheConstructorParams<Value> = {
  calculate: () => Promise<Value>;
  config: AutoUpdateCacheConfig;
};

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

    const isValid = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      this.config.valid === 'always' || lastUpdated >= now - ms(this.config.valid?.onlyFor);

    return this.cache && isValid(this.cache) ? this.cache.value : undefined;
  }
}
