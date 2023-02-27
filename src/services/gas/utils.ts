import { EIP1159GasPrice, GasSpeed, GasPriceResult, GasPriceForSpeed } from './types';

export function isEIP1159Compatible<SupportedGasSpeed extends GasSpeed>(
  gasPriceForSpeed: GasPriceResult<SupportedGasSpeed>
): gasPriceForSpeed is GasPriceForSpeed<SupportedGasSpeed, EIP1159GasPrice> {
  const keys = Object.keys(gasPriceForSpeed);
  if (keys.length === 0) {
    throw new Error(`Found a gas price result with nothing on it. This shouldn't happen`);
  }
  const gasPrice = gasPriceForSpeed[keys[0] as SupportedGasSpeed];
  if ('maxFeePerGas' in gasPrice) {
    return true;
  }
  return false;
}
