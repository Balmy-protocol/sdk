import { ChainId } from '@types';
import { IGasPriceSource, GasSpeed, GasPrice } from '@services/gas/types';
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
type GasSpeedSupport = { standard: 'present'; fast: 'present'; instant: 'present' };
export class OwlracleGasPriceSource implements IGasPriceSource<GasSpeedSupport> {
  private readonly config: Config;

  constructor(private readonly fetchService: IFetchService, private readonly apiKey: string, config?: Partial<Config>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  supportedSpeeds(): GasSpeedSupport {
    return { standard: 'present', fast: 'present', instant: 'present' };
  }

  supportedChains(): ChainId[] {
    return Object.keys(CHAINS).map(Number);
  }

  async getGasPrice({ chainId }: { chainId: ChainId }) {
    const key = CHAINS[chainId];
    const accept = [this.config.accept.standard, this.config.accept.fast, this.config.accept.instant].join(',');
    const response = await this.fetchService.fetch(
      `https://api.owlracle.info/v3/${key}/gas` +
        `?apikey=${this.apiKey}` +
        `&reportwei=true` +
        `&feeinusd=false` +
        `&accept=${accept}` +
        `&percentile=${this.config.percentile}` +
        `&blocks=${this.config.blocks}`
    );
    const { speeds }: { speeds: GasPrice[] } = await response.json();
    const [standard, fast, instant] = speeds;
    return {
      standard,
      fast,
      instant,
    };
  }
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
