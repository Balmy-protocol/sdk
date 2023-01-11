import ms, { StringValue } from 'ms';

export type ExpirationConfigOptions = {
  useCachedValue: 'always' | { ifUnder: StringValue };
  useCachedValueIfCalculationFailed: 'always' | { ifUnder: StringValue };
};
type Timestamp = number;
type StorableKey = string;
type ToStorableKey<Context, Key extends ValidKey> = (context: Context, key: Key) => StorableKey;
type ValidKey = string | number | symbol;
type CacheConfig<Context, Key extends ValidKey, Value> = {
  calculate: (context: Context, keys: Key[]) => Promise<Record<Key, Value>>;
  toStorableKey: ToStorableKey<Context, Key>;
  expirationConfig: ExpirationConfigOptions;
};

export class ContextlessCache<Key extends ValidKey, Value> {
  private readonly cache: Cache<undefined, Key, Value>;

  constructor({
    calculate,
    toStorableKey,
    expirationConfig,
  }: {
    calculate: (keys: Key[]) => Promise<Record<Key, Value>>;
    toStorableKey: (key: Key) => string;
    expirationConfig: ExpirationConfigOptions;
  }) {
    this.cache = new Cache({
      calculate: (_, keys) => calculate(keys),
      toStorableKey: (_, key) => toStorableKey(key),
      expirationConfig,
    });
  }

  async getOrCalculateSingle({
    key,
    expirationConfig,
  }: {
    key: Key;
    expirationConfig?: Partial<ExpirationConfigOptions>;
  }): Promise<Value | undefined> {
    return this.cache.getOrCalculateSingle({ context: undefined, key, expirationConfig });
  }

  async getOrCalculate({ keys, expirationConfig }: { keys: Key[]; expirationConfig?: Partial<ExpirationConfigOptions> }) {
    return this.cache.getOrCalculate({ context: undefined, keys, expirationConfig });
  }
}

export class Cache<Context, Key extends ValidKey, Value> {
  private readonly calculate: (context: Context, keys: Key[]) => Promise<Record<Key, Value>>;
  private readonly storableKeyMapper: ToStorableKey<Context, Key>;
  private readonly expirationConfig: ExpirationConfigOptions;
  private readonly cache: Map<StorableKey, { lastUpdated: Timestamp; value: Value }> = new Map();
  private readonly beingCalculated: Map<StorableKey, Promise<any>> = new Map();

  constructor({ calculate, toStorableKey, expirationConfig }: CacheConfig<Context, Key, Value>) {
    this.calculate = calculate;
    this.storableKeyMapper = (context, key) => toStorableKey(context, key).toLowerCase();
    this.expirationConfig = expirationConfig;

    const isInvalid =
      expirationConfig.useCachedValue !== 'always' &&
      expirationConfig.useCachedValueIfCalculationFailed !== 'always' &&
      ms(expirationConfig.useCachedValue.ifUnder) > ms(expirationConfig.useCachedValueIfCalculationFailed.ifUnder);

    if (isInvalid) throw new Error(`'useCachedValue' must be lower or equal than 'useCachedValueIfCalculationFailed'`);
  }

  async getOrCalculateSingle({
    key,
    context,
    expirationConfig,
  }: {
    key: Key;
    context: Context;
    expirationConfig?: Partial<ExpirationConfigOptions>;
  }): Promise<Value | undefined> {
    const result = await this.getOrCalculate({ keys: [key], context, expirationConfig });
    return result[key];
  }

  async getOrCalculate({
    keys,
    context,
    expirationConfig,
  }: {
    keys: Key[];
    context: Context;
    expirationConfig?: Partial<ExpirationConfigOptions>;
  }): Promise<Record<Key, Value>> {
    const options = { ...this.expirationConfig, ...expirationConfig };

    const storableKeys = Object.fromEntries(keys.map((key) => [key, this.storableKeyMapper(context, key)])) as Record<Key, StorableKey>;
    const now = Date.now();
    const useCachedValue = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      options.useCachedValue === 'always' || lastUpdated >= now - ms(options.useCachedValue.ifUnder);
    const notInCache: Key[] = [];
    const result: Record<Key, Value> = {} as any;

    // Check if we can use cached version or we need to calculate values
    for (const key of keys) {
      const valueInCache = this.cache.get(storableKeys[key]);
      if (valueInCache && useCachedValue(valueInCache)) {
        result[key] = valueInCache.value;
      } else {
        notInCache.push(key);
      }
    }

    // Nothing else to calculate
    if (notInCache.length === 0) return result;

    // Try to calculate missing values
    const toCalculate = notInCache.filter((key) => !this.beingCalculated.has(storableKeys[key]));
    if (toCalculate.length > 0) {
      const calculated = this.calculate(context, toCalculate);
      for (const key of toCalculate) {
        const storableKey = storableKeys[key];
        const promise = calculated
          .then((result) => {
            const value = result[key];
            if (value !== undefined) {
              this.cache.set(storableKey, { lastUpdated: Date.now(), value });
            }
          })
          .catch(() => {})
          .finally(() => this.beingCalculated.delete(storableKey));
        this.beingCalculated.set(storableKey, promise);
      }
    }

    // Wait for all calculations
    const calculationPromises = notInCache.map((key) => this.beingCalculated.get(storableKeys[key]));
    await Promise.all(calculationPromises);

    const nowAgain = Date.now();
    const useCachedValueIfCalculationFailed = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      options.useCachedValueIfCalculationFailed === 'always' || lastUpdated >= nowAgain - ms(options.useCachedValueIfCalculationFailed.ifUnder);

    // Check all values again
    for (const key of notInCache) {
      const storableKey = storableKeys[key];
      const valueInCache = this.cache.get(storableKey);
      if (valueInCache) {
        if (useCachedValueIfCalculationFailed(valueInCache)) {
          // If can use it, then add it to result
          result[key] = valueInCache.value;
        } else {
          // If not, then delete the value
          this.cache.delete(storableKey);
        }
      }
    }

    return result;
  }

  populate(context: Context, values: Record<Key, Value>) {
    const now = Date.now();
    for (const key in values) {
      const storableKey = this.storableKeyMapper(context, key);
      this.cache.set(storableKey, { lastUpdated: now, value: values[key] });
    }
  }
}
