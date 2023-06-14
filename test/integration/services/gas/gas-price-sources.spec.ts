import ms from 'ms';
import { expect } from 'chai';
import { getChainByKey } from '@chains';
import { FetchService } from '@services/fetch/fetch-service';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { AVAILABLE_GAS_SPEEDS, IGasPriceSource, GasPriceResult } from '@services/gas/types';
import { isEIP1159Compatible } from '@services/gas/utils';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean-gas-price-source';
import { EthGasStationGasPriceSource } from '@services/gas/gas-price-sources/eth-gas-station-gas-price-source';
import { EtherscanGasPriceSource } from '@services/gas/gas-price-sources/etherscan-gas-price-source';
import { RPCGasPriceSource } from '@services/gas/gas-price-sources/rpc-gas-price-source';
import { OwlracleGasPriceSource } from '@services/gas/gas-price-sources/owlracle-gas-price-source';
import { PrioritizedGasPriceSourceCombinator } from '@services/gas/gas-price-sources/prioritized-gas-price-source-combinator';
import { FastestGasPriceSourceCombinator } from '@services/gas/gas-price-sources/fastest-gas-price-source-combinator';
import { PolygonGasStationGasPriceSource } from '@services/gas/gas-price-sources/polygon-gas-station-gas-price-source';
import { AggregatorGasPriceSource } from '@services/gas/gas-price-sources/aggregator-gas-price-source';
import { ParaswapGasPriceSource } from '@services/gas/gas-price-sources/paraswap-gas-price-source';
import { ChangellyGasPriceSource } from '@services/gas/gas-price-sources/changelly-gas-price-source';
import { ProviderService } from '@services/providers/provider-service';
import { CHAINS_WITH_KNOWN_ISSUES } from '@test-utils/other';

const FETCH_SERVICE = new FetchService();
const OPEN_OCEAN_SOURCE = new OpenOceanGasPriceSource(FETCH_SERVICE);
const PARASWAP_SOURCE = new ParaswapGasPriceSource(FETCH_SERVICE);
const POLYGON_GAS_STATION_SOURCE = new PolygonGasStationGasPriceSource(FETCH_SERVICE);
const ETHERSCAN_SOURCE = new EtherscanGasPriceSource(FETCH_SERVICE);
const RPC_SOURCE = new RPCGasPriceSource(new ProviderService(new PublicRPCsSource({ config: { ethers: { quorum: 1 } } })));
const PRIORITIZED_GAS_SOURCE = new PrioritizedGasPriceSourceCombinator([OPEN_OCEAN_SOURCE, RPC_SOURCE]);
const FASTEST_GAS_SOURCE = new FastestGasPriceSourceCombinator([OPEN_OCEAN_SOURCE, RPC_SOURCE]);
const AGGREGATOR_GAS_SOURCE = new AggregatorGasPriceSource([OPEN_OCEAN_SOURCE, RPC_SOURCE], 'median');
const ETH_GAS_STATION_SOURCE = new EthGasStationGasPriceSource(FETCH_SERVICE);
const OWLRACLE_SOURCE = new OwlracleGasPriceSource(FETCH_SERVICE, '7d7859c452d5419bae3d7666c8130c96');
const CHANGELLY_GAS_SOURCE = new ChangellyGasPriceSource(FETCH_SERVICE, process.env.CHANGELLY_API_KEY!);

jest.retryTimes(2);
jest.setTimeout(ms('30s'));

describe('Gas Price Sources', () => {
  gasPriceSourceTest({ title: 'RPC Source', source: RPC_SOURCE });
  gasPriceSourceTest({ title: 'Open Ocean Source', source: OPEN_OCEAN_SOURCE });
  // gasPriceSourceTest({ title: 'Owlracle Source', source: OWLRACLE_SOURCE }); We comment this out because of rate limiting
  gasPriceSourceTest({ title: 'Prioritized Gas Source', source: PRIORITIZED_GAS_SOURCE });
  gasPriceSourceTest({ title: 'Fastest Gas Source', source: FASTEST_GAS_SOURCE });
  // gasPriceSourceTest({ title: 'ETH Gas Station Source', source: ETH_GAS_STATION_SOURCE }); We comment this out because the API is quite flaky
  gasPriceSourceTest({ title: 'Polygon Gas Station Source', source: POLYGON_GAS_STATION_SOURCE });
  gasPriceSourceTest({ title: 'Etherscan Source', source: ETHERSCAN_SOURCE });
  gasPriceSourceTest({ title: 'Aggregator Source', source: AGGREGATOR_GAS_SOURCE });
  gasPriceSourceTest({ title: 'Paraswap Source', source: PARASWAP_SOURCE });
  // gasPriceSourceTest({ title: 'Changelly Source', source: CHANGELLY_GAS_SOURCE }); We comment this out because we need an API key

  function gasPriceSourceTest({ title, source }: { title: string; source: IGasPriceSource<object> }) {
    describe(title, () => {
      for (const chainIdString in source.supportedSpeeds()) {
        const chainId = Number(chainIdString);
        if (CHAINS_WITH_KNOWN_ISSUES.includes(chainId)) continue;
        const chain = getChainByKey(chainId);
        describe(chain?.name ?? `Chain with id ${chainId}`, () => {
          test.concurrent(`Gas prices are valid values`, async () => {
            const supportedSpeeds = source.supportedSpeeds()[chainId];
            const gasPrice = await source.getGasPrice({ chainId });
            for (const speed of AVAILABLE_GAS_SPEEDS) {
              const expected = speed in supportedSpeeds ? (supportedSpeeds as any)[speed] : 'missing';
              if (expected === 'present') {
                expect(isGasPriceIsSetForSpeed(gasPrice, speed), `${speed} was not set in ${JSON.stringify(gasPrice)}`).to.be.true;
              } else if (expected === 'optional') {
                expect(!(speed in gasPrice) || isGasPriceIsSetForSpeed(gasPrice, speed)).to.be.true;
              } else {
                expect(gasPrice).to.not.have.property(speed);
              }
            }
          });
        });
        function isGasPriceIsSetForSpeed(gasPrice: GasPriceResult<object>, speed: string) {
          if (isEIP1159Compatible(gasPrice)) {
            return (
              typeof (gasPrice as any)[speed]?.maxFeePerGas === 'string' && typeof (gasPrice as any)[speed]?.maxPriorityFeePerGas === 'string'
            );
          } else {
            return typeof (gasPrice as any)[speed]?.gasPrice === 'string';
          }
        }
      }
    });
  }
});
