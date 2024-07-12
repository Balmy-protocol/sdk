import { ChainId, TimeString } from '@types';
import { IProviderSource } from '../types';
import { chainsUnion } from '@chains';
import { createTransport, TransactionRejectedRpcError, TransportConfig, UserRejectedRequestError, type Transport } from 'viem';
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

export function loadBalance(transports_: readonly Transport[], config: LoadBalanceConfig = {}): Transport {
  const { key = 'load-balance', name = 'Load Balancing', minSuccessRate = 0.05, minSamples = 3, maxAttempts = 3, samplesTtl = '5m' } = config;

  const rpcMetrics: MethodMetrics[] = transports_.map(() => ({}));

  return ({ chain, timeout, ...rest }) => {
    const transports = transports_.map((t) => t({ chain, timeout, ...rest }));

    return createTransport({
      key,
      name,
      async request({ method, params }) {
        let availableTransports = transports.map((transport, index) => ({ transport, index }));

        const processRequest = async (): Promise<any> => {
          if (availableTransports.length === 0) {
            throw new Error('All RPC attempts failed');
          }

          // Sort transports by score
          availableTransports.sort((a, b) => {
            const metricsA = rpcMetrics[a.index][method];
            const metricsB = rpcMetrics[b.index][method];
            if (!metricsA || !metricsB) return 0;
            return calculateScore(metricsB) - calculateScore(metricsA);
          });

          const { transport, index } = availableTransports[0]; // Get the best transport

          // Get the metrics for the method
          let metrics = rpcMetrics[index][method];
          const currentTime = Date.now();
          if (!metrics || metrics.samples.length === 0 || currentTime - metrics.samples[0] > ms(samplesTtl)) {
            metrics = initializeMetrics();
            rpcMetrics[index][method] = metrics;
          } else {
            metrics = removeInvalidSamples(metrics, currentTime, samplesTtl);
          }

          if (metrics.samples.length >= minSamples && metrics.successRate < minSuccessRate) {
            availableTransports.shift(); // Remove this transport. The best is the first, so we can shift
            return processRequest(); // Try the next best transport
          }

          // Mark the request as pending and start the timer
          metrics.pending++;
          const start = currentTime;
          try {
            const response = await transport.request({ method, params });
            rpcMetrics[index][method] = updateMetrics(start, metrics, true);
            return response;
          } catch (error) {
            // If the error is a rejection, we should throw it
            if (shouldThrow(error as Error)) throw error;

            rpcMetrics[index][method] = updateMetrics(start, metrics, false);
            availableTransports.shift(); // Remove this transport. The best is the first, so we can shift
            return processRequest(); // Try the next best transport
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
    avgProcessingTime: 0,
    successRate: 1,
    pending: 0,
    samples: [],
    successCount: 0, // We need this to calculate the success rate when removing samples
  };
}

function removeInvalidSamples(metrics: RPCMetrics, currentTime: number, ttl: TimeString): RPCMetrics {
  const cutoffTime = currentTime - ms(ttl);
  const validSampleIndex = metrics.samples.findIndex((time) => time >= cutoffTime);

  if (validSampleIndex === -1) {
    return initializeMetrics();
  } else if (validSampleIndex > 0) {
    const removedSamples = validSampleIndex;
    metrics.successCount = Math.round(metrics.successRate * (metrics.samples.length - removedSamples));
    metrics.samples = metrics.samples.slice(validSampleIndex);
    metrics.successRate = metrics.successCount / metrics.samples.length;
  }

  return metrics;
}

function updateMetrics(start: number, metrics: RPCMetrics, isSuccess: boolean): RPCMetrics {
  const processingTime = Date.now() - start;
  const newSampleCount = metrics.samples.length + 1;
  metrics.avgProcessingTime = (metrics.avgProcessingTime * metrics.samples.length + processingTime) / newSampleCount;
  metrics.successCount += isSuccess ? 1 : 0;
  metrics.successRate = metrics.successCount / newSampleCount;
  metrics.pending--;
  metrics.samples.push(Date.now());
  return metrics;
}

function calculateScore(metrics: RPCMetrics) {
  return metrics.successRate * 0.7 + (1 - metrics.avgProcessingTime / 1000) * 0.3;
}

function shouldThrow(error: Error) {
  if ('code' in error && typeof error.code === 'number') {
    if (
      error.code === TransactionRejectedRpcError.code ||
      error.code === UserRejectedRequestError.code ||
      error.code === 5000 // CAIP UserRejectedRequestError
    )
      return true;
  }
  return false;
}

export type LoadBalanceConfig = {
  key?: TransportConfig['key'];
  name?: TransportConfig['name'];
  minSuccessRate?: number;
  minSamples?: number;
  maxAttempts?: number;
  samplesTtl?: TimeString;
};

type RPCMetrics = {
  avgProcessingTime: number;
  successRate: number;
  pending: number;
  samples: number[];
  successCount: number;
};

type MethodMetrics = Record<string, RPCMetrics>;
