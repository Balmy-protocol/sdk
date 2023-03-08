import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IGasPriceSource, EIP1159GasPrice, GasPriceResult, GasValueForVersion } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

type GasValues = GasValueForVersion<'standard' | 'fast' | 'instant', EIP1159GasPrice>;
export class PolygonGasStationGasPriceSource implements IGasPriceSource<GasValues> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present', fast: 'present', instant: 'present' };
    return { [Chains.ETHEREUM.chainId]: support };
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    context,
  }: {
    chainId: ChainId;
    context?: { timeout?: TimeString };
  }) {
    const response = await this.fetchService.fetch('https://gasstation-mainnet.matic.network/v2', { timeout: context?.timeout });
    const { safeLow, standard, fast }: { safeLow: Gas; standard: Gas; fast: Gas } = await response.json();
    return {
      standard: calculateGas(safeLow),
      fast: calculateGas(standard),
      instant: calculateGas(fast),
    } as GasPriceResult<GasValues, Requirements>;
  }
}

function calculateGas(gas: Gas): EIP1159GasPrice {
  return {
    maxFeePerGas: utils.parseUnits(gas.maxFee.toFixed(9), 'gwei').toString(),
    maxPriorityFeePerGas: utils.parseUnits(gas.maxPriorityFee.toFixed(9), 'gwei').toString(),
  };
}

type Gas = {
  maxPriorityFee: number;
  maxFee: number;
};
