import { TimeString } from '@types';
import ms, { StringValue } from 'ms';
import { LRUCache } from 'lru-cache';
import { timeoutPromise } from './timeouts';

export type ExpirationConfigOptions = {
  useCachedValue: 'always' | { ifUnder: StringValue };
  useCachedValueIfCalculationFailed: 'always' | { ifUnder: StringValue };
};
export type CacheConfig = {
  expiration: ExpirationConfigOptions;
  maxSize: number;
};
type Timestamp = number;
type StorableKey = string;
type ToStorableKey<Key extends ValidKey> = (key: Key) => StorableKey;
type ValidKey = string | number | symbol;
type CacheConstructorParams<Context, Key extends ValidKey, Value> = {
  calculate: (context: Context, keys: Key[]) => Promise<Record<Key, Value>>;
  config: CacheConfig;
};

export class ConcurrentLRUCache<Key extends ValidKey, Value> {
  private readonly cache: ConcurrentLRUCacheWithContext<undefined, Key, Value>;

  constructor({
    calculate,
    config,
  }: {
    calculate: (keys: Key[]) => Promise<Record<Key, Value>>;
  } & { config: CacheConfig }) {
    this.cache = new ConcurrentLRUCacheWithContext({
      calculate: (_, keys) => calculate(keys),
      config,
    });
  }

  async getOrCalculateSingle({
    key,
    expirationConfig,
    timeout,
  }: {
    key: Key;
    expirationConfig?: Partial<ExpirationConfigOptions>;
    timeout?: TimeString;
  }): Promise<Value | undefined> {
    return this.cache.getOrCalculateSingle({ context: undefined, key, expirationConfig, timeout });
  }

  async getOrCalculate({
    keys,
    expirationConfig,
    timeout,
  }: {
    keys: Key[];
    expirationConfig?: Partial<ExpirationConfigOptions>;
    timeout?: TimeString;
  }) {
    return this.cache.getOrCalculate({ context: undefined, keys, expirationConfig, timeout });
  }

  holdsValidValue(key: Key, expirationConfig?: ExpirationConfigOptions): boolean {
    return this.cache.holdsValidValue(key, expirationConfig);
  }

  holdsValidValues(keys: Key[], expirationConfig?: ExpirationConfigOptions): Record<Key, boolean> {
    return this.cache.holdsValidValues(keys, expirationConfig);
  }

  invalidate(keys: Key[]) {
    return this.cache.invalidate(keys);
  }
}

export class ConcurrentLRUCacheWithContext<Context, Key extends ValidKey, Value> {
  private readonly calculate: (context: Context, keys: Key[]) => Promise<Record<Key, Value>>;
  private readonly storableKeyMapper: ToStorableKey<Key>;
  private readonly expirationConfig: ExpirationConfigOptions;
  private readonly beingCalculated: Map<StorableKey, Promise<Value | undefined>> = new Map();
  private readonly cache: LRUCache<string, { lastUpdated: Timestamp; value: Value }>;

  constructor({ calculate, config }: CacheConstructorParams<Context, Key, Value>) {
    const isInvalid =
      config.expiration.useCachedValue !== 'always' &&
      config.expiration.useCachedValueIfCalculationFailed !== 'always' &&
      ms(config.expiration.useCachedValue.ifUnder) > ms(config.expiration.useCachedValueIfCalculationFailed.ifUnder);

    if (isInvalid) throw new Error(`'useCachedValue' must be lower or equal than 'useCachedValueIfCalculationFailed'`);

    this.calculate = calculate;
    this.storableKeyMapper = (key) => key.toString().toLowerCase();
    this.expirationConfig = config.expiration;
    this.cache = new LRUCache({ max: config.maxSize });
  }

  async getOrCalculateSingle({
    key,
    context,
    expirationConfig,
    timeout,
  }: {
    key: Key;
    context: Context;
    expirationConfig?: Partial<ExpirationConfigOptions>;
    timeout?: TimeString;
  }): Promise<Value | undefined> {
    const result = await this.getOrCalculate({ keys: [key], context, expirationConfig, timeout });
    return result[key];
  }

  async getOrCalculate({
    keys,
    context,
    expirationConfig,
    timeout,
  }: {
    keys: Key[];
    context: Context;
    expirationConfig?: Partial<ExpirationConfigOptions>;
    timeout?: TimeString;
  }): Promise<Record<Key, Value>> {
    const options = { ...this.expirationConfig, ...expirationConfig };

    const storableKeys = Object.fromEntries(keys.map((key) => [key, this.storableKeyMapper(key)])) as Record<Key, StorableKey>;
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
              return value;
            }
            return undefined;
          })
          .catch(() => undefined)
          .finally(() => this.beingCalculated.delete(storableKey));
        this.beingCalculated.set(storableKey, promise);
      }
    }

    // Wait for all calculations
    const calculationPromises = notInCache.map<Promise<[Key, Value | undefined]>>(async (key) => [
      key,
      // Note: we add the timeout here so that even though this particular request might timeout, the result is still being made in the background
      //       Once it's done, we'll fill the cache for the next time
      await timeoutPromise(this.beingCalculated.get(storableKeys[key]) ?? Promise.resolve(undefined), timeout).catch(() => undefined),
    ]);
    const calculated = Object.fromEntries(await Promise.all(calculationPromises)) as Record<Key, Value | undefined>;

    const nowAgain = Date.now();
    const useCachedValueIfCalculationFailed = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      options.useCachedValueIfCalculationFailed === 'always' || lastUpdated >= nowAgain - ms(options.useCachedValueIfCalculationFailed.ifUnder);

    // Check all values again
    for (const key of notInCache) {
      // Check if we could calculate it
      const calculatedValue: Value | undefined = calculated[key];
      if (calculatedValue !== undefined) {
        result[key] = calculatedValue;
      } else {
        // If we couldn't calculate it, check if we had an old value stored in the cache we can still use
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
    }

    return result;
  }

  holdsValidValue(key: Key, expirationConfig?: ExpirationConfigOptions): boolean {
    const { [key]: holdsValidValue } = this.holdsValidValues([key], expirationConfig);
    return holdsValidValue;
  }

  holdsValidValues(keys: Key[], expirationConfig?: ExpirationConfigOptions): Record<Key, boolean> {
    const options = { ...this.expirationConfig, ...expirationConfig };
    const now = Date.now();

    const isValidEntry = ({ lastUpdated }: { lastUpdated: Timestamp }) =>
      options.useCachedValue === 'always' || lastUpdated >= now - ms(options.useCachedValue.ifUnder);

    const entries = keys.map((key) => {
      const entry = this.cache.get(this.storableKeyMapper(key));
      const holdsValidValue = entry ? isValidEntry(entry) : false;
      return [key, holdsValidValue];
    });
    return Object.fromEntries(entries);
  }

  invalidate(keys: Key[]) {
    keys.forEach((key) => this.cache.delete(this.storableKeyMapper(key)));
  }

  populate(values: Record<Key, Value>) {
    const now = Date.now();
    for (const key in values) {
      const storableKey = this.storableKeyMapper(key);
      this.cache.set(storableKey, { lastUpdated: now, value: values[key] });
    }
  }
}
