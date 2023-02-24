import { ChainId } from '@types';
import { IGasPriceSource, GasSpeed } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';

type GasSpeedSupport = { standard: 'present'; fast: 'present'; instant: 'present' };
export class OpenOceanGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present', fast: 'present', instant: 'present' };
  }

  supportedChains(): ChainId[] {
    return [
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
    ].map(({ chainId }) => chainId);
  }

  async getGasPrice({ chainId }: { chainId: ChainId }) {
    const response = await this.fetchService.fetch(`https://ethapi.openocean.finance/v2/${chainId}/gas-price`);
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
