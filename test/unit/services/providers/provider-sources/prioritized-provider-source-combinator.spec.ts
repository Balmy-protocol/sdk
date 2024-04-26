import { expect } from 'chai';
import { http } from 'viem';
import { Chains } from '@chains';
import { then, when } from '@test-utils/bdd';
import { PrioritizedProviderSourceCombinator } from '@services/providers/provider-sources/prioritized-provider-source-combinator';
import { IProviderSource } from '@services/providers/types';

const PROVIDER_1 = http();
const PROVIDER_2 = http();
const FULL_SUPPORT = { ethers: true, viem: true };

describe('Prioritized Provider Source Combinator', () => {
  const source1: IProviderSource = {
    supportedChains: () => [Chains.POLYGON.chainId],
    getViemTransport: () => PROVIDER_1,
  };
  const source2: IProviderSource = {
    supportedChains: () => [Chains.POLYGON.chainId, Chains.ETHEREUM.chainId],
    getViemTransport: () => PROVIDER_2,
  };
  const fallbackSource = new PrioritizedProviderSourceCombinator([source1, source2]);

  when('asking for supported chains', () => {
    then('the union of the given sources is returned', () => {
      const supportedChains = fallbackSource.supportedChains();
      expect(supportedChains).to.eql([Chains.POLYGON.chainId, Chains.ETHEREUM.chainId]);
    });
  });

  when('asking for a chain supported by source1', () => {
    then('provider1 is returned', () => {
      expect(fallbackSource.getViemTransport({ chainId: Chains.POLYGON.chainId })).to.equal(PROVIDER_1);
    });
  });

  when('asking for a chain not supported by source1', () => {
    then('provider2 is returned', () => {
      expect(fallbackSource.getViemTransport({ chainId: Chains.ETHEREUM.chainId })).to.equal(PROVIDER_2);
    });
  });

  when('asking for a chain not supported by any source', () => {
    then('an error is thrown', () => {
      expect(() => fallbackSource.getViemTransport({ chainId: Chains.OPTIMISM.chainId })).to.throw(
        `Chain with id ${Chains.OPTIMISM.chainId} not supported`
      );
    });
  });
});
