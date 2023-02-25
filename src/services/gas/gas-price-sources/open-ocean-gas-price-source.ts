import { ChainId, TimeString } from '@types';
import { IGasPriceSource, GasSpeed } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';

const SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.FANTOM,
  Chains.AVALANCHE,
  Chains.HECO,
  Chains.OKC,
  Chains.GNOSIS,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.CRONOS,
  Chains.MOONRIVER,
  Chains.BOBA,
];

export class OpenOceanGasPriceSource implements IGasPriceSource<'standard' | 'fast' | 'instant'> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds() {
    const speeds: ('standard' | 'fast' | 'instant')[] = ['standard', 'fast', 'instant'];
    return Object.fromEntries(SUPPORTED_CHAINS.map(({ chainId }) => [Number(chainId), speeds]));
  }

  async getGasPrice({ chainId, context }: { chainId: ChainId; context?: { timeout?: TimeString } }) {
    const response = await this.fetchService.fetch(`https://ethapi.openocean.finance/v2/${chainId}/gas-price`, { timeout: context?.timeout });
    const body = await response.json();
    if (typeof body.standard === 'string' || typeof body.standard === 'number') {
      return {
        standard: stringToLegacyGasPrice(body, 'standard'),
        fast: stringToLegacyGasPrice(body, 'fast'),
        instant: stringToLegacyGasPrice(body, 'instant'),
      };
    } else {
      return {
        standard: toEip1159GasPrice(body, 'standard'),
        fast: toEip1159GasPrice(body, 'fast'),
        instant: toEip1159GasPrice(body, 'instant'),
      };
    }
  }
}

function toEip1159GasPrice(body: any, key: GasSpeed) {
  const { maxPriorityFeePerGas, maxFeePerGas } = body[key];
  return {
    maxFeePerGas: `${maxFeePerGas}`,
    maxPriorityFeePerGas: `${maxPriorityFeePerGas}`,
  };
}

function stringToLegacyGasPrice(body: any, key: GasSpeed) {
  return { gasPrice: `${body[key]}` };
}
