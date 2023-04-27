import { expect } from 'chai';
import { http } from 'viem';
import { JsonRpcProvider } from '@ethersproject/providers';
import { given, then, when } from '@test-utils/bdd';
import { UpdatableProviderSource } from '@services/providers/provider-sources/updatable-provider';
import { IProviderSource } from '@services/providers';

describe('Updatable Provider', () => {
  when('provider is undefined', () => {
    const source = new UpdatableProviderSource(() => undefined);
    then('there are no supported chains', () => {
      expect(source.supportedClients()).to.be.empty;
    });
    then('asking for a provider would fail', () => {
      expect(() => source.getEthersProvider({ chainId: 0 })).to.throw('Provider is not set yet');
    });
  });

  when('provider is updated', () => {
    let provider: IProviderSource | undefined = undefined;
    const source = new UpdatableProviderSource(() => provider);
    given(() => {
      provider = CUSTOM_PROVIDER_SOURCE;
    });
    then('it is reported correctly', () => {
      expect(source.supportedClients()).to.eql({ [10]: { ethers: true, viem: true } });
      expect(source.getEthersProvider({ chainId: 10 })).to.equal(ETHERS_PROVIDER);
    });
  });
});

const ETHERS_PROVIDER = new JsonRpcProvider('', 10);
const CUSTOM_PROVIDER_SOURCE: IProviderSource = {
  supportedClients: () => ({ [10]: { ethers: true, viem: true } }),
  getEthersProvider: () => ETHERS_PROVIDER,
  getViemTransport: () => http(),
};
