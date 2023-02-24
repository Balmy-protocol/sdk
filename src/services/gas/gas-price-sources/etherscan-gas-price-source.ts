import { ChainId } from '@types';
import { IGasPriceSource, GasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';
import { utils } from 'ethers';

const CHAINS = {
  [Chains.ETHEREUM.chainId]: 'etherscan.io',
  [Chains.POLYGON.chainId]: 'polygonscan.com',
  [Chains.BNB_CHAIN.chainId]: 'bscscan.com',
  [Chains.FANTOM.chainId]: 'ftmscan.com',
};

type GasSpeedSupport = { standard: 'present'; fast: 'present'; instant: 'present' };
export class EtherscanGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey?: string) {}

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present', fast: 'present', instant: 'present' };
  }

  supportedChains(): ChainId[] {
    return Object.keys(CHAINS).map(Number);
  }

  async getGasPrice({ chainId }: { chainId: ChainId }) {
    let url = `https://api.${CHAINS[chainId]}/api?module=gastracker&action=gasoracle`;
    if (this.apiKey) {
      url += `&apikey=${this.apiKey} `;
    }

    const response = await this.fetchService.fetch(url);
    const {
      result: { SafeGasPrice, ProposeGasPrice, FastGasPrice, suggestBaseFee },
    }: { result: { SafeGasPrice: string; ProposeGasPrice: string; FastGasPrice: string; suggestBaseFee?: string } } = await response.json();
    return {
      standard: calculateGas(SafeGasPrice, suggestBaseFee),
      fast: calculateGas(ProposeGasPrice, suggestBaseFee),
      instant: calculateGas(FastGasPrice, suggestBaseFee),
    };
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
