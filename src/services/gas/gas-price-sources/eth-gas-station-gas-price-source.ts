import { ChainId } from '@types';
import { IGasPriceSource, EIP1159GasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

type GasSpeedSupport = { standard: 'present'; fast: 'present'; instant: 'present' };
export class EthGasStationGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present', fast: 'present', instant: 'present' };
  }

  supportedChains(): ChainId[] {
    return [Chains.ETHEREUM.chainId];
  }

  async getGasPrice({ chainId }: { chainId: ChainId }) {
    const response = await this.fetchService.fetch('https://api.ethgasstation.info/api/fee-estimate');
    const {
      nextBaseFee,
      priorityFee: { standard, fast, instant },
    }: { nextBaseFee: number; priorityFee: { fast: number; instant: number; standard: number } } = await response.json();
    return {
      standard: calculateGas(nextBaseFee, standard),
      fast: calculateGas(nextBaseFee, fast),
      instant: calculateGas(nextBaseFee, instant),
    };
  }
}

function calculateGas(baseFee: number, priorityFee: number): EIP1159GasPrice {
  return {
    maxFeePerGas: utils.parseUnits(`${baseFee + priorityFee}`, 'gwei').toString(),
    maxPriorityFeePerGas: utils.parseUnits(`${priorityFee}`, 'gwei').toString(),
  };
}