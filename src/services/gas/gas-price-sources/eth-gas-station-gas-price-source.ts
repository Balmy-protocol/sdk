import { ChainId, TimeString } from '@types';
import { IGasPriceSource, EIP1159GasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

export class EthGasStationGasPriceSource implements IGasPriceSource<'standard' | 'fast' | 'instant'> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds(): Record<ChainId, ('standard' | 'fast' | 'instant')[]> {
    return { [Chains.ETHEREUM.chainId]: ['standard', 'fast', 'instant'] };
  }

  async getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const response = await this.fetchService.fetch('https://api.ethgasstation.info/api/fee-estimate', { timeout: context?.timeout });
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
