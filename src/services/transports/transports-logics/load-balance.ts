import { createTransport, type Transport } from 'viem';
import { LoadBalanceConfig } from '../types';

type RPCMetrics = {
  avgProcessingTime: number;
  successRate: number;
  pending: number;
  samples: number;
};

type MethodMetrics = Record<string, RPCMetrics>;

export function loadBalance(transports: readonly Transport[], config: LoadBalanceConfig = {}): Transport {
  const { key = 'loadbalance', name = 'Load Balancing', minSuccessRate = 0.05, minSamples = 3, maxAttempts = 5 } = config;

  const rpcMetrics: MethodMetrics[] = transports.map(() => ({}));

  return ({ chain, timeout, ...rest }) => {
    const transportInstances = transports.map((t) => t({ chain, timeout, ...rest }));

    return createTransport({
      key,
      name,
      async request({ method, params }) {
        const processRequest = async (index: number): Promise<any> => {
          // If we have tried all transports or reached the max attempts, throw an error
          if (index >= transportInstances.length || (maxAttempts && index >= maxAttempts)) {
            throw new Error('All RPC attempts failed');
          }

          const transport = transportInstances[index];

          // Get the metrics for the method
          const metrics = rpcMetrics[index][method] || { avgProcessingTime: 0, successRate: 1, pending: 0, samples: 0 };

          // A min amount of samples to discard an RPC because of the success rate
          if (metrics.samples >= minSamples && metrics.successRate < minSuccessRate) {
            return processRequest(index + 1);
          }

          // Mark the request as pending and start the timer
          metrics.pending++;
          const start = Date.now();
          try {
            const response = await transport.request({ method, params });
            rpcMetrics[index][method] = updateMetrics(start, metrics, true);
            return response;
          } catch (error) {
            rpcMetrics[index][method] = updateMetrics(start, metrics, false);
            return processRequest(index + 1);
          }
        };

        // Sort transports by score and try to make the request
        const sortedIndexesByScore = transportInstances
          .map((_, i) => i)
          .sort((transportA, transportB) => {
            const metricsA = rpcMetrics[transportA][method];
            const metricsB = rpcMetrics[transportB][method];
            if (!metricsA || !metricsB) return 0;

            return calculateScore(metricsB) - calculateScore(metricsA);
          });
        // Try to make the request with the transport with the highest score
        return processRequest(sortedIndexesByScore[0]);
      },
      type: 'loadbalance',
    });
  };
}

function updateMetrics(start: number, metrics: RPCMetrics, isSuccess: boolean) {
  const processingTime = Date.now() - start;
  metrics.avgProcessingTime = (metrics.avgProcessingTime * metrics.samples + processingTime) / (metrics.samples + 1);
  metrics.successRate = (metrics.successRate * metrics.samples + (isSuccess ? 1 : 0)) / (metrics.samples + 1);
  metrics.samples++;
  metrics.pending--;
  return metrics;
}

// Returns a score, where the higher, the better, based on fallback transport weights
// Note: this wasn't properly analyzed, we could come up with something better
function calculateScore(metrics: RPCMetrics) {
  return metrics.successRate * 0.7 + (1 - metrics.avgProcessingTime / 1000) * 0.3;
}
