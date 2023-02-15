import { expect } from 'chai';
import { BaseProvider, JsonRpcProvider } from '@ethersproject/providers';
import { given, then, when } from '@test-utils/bdd';
import { UpdatableEthersProviderSource } from '@services/providers/provider-sources/updatable-ethers-provider';

describe('Updatable Ethers Provider', () => {
  when('provider is undefined', () => {
    const source = new UpdatableEthersProviderSource(() => undefined);
    then('there are no supported chains', () => {
      expect(source.supportedChains()).to.have.lengthOf(0);
    });
    then('asking for a provider would fail', () => {
      expect(() => source.getProvider({ chainId: 0 })).to.throw('Provider is not set or it does not support the chain 0');
    });
  });

  when('provider is updated', () => {
    let provider: BaseProvider | undefined = undefined;
    const source = new UpdatableEthersProviderSource(() => provider);
    given(() => {
      provider = new JsonRpcProvider('', 10);
    });
    then('it is reported correctly', () => {
      expect(source.supportedChains()).to.eql([10]);
      expect(source.getProvider({ chainId: 10 })).to.equal(provider);
    });
  });
});
