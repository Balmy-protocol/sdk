import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IGasPriceSource, GasPriceResult, GasValueForVersions, GasValueForVersion, LegacyGasPrice } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';

const SUPPORTED_CHAINS = [Chains.ETHEREUM, Chains.POLYGON, Chains.BNB_CHAIN, Chains.AVALANCHE, Chains.FANTOM, Chains.ARBITRUM, Chains.OPTIMISM];

type GasValues = GasValueForVersion<'standard' | 'fast' | 'instant', LegacyGasPrice>;
export class ParaswapGasPriceSource implements IGasPriceSource<GasValues> {
  constructor(private readonly fetchService: IFetchService) {}

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present', fast: 'present', instant: 'present' };
    return Object.fromEntries(SUPPORTED_CHAINS.map(({ chainId }) => [Number(chainId), support]));
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString };
  }) {
    const response = await this.fetchService.fetch(`https://api.paraswap.io/prices/gas/${chainId}?eip1559=false`, { timeout: config?.timeout });
    const body = await response.json();
    return {
      standard: stringToLegacyGasPrice(body, 'average'),
      fast: stringToLegacyGasPrice(body, 'fast'),
      instant: stringToLegacyGasPrice(body, 'fastest'),
    } as GasPriceResult<GasValues, Requirements>;
  }
}

function stringToLegacyGasPrice(body: any, key: string) {
  return { gasPrice: `${body[key]}` };
}
