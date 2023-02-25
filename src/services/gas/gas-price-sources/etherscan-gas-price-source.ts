import { ChainId, TimeString } from '@types';
import { IGasPriceSource, GasPrice, GasPriceResult } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

const CHAINS = {
  [Chains.ETHEREUM.chainId]: 'etherscan.io',
  [Chains.POLYGON.chainId]: 'polygonscan.com',
  [Chains.BNB_CHAIN.chainId]: 'bscscan.com',
  [Chains.FANTOM.chainId]: 'ftmscan.com',
};

export class EtherscanGasPriceSource implements IGasPriceSource<'standard' | 'fast' | 'instant'> {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey?: string) {}

  supportedSpeeds(): Record<ChainId, ('standard' | 'fast' | 'instant')[]> {
    const speeds: ('standard' | 'fast' | 'instant')[] = ['standard', 'fast', 'instant'];
    return Object.fromEntries(Object.keys(CHAINS).map((chainId) => [Number(chainId), speeds]));
  }

  async getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    let url = `https://api.${CHAINS[chainId]}/api?module=gastracker&action=gasoracle`;
    if (this.apiKey) {
      url += `&apikey=${this.apiKey} `;
    }

    const response = await this.fetchService.fetch(url, { timeout: context?.timeout });
    const {
      result: { SafeGasPrice, ProposeGasPrice, FastGasPrice, suggestBaseFee },
    }: { result: { SafeGasPrice: string; ProposeGasPrice: string; FastGasPrice: string; suggestBaseFee?: string } } = await response.json();
    return {
      standard: calculateGas(SafeGasPrice, suggestBaseFee),
      fast: calculateGas(ProposeGasPrice, suggestBaseFee),
      instant: calculateGas(FastGasPrice, suggestBaseFee),
    } as GasPriceResult<'standard' | 'fast' | 'instant'>;
  }
}

function calculateGas(price: string, baseFee?: string): GasPrice {
  const gasPrice = utils.parseUnits(price, 'gwei');
  if (!baseFee) return { gasPrice: gasPrice.toString() };
  const base = utils.parseUnits(baseFee, 'gwei');
  return {
    maxFeePerGas: gasPrice.toString(),
    maxPriorityFeePerGas: gasPrice.sub(base).toString(),
  };
}
