import { EIP1159GasPrice, GasSpeed, GasPriceResult, GasPriceForSpeed } from './types';

export function isEIP1159Compatible<SupportedGasSpeed extends GasSpeed>(
  gasPriceForSpeed: GasPriceResult<SupportedGasSpeed>
): gasPriceForSpeed is GasPriceForSpeed<SupportedGasSpeed, EIP1159GasPrice> {
  if ('maxFeePerGas' in gasPriceForSpeed.standard) {
    return true;
  }
  return false;
}
