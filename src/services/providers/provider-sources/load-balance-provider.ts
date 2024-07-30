import { ChainId, Timestamp, TimeString } from '@types';
import { IProviderSource } from '../types';
import { chainsUnion } from '@chains';
import { createTransport, EIP1193RequestFn, Transport } from 'viem';
import ms from 'ms';

export type LoadBalanceProviderSourceConfig = {
  minSuccessRate?: number;
  minSamples?: number;
  maxAttempts?: number;
  maxConcurrent?: number;
  samplesTtl?: TimeString;
};
export class LoadBalanceProviderSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[], private readonly config: LoadBalanceProviderSourceConfig | undefined) {
    if (sources.length === 0) throw new Error('Need at least one source to setup the provider source');
  }

  supportedChains() {
    return chainsUnion(this.sources.map((source) => source.supportedChains()));
  }

  getViemTransport({ chainId }: { chainId: ChainId }) {
    const transports = this.sources
      .filter((source) => source.supportedChains().includes(chainId))
      .map((source) => source.getViemTransport({ chainId }));
    if (transports.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    return loadBalance(transports, this.config);
  }
}

const DEFAULT_CONFIG = {
  minSuccessRate: 0.05,
  minSamples: 3,
  samplesTtl: '30m',
  maxConcurrent: 2,
} satisfies LoadBalanceProviderSourceConfig;

function loadBalance(transports_: readonly Transport[], config: LoadBalanceProviderSourceConfig = {}): Transport {
  const { minSuccessRate, minSamples, maxAttempts, maxConcurrent, samplesTtl } = { ...DEFAULT_CONFIG, ...config };

  return ({ chain, timeout, ...rest }) => {
    const transports = transports_
      .map((t) => t({ chain, timeout, ...rest }))
      .map((transport) => new TransportInstance(transport, { samplesTtl }));
    return createTransport({
      key: 'load-balance',
      name: 'Load Balancing',
      type: 'load-balance',
      async request({ method, ...params }): Promise<any> {
        const availableTransports: Record<string, TransportInstance> = Object.fromEntries(
          transports.map((transport, index) => [`${index}`, transport])
        );
        const errors: any[] = [];
        let attempts = 0;

        while (!maxAttempts || attempts < maxAttempts) {
          const filteredTransports = Object.entries(availableTransports)
            .map(([id, transport]) => ({ transport, id, metrics: transport.metrics(method) }))
            .filter(({ metrics }) => metrics.samples.length < minSamples || calculateSuccessRate(metrics) > minSuccessRate);

          if (filteredTransports.length === 0) {
            break; // No transports available
          }

          let toExecute: { transport: TransportInstance; id: string }[];
          const transportsWithSamples = filteredTransports.filter(({ metrics }) => metrics.samples.length > 0);
          const transportsWithoutSamples = filteredTransports.filter(({ metrics }) => metrics.samples.length === 0);

          if (transportsWithSamples.length > 0) {
            // If there are some transports with samples, then find the best among them
            const bestTransport = transportsWithSamples.reduce((best, current) =>
              calculateScore(current.metrics) > calculateScore(best.metrics) ? current : best
            );
            // We will execute the best transport together with all transports that have no samples. We do this because we don't know if those transports are good or bad
            // and we will take this opportunity to gather some samples from them
            toExecute = [bestTransport, ...transportsWithoutSamples];
          } else {
            // If there are no transports with samples, then we will execute all transports. We will return one that succeeds first and add some samples for the others at the same time
            toExecute = transportsWithoutSamples;
          }

          if (maxAttempts || maxConcurrent) {
            // If we have a limit on the number of attempts, we will execute only the number of transports that we can afford
            const attemptsLeft = maxAttempts ? maxAttempts - attempts : Infinity;
            const concurrency = maxConcurrent ?? Infinity;
            toExecute = toExecute.slice(0, Math.min(attemptsLeft, concurrency));
          }

          const start = Date.now();
          try {
            console.log('Executing', JSON.stringify(toExecute));
            const result = await Promise.any(toExecute.map(({ transport }) => transport.request({ method, ...params })));
            console.log(`Managed to execute for ${JSON.stringify(toExecute)} in ${Date.now() - start}ms`);
            return result;
          } catch (error: any) {
            console.log(`Failed to execute for ${JSON.stringify(toExecute)} in ${Date.now() - start}ms`);
            // Consider all transports used as attempts
            attempts += toExecute.length;

            // Remove executed transports from the list of available transports
            toExecute.forEach(({ id }) => delete availableTransports[id]);

            // Remember error
            if (error instanceof AggregateError) {
              errors.push(...error.errors);
            } else {
              errors.push(error);
            }
          }
        }

        throw errors.length > 0 ? new AggregateError(errors) : new Error('Failed to find a transport to execute the request'); // No transports available
      },
    });
  };
}

class TransportInstance {
  private readonly methodMetrics: MethodMetrics = {};

  constructor(private readonly transport: { request: EIP1193RequestFn }, private readonly config: { samplesTtl: TimeString }) {}

  async request(...args: Parameters<EIP1193RequestFn>) {
    const start = Date.now();
    const method = args[0].method;

    this.initializeMetricsIfNecessary(method);
    this.methodMetrics[method].pending++;

    try {
      const result = await this.transport.request(...args);
      this.addSample({ method, start, success: true });
      return result;
    } catch (e) {
      this.addSample({ method, start, success: false });
      throw e;
    }
  }

  metrics(method: string) {
    this.initializeMetricsIfNecessary(method);

    // Cleanup
    const cutoffTime = Date.now() - ms(this.config.samplesTtl);
    const validSampleIndex = this.methodMetrics[method].samples.findIndex(({ timestamp }) => timestamp >= cutoffTime);

    if (validSampleIndex === -1) {
      this.methodMetrics[method].samples.length = 0;
    } else if (validSampleIndex > 0) {
      this.methodMetrics[method].samples = this.methodMetrics[method].samples.slice(validSampleIndex);
    }

    return this.methodMetrics[method];
  }

  private initializeMetricsIfNecessary(method: string) {
    if (!(method in this.methodMetrics)) {
      this.methodMetrics[method] = { pending: 0, samples: [] };
    }
  }

  private addSample({ method, start, success }: { method: string; start: number; success: boolean }) {
    const processingTime = Date.now() - start;
    const sample = { timestamp: Date.now(), success, processingTime };
    this.methodMetrics[method].samples.push(sample);
    this.methodMetrics[method].pending--;
  }
}

function calculateSuccessRate(metrics: RPCMetrics) {
  return metrics && metrics.samples ? metrics.samples.reduce((acc, sample) => acc + (sample.success ? 1 : 0), 0) / metrics.samples.length : 0;
}

function calculateScore(metrics: RPCMetrics) {
  if (metrics.samples.length == 0) return Infinity;
  const avgProcessingTime = metrics.samples.reduce((acc, sample) => acc + sample.processingTime, 0) / metrics.samples.length;
  const successRate = calculateSuccessRate(metrics);
  return successRate * 0.7 + (1 - avgProcessingTime / 1000) * 0.3;
}

type RPCMetrics = {
  pending: number;
  samples: { timestamp: Timestamp; success: boolean; processingTime: number }[];
};

type MethodMetrics = Record<string, RPCMetrics>;
