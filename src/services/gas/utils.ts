import { EIP1159GasPrice, GasSpeedSupportRecord, GasSpeedPriceResult, LegacyGasPrice } from './types';

export function isEIP1159Compatible<SupportRecord extends GasSpeedSupportRecord>(
  gasPriceForSpeed: GasSpeedPriceResult<SupportRecord, EIP1159GasPrice> | GasSpeedPriceResult<SupportRecord, LegacyGasPrice>
): gasPriceForSpeed is GasSpeedPriceResult<SupportRecord, EIP1159GasPrice> {
  if ('maxFeePerGas' in gasPriceForSpeed.standard) {
    return true;
  }
  return false;
}
