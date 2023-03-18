import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IGasPriceSource, EIP1159GasPrice, GasPriceResult, GasValueForVersion } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

type GasValues = GasValueForVersion<'standard' | 'fast' | 'instant', EIP1159GasPrice>;
export class EthGasStationGasPriceSource implements IGasPriceSource<GasValues> {
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
    const response = await this.fetchService.fetch('https://api.ethgasstation.info/api/fee-estimate', { timeout: context?.timeout });
    const {
      nextBaseFee,
      priorityFee: { standard, fast, instant },
    }: { nextBaseFee: number; priorityFee: { fast: number; instant: number; standard: number } } = await response.json();
    return {
      standard: calculateGas(nextBaseFee, standard),
      fast: calculateGas(nextBaseFee, fast),
      instant: calculateGas(nextBaseFee, instant),
    } as GasPriceResult<GasValues, Requirements>;
  }
}

function calculateGas(baseFee: number, priorityFee: number): EIP1159GasPrice {
  return {
    maxFeePerGas: utils.parseUnits(`${baseFee + priorityFee}`, 'gwei').toString(),
    maxPriorityFeePerGas: utils.parseUnits(`${priorityFee}`, 'gwei').toString(),
  };
}
