import { ChainId, TimeString } from '@types';
import { IGasPriceSource, EIP1159GasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

type GasSpeedSupport = { standard: 'present'; fast: 'present'; instant: 'present' };
export class PolygonGasStationGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present', fast: 'present', instant: 'present' };
  }

  supportedChains(): ChainId[] {
    return [Chains.POLYGON.chainId];
  }

  async getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const response = await this.fetchService.fetch('https://gasstation-mainnet.matic.network/v2', { timeout: context?.timeout });
    const { safeLow, standard, fast }: { safeLow: Gas; standard: Gas; fast: Gas } = await response.json();
    return {
      standard: calculateGas(safeLow),
      fast: calculateGas(standard),
      instant: calculateGas(fast),
    };
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
