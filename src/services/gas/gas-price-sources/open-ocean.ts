import { BigNumber } from 'ethers';
import { Network } from '@types';
import { IGasPriceSource, GasSpeed, GasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Networks } from '@networks';

export class OpenOceanGasPriceSource implements IGasPriceSource {
  constructor(private readonly fetchService: IFetchService) {}

  supportedNetworks(): Network[] {
    return [
      Networks.ETHEREUM,
      Networks.POLYGON,
      Networks.BNB_CHAIN,
      Networks.FANTOM,
      Networks.AVALANCHE,
      Networks.HECO,
      Networks.OKC,
      Networks.GNOSIS,
      Networks.ARBITRUM,
      Networks.OPTIMISM,
      Networks.CRONOS,
      Networks.MOONRIVER,
      Networks.BOBA,
    ];
  }

  async getGasPrice(network: Network): Promise<Record<GasSpeed, GasPrice>> {
    const response = await this.fetchService.fetch(`https://ethapi.openocean.finance/v2/${network.chainId}/gas-price`);
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
