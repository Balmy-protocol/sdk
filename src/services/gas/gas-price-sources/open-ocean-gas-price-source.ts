import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IGasPriceSource, GasSpeed, GasPriceResult, GasValueForVersions } from '@services/gas/types';
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
  Chains.POLYGON_ZKEVM,
  Chains.KAVA,
];

type GasValues = GasValueForVersions<'standard' | 'fast' | 'instant'>;
export class OpenOceanGasPriceSource implements IGasPriceSource<GasValues> {
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
    const response = await this.fetchService.fetch(`https://ethapi.openocean.finance/v2/${chainId}/gas-price`, { timeout: config?.timeout });
    const body = await response.json();
    const result =
      typeof body.standard === 'string' || typeof body.standard === 'number'
        ? {
            standard: stringToLegacyGasPrice(body, 'standard'),
            fast: stringToLegacyGasPrice(body, 'fast'),
            instant: stringToLegacyGasPrice(body, 'instant'),
          }
        : {
            standard: toEip1159GasPrice(body, 'standard'),
            fast: toEip1159GasPrice(body, 'fast'),
            instant: toEip1159GasPrice(body, 'instant'),
          };
    return result as GasPriceResult<GasValues, Requirements>;
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
