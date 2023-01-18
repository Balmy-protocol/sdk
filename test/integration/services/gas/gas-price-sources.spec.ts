import ms from 'ms';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { BigNumber } from 'ethers';
import { Chains } from '@chains';
import { FetchService } from '@services/fetch/fetch-service';
import { PublicProvidersSource } from '@services/providers/provider-sources/public-providers';
import { GasSpeed, AVAILABLE_GAS_SPEEDS, IGasPriceSource } from '@services/gas/types';
import { isEIP1159Compatible } from '@services/gas/utils';
import { OpenOceanGasPriceSource } from '@services/gas/gas-price-sources/open-ocean';
import { ProviderGasPriceSource } from '@services/gas/gas-price-sources/provider';

const OPEN_OCEAN_SOURCE = new OpenOceanGasPriceSource(new FetchService(crossFetch));
const PROVIDER_SOURCE = new ProviderGasPriceSource(new PublicProvidersSource());

jest.retryTimes(2);
jest.setTimeout(ms('30s'));

describe('Gas Price Sources', () => {
  gasPriceSourceTest({ title: 'Provider Source', source: PROVIDER_SOURCE });
  gasPriceSourceTest({ title: 'Open Ocean Source', source: OPEN_OCEAN_SOURCE });

  function gasPriceSourceTest<SupportedGasSpeed extends GasSpeed>({
    title,
    source,
  }: {
    title: string;
    source: IGasPriceSource<SupportedGasSpeed>;
  }) {
    describe(title, () => {
      for (const chainId of source.supportedChains()) {
        const chain = Chains.byKey(chainId);
        describe(chain?.name ?? `Chain with id ${chainId}`, () => {
          test.concurrent(`Gas prices are valid values`, async () => {
            const gasPrice = await source.getGasPrice(chainId);
            for (const speed of source.supportedSpeeds()) {
              if (isEIP1159Compatible(gasPrice)) {
                expect(BigNumber.isBigNumber(gasPrice[speed].maxFeePerGas)).to.be.true;
                expect(BigNumber.isBigNumber(gasPrice[speed].maxPriorityFeePerGas)).to.be.true;
              } else {
                expect(BigNumber.isBigNumber(gasPrice[speed].gasPrice)).to.be.true;
              }
            }
            const unsupportedGasSpeeds = AVAILABLE_GAS_SPEEDS.filter((speed) => !source.supportedSpeeds().includes(speed as any));
            for (const speed of unsupportedGasSpeeds) {
              expect(gasPrice).to.not.have.property(speed);
            }
          });
        });
      }
    });
  }
});
