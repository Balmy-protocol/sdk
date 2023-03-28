import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IGasPriceSource, GasPriceResult, LegacyGasPrice, GasValueForVersion } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { CHANGELLY_METADATA } from '@services/quotes/quote-sources/changelly';
import { utils } from 'ethers';

type GasValues = GasValueForVersion<'standard' | 'fast' | 'instant', LegacyGasPrice>;
export class ChangellyGasPriceSource implements IGasPriceSource<GasValues> {
  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string) {}

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present', fast: 'present', instant: 'present' };
    return Object.fromEntries(CHANGELLY_METADATA.supports.chains.map((chainId) => [Number(chainId), support]));
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString };
  }) {
    const response = await this.fetchService.fetch(`https://dex-api.changelly.com/v1/${chainId}/gasprices`, {
      timeout: config?.timeout,
      headers: { 'X-Api-Key': this.apiKey },
    });
    const body: Result = await response.json();
    return {
      standard: calculateGas(body, 'low'),
      fast: calculateGas(body, 'medium'),
      instant: calculateGas(body, 'high'),
    } as GasPriceResult<GasValues, Requirements>;
  }
}

function calculateGas(result: Result, value: keyof Result): LegacyGasPrice {
  return {
    gasPrice: utils.parseUnits(result[value], 'gwei').toString(),
  };
}

type Result = {
  low: string;
  medium: string;
  high: string;
};
