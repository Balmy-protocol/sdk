import { BigNumber } from 'ethers';
import { ChainId } from '@types';
import { IGasPriceSource, GasSpeed, GasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';

export class OpenOceanGasPriceSource implements IGasPriceSource {
  constructor(private readonly fetchService: IFetchService) {}

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

  async getGasPrice(chainId: ChainId): Promise<Record<GasSpeed, GasPrice>> {
    const response = await this.fetchService.fetch(`https://ethapi.openocean.finance/v2/${chainId}/gas-price`);
    const body = await response.json();
    if ('standard' in body) {
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
    maxPriorityFeePerGas: BigNumber.from(maxPriorityFeePerGas),
    maxFeePerGas: BigNumber.from(maxFeePerGas),
  };
}

function stringToLegacyGasPrice(body: any, key: GasSpeed) {
  return { gasPrice: BigNumber.from(body[key]) };
}
