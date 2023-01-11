import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Networks } from '@networks';
import { then, when } from '@test-utils/bdd';
import { FallbackWhenNetworkNotSupportedProviderSource } from '@services/providers/provider-sources/fallback-when-network-not-supported-provider';
import { IProviderSource } from '@services/providers/types';

const PROVIDER_1 = new JsonRpcProvider();
const PROVIDER_2 = new JsonRpcProvider();

describe('Fallback When Network Not Supported Provider', () => {
  const source1: IProviderSource = {
    supportedNetworks: () => [Networks.POLYGON],
    getProvider: () => PROVIDER_1,
  };
  const source2: IProviderSource = {
    supportedNetworks: () => [Networks.POLYGON, Networks.ETHEREUM],
    getProvider: () => PROVIDER_2,
  };
  const fallbackSource = new FallbackWhenNetworkNotSupportedProviderSource([source1, source2]);

  when('asking for supported networks', () => {
    then('the union of the given sources is returned', () => {
      const supportedNetworks = fallbackSource.supportedNetworks();
      expect(supportedNetworks).to.have.lengthOf(2);
      expect(supportedNetworks).to.include(Networks.POLYGON);
      expect(supportedNetworks).to.include(Networks.ETHEREUM);
    });
  });

  when('asking for a network supported by source1', () => {
    then('provider1 is returned', () => {
      expect(fallbackSource.getProvider(Networks.POLYGON)).to.equal(PROVIDER_1);
    });
  });

  when('asking for a network not supported by source1', () => {
    then('provider2 is returned', () => {
      expect(fallbackSource.getProvider(Networks.ETHEREUM)).to.equal(PROVIDER_2);
    });
  });

  when('asking for a network not supported by any source', () => {
    then('an error is thrown', () => {
      expect(() => fallbackSource.getProvider(Networks.OPTIMISM)).to.throw(`Network Optimism not supported`);
    });
  });
});
