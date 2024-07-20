import { ChainId, Timestamp, TimeString } from '@types';
import { IProviderSource } from '../types';
import { chainsUnion } from '@chains';
import { createTransport, type Transport } from 'viem';
import ms from 'ms';

export type LoadBalanceSourceConfig = {
  minSuccessRate?: number;
  minSamples?: number;
  maxAttempts?: number;
  samplesTtl?: TimeString;
};
export class LoadBalanceProviderSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[], private readonly config: LoadBalanceSourceConfig | undefined) {
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

function loadBalance(transports_: readonly Transport[], config: LoadBalanceSourceConfig = {}): Transport {
  const { minSuccessRate = 0.05, minSamples = 3, maxAttempts, samplesTtl = '30m' } = config;

  const rpcMetrics: MethodMetrics[] = transports_.map(() => ({}));

  return ({ chain, timeout, ...rest }) => {
    const transports = transports_.map((t) => t({ chain, timeout, ...rest }));
    return createTransport({
      key: 'load-balance',
      name: 'Load Balancing',
      async request({ method, params }): Promise<any> {
        let availableTransports = transports.map((transport, index) => ({ transport, index }));
        let noAvailableTransportsError = undefined;
        let attempts = 0;

        while (!maxAttempts || attempts < maxAttempts) {
          attempts++;
          const filteredTransports = availableTransports
            .map(({ transport, index }) => ({ transport, index, metrics: cleanupMetrics(rpcMetrics, index, method, samplesTtl) }))
            .filter(({ metrics }) => {
              return metrics.samples.length < minSamples || calculateSuccessRate(metrics) > minSuccessRate;
            });
          if (filteredTransports.length === 0) {
            break; // No transports available
          }

          // Get the best transport
          const { transport, index } = filteredTransports.reduce((best, current) => {
            return calculateScore(current.metrics) > calculateScore(best.metrics) ? current : best;
          });

          // Mark the request as pending and start the timer
          rpcMetrics[index][method].pending++;
          const start = Date.now();
          try {
            const response = await transport.request({ method, params });
            updateMetrics(start, rpcMetrics, index, method, true);

            // The request was successful, return the response
            return response;
          } catch (error) {
            updateMetrics(start, rpcMetrics, index, method, false);
            availableTransports.splice(index, 1); // Remove the current transport
            if (!noAvailableTransportsError) {
              // Save only the first error, it was thrown by the best transport
              noAvailableTransportsError = error;
            }
          }
        }
        throw noAvailableTransportsError ?? new Error('Failed to find a transport to execute the request'); // No transports available
      },
      type: 'load-balance',
    });
  };
}

function initializeMetrics(): RPCMetrics {
  return {
    pending: 0,
    samples: [],
  };
}

function cleanupMetrics(rpcMetrics: MethodMetrics[], index: number, method: string, ttl: TimeString): RPCMetrics {
  if (!rpcMetrics[index][method]) {
    rpcMetrics[index][method] = initializeMetrics();
  } else {
    const cutoffTime = Date.now() - ms(ttl);
    const validSampleIndex = rpcMetrics[index][method].samples.findIndex(({ timestamp }) => timestamp >= cutoffTime);

    if (validSampleIndex === -1) {
      rpcMetrics[index][method] = initializeMetrics();
    } else if (validSampleIndex > 0) {
      rpcMetrics[index][method].samples = rpcMetrics[index][method].samples.slice(validSampleIndex);
    }
  }

  return rpcMetrics[index][method];
}

function updateMetrics(start: number, rpcMetrics: MethodMetrics[], index: number, method: string, isSuccess: boolean) {
  const processingTime = Date.now() - start;
  const sample = { timestamp: Date.now(), success: isSuccess, processingTime };
  rpcMetrics[index][method].samples.push(sample);
  rpcMetrics[index][method].pending--;
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
