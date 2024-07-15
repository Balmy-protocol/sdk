import { ChainId, Timestamp, TimeString } from '@types';
import { IProviderSource } from '../types';
import { chainsUnion } from '@chains';
import { createTransport, type Transport } from 'viem';
import ms from 'ms';

export type LoadBalanceSourceConfig = LoadBalanceConfig;
export class LoadBalanceProviderSource implements IProviderSource {
  constructor(private readonly sources: IProviderSource[], private readonly config: LoadBalanceConfig | undefined) {
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

function loadBalance(transports_: readonly Transport[], config: LoadBalanceConfig = {}): Transport {
  const { minSuccessRate = 0.05, minSamples = 3, maxAttempts = 3, samplesTtl = '30m' } = config;

  const rpcMetrics: MethodMetrics[] = transports_.map(() => ({}));

  return ({ chain, timeout, ...rest }) => {
    const transports = transports_.map((t) => t({ chain, timeout, ...rest }));
    return createTransport({
      key: 'load-balance',
      name: 'Load Balancing',
      async request({ method, params }) {
        let availableTransports = transports.map((transport, index) => ({ transport, index }));
        if (maxAttempts) availableTransports.splice(maxAttempts);
        const processRequest = async (): Promise<any> => {
          let noAvailableTransportsError = undefined;

          // Try all transports until one succeeds or all fail
          while (true) {
            const filteredTransports = availableTransports.filter((transportMetrics) => {
              return (
                !transportMetrics ||
                !rpcMetrics[transportMetrics.index] ||
                !rpcMetrics[transportMetrics.index][method] ||
                rpcMetrics[transportMetrics.index][method].samples.length < minSamples ||
                calculateSuccessRate(rpcMetrics[transportMetrics.index][method]) > minSuccessRate
              );
            });
            if (filteredTransports.length === 0) {
              throw noAvailableTransportsError ?? new Error('All RPC attempts failed'); // No transports available
            }

            // Get the best transport
            const { transport, index } = filteredTransports.reduce((best, current) => {
              const currentMetrics = rpcMetrics[current.index][method];
              const bestMetrics = rpcMetrics[best.index][method];
              if (!currentMetrics || !bestMetrics) return best;
              return calculateScore(currentMetrics) > calculateScore(bestMetrics) ? current : best;
            });

            // Get the metrics for the method
            let metrics = rpcMetrics[index][method];
            const currentTime = Date.now();
            if (!metrics || metrics.samples.length === 0 || currentTime - metrics.samples[0].timestamp > ms(samplesTtl)) {
              metrics = initializeMetrics();
              rpcMetrics[index][method] = metrics;
            } else {
              metrics = removeInvalidSamples(metrics, currentTime, samplesTtl);
            }

            // Check if the transport is still valid
            const successRate = calculateSuccessRate(metrics);
            if (metrics.samples.length >= minSamples && successRate < minSuccessRate) {
              availableTransports.splice(index, 1); // Remove the best transport
              continue; // Contine with the next transport
            }

            // Mark the request as pending and start the timer
            metrics.pending++;
            const start = currentTime;
            try {
              const response = await transport.request({ method, params });
              rpcMetrics[index][method] = updateMetrics(start, metrics, true);

              // The request was successful, return the response
              return response;
            } catch (error) {
              rpcMetrics[index][method] = updateMetrics(start, metrics, false);
              availableTransports.splice(index, 1); // Remove the best transport
              if (!noAvailableTransportsError) {
                // Save only the first error, it was thrown by the best transport
                noAvailableTransportsError = error;
              }
              continue; // Contine with the next transport
            }
          }
        };
        return processRequest();
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

function removeInvalidSamples(metrics: RPCMetrics, currentTime: number, ttl: TimeString): RPCMetrics {
  const cutoffTime = currentTime - ms(ttl);
  const validSampleIndex = metrics.samples.findIndex(({ timestamp }) => timestamp >= cutoffTime);

  if (validSampleIndex === -1) {
    return initializeMetrics();
  } else if (validSampleIndex > 0) {
    metrics.samples = metrics.samples.slice(validSampleIndex);
  }

  return metrics;
}

function updateMetrics(start: number, metrics: RPCMetrics, isSuccess: boolean): RPCMetrics {
  const processingTime = Date.now() - start;
  const sample = { timestamp: Date.now(), success: isSuccess, processingTime };
  metrics.samples.push(sample);
  metrics.pending--;
  return metrics;
}

function calculateSuccessRate(metrics: RPCMetrics) {
  return metrics && metrics.samples ? metrics.samples.reduce((acc, sample) => acc + (sample.success ? 1 : 0), 0) / metrics.samples.length : 0;
}

function calculateScore(metrics: RPCMetrics) {
  const avgProcessingTime = metrics.samples.reduce((acc, sample) => acc + sample.processingTime, 0) / metrics.samples.length;
  const successRate = calculateSuccessRate(metrics);
  return successRate * 0.7 + (1 - avgProcessingTime / 1000) * 0.3;
}

export type LoadBalanceConfig = {
  minSuccessRate?: number;
  minSamples?: number;
  maxAttempts?: number;
  samplesTtl?: TimeString;
};

type RPCMetrics = {
  pending: number;
  samples: { timestamp: Timestamp; success: boolean; processingTime: number }[];
};

type MethodMetrics = Record<string, RPCMetrics>;
