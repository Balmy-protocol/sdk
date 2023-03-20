import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { IGasPriceSource, GasPrice, GasPriceResult, GasValueForVersions } from '@services/gas/types';
import { IFetchService } from '@services/fetch/types';
import { Chains } from '@chains';

const CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth',
  [Chains.AVALANCHE.chainId]: 'avax',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.POLYGON.chainId]: 'poly',
  [Chains.ARBITRUM.chainId]: 'arb',
  [Chains.OPTIMISM.chainId]: 'opt',
  [Chains.CRONOS.chainId]: 'cro',
  [Chains.FANTOM.chainId]: 'ftm',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.MOONRIVER.chainId]: 'movr',
  [Chains.HECO.chainId]: 'ht',
  [Chains.CELO.chainId]: 'celo',
  [Chains.HARMONY_SHARD_0.chainId]: 'one',
  [Chains.FUSE.chainId]: 'fuse',
};
const DEFAULT_CONFIG: Config = {
  blocks: 200,
  percentile: 0.3,
  accept: {
    standard: 60,
    fast: 90,
    instant: 95,
  },
};
type GasValues = GasValueForVersions<'standard' | 'fast' | 'instant'>;
export class OwlracleGasPriceSource implements IGasPriceSource<GasValues> {
  private readonly config: Config;

  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string, config?: Partial<Config>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present', fast: 'present', instant: 'present' };
    return Object.fromEntries(Object.keys(CHAINS).map((chainId) => [Number(chainId), support]));
  }

  async getGasPrice<Requirements extends FieldsRequirements<GasValues>>({
    chainId,
    config,
  }: {
    chainId: ChainId;
    config?: { timeout?: TimeString };
  }) {
    const key = CHAINS[chainId];
    const accept = [this.config.accept.standard, this.config.accept.fast, this.config.accept.instant].join(',');
    const response = await this.fetchService.fetch(
      `https://api.owlracle.info/v3/${key}/gas` +
        `?apikey=${this.apiKey}` +
        `&reportwei=true` +
        `&feeinusd=false` +
        `&accept=${accept}` +
        `&percentile=${this.config.percentile}` +
        `&blocks=${this.config.blocks}`,
      { timeout: config?.timeout }
    );
    const { speeds }: { speeds: GasPrice[] } = await response.json();
    const [standard, fast, instant] = speeds;
    return {
      standard: filterOutExtraData(standard),
      fast: filterOutExtraData(fast),
      instant: filterOutExtraData(instant),
    } as GasPriceResult<GasValues, Requirements>;
  }
}

function filterOutExtraData(result: any): GasPrice {
  return 'maxFeePerGas' in result
    ? { maxFeePerGas: result.maxFeePerGas, maxPriorityFeePerGas: result.maxPriorityFeePerGas }
    : { gasPrice: result.gasPrice };
}

type Config = {
  blocks: number;
  percentile: number;
  accept: {
    standard: number;
    fast: number;
    instant: number;
  };
};
