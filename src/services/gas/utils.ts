import { GasPriceForSpeed, GasSpeed, EIP1159GasPrice } from './types';

export function isEIP1159Compatible(gasPriceForSpeed: GasPriceForSpeed): gasPriceForSpeed is Record<GasSpeed, EIP1159GasPrice> {
  if ('maxFeePerGas' in gasPriceForSpeed.standard) {
    return true;
  }
  return false;
}
