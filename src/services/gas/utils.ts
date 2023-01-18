import { GasPriceForSpeed, GasSpeed, EIP1159GasPrice } from './types';

export function isEIP1159Compatible<SupportedGasSpeed extends GasSpeed>(
  gasPriceForSpeed: GasPriceForSpeed<SupportedGasSpeed | 'standard'>
): gasPriceForSpeed is Record<SupportedGasSpeed | 'standard', EIP1159GasPrice> {
  if ('maxFeePerGas' in gasPriceForSpeed.standard) {
    return true;
  }
  return false;
}
