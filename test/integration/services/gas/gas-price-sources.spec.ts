import ms from 'ms';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { getChainByKey } from '@chains';
import { FetchService } from '@services/fetch/fetch-service';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { AVAILABLE_GAS_SPEEDS, IGasPriceSource, GasSpeed, GasPriceResult } from '@services/gas/types';
import { isEIP1159Compatible } from '@services/gas/utils';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean-gas-price-source';
import { EthGasStationGasPriceSource } from '@services/gas/gas-price-sources/eth-gas-station-gas-price-source';
import { EtherscanGasPriceSource } from '@services/gas/gas-price-sources/etherscan-gas-price-source';
import { RPCGasPriceSource } from '@services/gas/gas-price-sources/rpc-gas-price-source';
import { OwlracleGasPriceSource } from '@services/gas/gas-price-sources/owlracle-gas-price-source';
import { PrioritizedGasPriceSourceCombinator } from '@services/gas/gas-price-sources/prioritized-gas-price-source-combinator';
import { FastestGasPriceSourceCombinator } from '@services/gas/gas-price-sources/fastest-gas-price-source-combinator';
import { PolygonGasStationGasPriceSource } from '@services/gas/gas-price-sources/polygon-gas-station-gas-price-source';

const OPEN_OCEAN_SOURCE = new OpenOceanGasPriceSource(new FetchService(crossFetch));
const ETH_GAS_STATION_SOURCE = new EthGasStationGasPriceSource(new FetchService(crossFetch));
const POLYGON_GAS_STATION_SOURCE = new PolygonGasStationGasPriceSource(new FetchService(crossFetch));
const ETHERSCAN_SOURCE = new EtherscanGasPriceSource(new FetchService(crossFetch));
const OWLRACLE_SOURCE = new OwlracleGasPriceSource(new FetchService(crossFetch), '7d7859c452d5419bae3d7666c8130c96');
const RPC_SOURCE = new RPCGasPriceSource(new PublicRPCsSource());
const PRIORITIZED_GAS_SOURCE = new PrioritizedGasPriceSourceCombinator([OPEN_OCEAN_SOURCE, RPC_SOURCE]);
const FASTEST_GAS_SOURCE = new FastestGasPriceSourceCombinator([OPEN_OCEAN_SOURCE, RPC_SOURCE]);

jest.retryTimes(2);
jest.setTimeout(ms('30s'));

describe('Gas Price Sources', () => {
  gasPriceSourceTest({ title: 'RPC Source', source: RPC_SOURCE });
  gasPriceSourceTest({ title: 'Open Ocean Source', source: OPEN_OCEAN_SOURCE });
  gasPriceSourceTest({ title: 'Owlracle Source', source: OWLRACLE_SOURCE });
  gasPriceSourceTest({ title: 'Prioritized Gas Source', source: PRIORITIZED_GAS_SOURCE });
  gasPriceSourceTest({ title: 'Fastest Gas Source', source: FASTEST_GAS_SOURCE });
  gasPriceSourceTest({ title: 'ETH Gas Station Source', source: ETH_GAS_STATION_SOURCE });
  gasPriceSourceTest({ title: 'Polygon Gas Station Source', source: POLYGON_GAS_STATION_SOURCE });
  gasPriceSourceTest({ title: 'Etherscan Source', source: ETHERSCAN_SOURCE });

  function gasPriceSourceTest<SupportedGasSpeed extends GasSpeed>({
    title,
    source,
  }: {
    title: string;
    source: IGasPriceSource<SupportedGasSpeed>;
  }) {
    describe(title, () => {
      for (const chainIdString in source.supportedSpeeds()) {
        const chainId = Number(chainIdString);
        const chain = getChainByKey(chainId);
        describe(chain?.name ?? `Chain with id ${chainId}`, () => {
          test.concurrent(`Gas prices are valid values`, async () => {
            const supportedSpeeds = source.supportedSpeeds()[chainId];
            const gasPrice = await source.getGasPrice({ chainId });
            for (const speed of AVAILABLE_GAS_SPEEDS) {
              if (isSpeedSupported(speed, supportedSpeeds)) {
                expect(isGasPriceIsSetForSpeed(gasPrice, speed), `${speed} was not set in ${JSON.stringify(gasPrice)}`).to.be.true;
              } else {
                expect(!(speed in gasPrice) || isGasPriceIsSetForSpeed(gasPrice, speed)).to.be.true;
              }
            }
            const unsupportedGasSpeeds = AVAILABLE_GAS_SPEEDS.filter((speed) => !isSpeedSupported(speed, supportedSpeeds));
            for (const speed of unsupportedGasSpeeds) {
              expect(gasPrice).to.not.have.property(speed);
            }
          });
        });
        function isGasPriceIsSetForSpeed(gasPrice: GasPriceResult<SupportedGasSpeed>, speed: string) {
          if (isEIP1159Compatible(gasPrice)) {
            return (
              typeof (gasPrice as any)[speed]?.maxFeePerGas === 'string' && typeof (gasPrice as any)[speed]?.maxPriorityFeePerGas === 'string'
            );
          } else {
            return typeof (gasPrice as any)[speed]?.gasPrice === 'string';
          }
        }
        function isSpeedSupported(speed: GasSpeed, supported: ('standard' | SupportedGasSpeed)[]): speed is SupportedGasSpeed {
          if (supported.includes(speed as SupportedGasSpeed)) {
            return true;
          }
          return false;
        }
      }
    });
  }
});
