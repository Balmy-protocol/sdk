import { type TransportConfig } from 'viem';

export type LoadBalanceConfig = {
  key?: TransportConfig['key'];
  name?: TransportConfig['name'];
  minSuccessRate?: number;
  minSamples?: number;
  maxAttempts?: number;
};
