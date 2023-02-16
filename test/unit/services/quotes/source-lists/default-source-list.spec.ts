import chai, { expect } from 'chai';
import { then, when } from '@test-utils/bdd';
import { DefaultSourceList } from '@services/quotes/source-lists/default-source-list';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import crossFetch from 'cross-fetch';
import { FetchService } from '@services/fetch/fetch-service';
import { DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { TokenService } from '@services/tokens/token-service';
import { GasSpeed, IGasService } from '@services/gas/types';
import { TransactionRequest } from '@ethersproject/providers';
import { BigNumberish } from 'ethers';
import { ChainId } from '@types';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

const PROVIDER_SOURCE = new PublicRPCsSource();
const FETCH_SERVICE = new FetchService(crossFetch);
const TOKEN_SERVICE = new TokenService(new DefiLlamaTokenSource(FETCH_SERVICE));
const FAILING_GAS_SERVICE: IGasService = {
  supportedChains: () => [1, 2, 3],
  estimateGas: (_: { chainId: ChainId; tx: TransactionRequest }) => Promise.reject(new Error('Fail')),
  getGasPrice: (_: { chainId: ChainId; options?: { speed?: GasSpeed } }) => Promise.reject(new Error('Fail')),
  calculateGasCost: (_: { chainId: ChainId; gasEstimation: BigNumberish; tx?: TransactionRequest; options?: { speed?: GasSpeed } }) =>
    Promise.reject(new Error('Fail')),
  getQuickGasCalculator: (_: { chainId: ChainId }) => Promise.reject(new Error('Fail')),
};

describe('Default Source List', () => {
  when('no valid sources are passed', () => {
    const sourceList = new DefaultSourceList({
      providerSource: PROVIDER_SOURCE,
      fetchService: FETCH_SERVICE,
      tokenService: TOKEN_SERVICE,
      gasService: FAILING_GAS_SERVICE,
      config: undefined,
    });
    then('empty response is returned', async () => {
      expect(
        await sourceList.getAllQuotes({
          chainId: 1,
          sellToken: 'sellToken',
          buyToken: 'buyToken',
          order: { type: 'sell', sellAmount: 1000 },
          slippagePercentage: 1,
          takerAddress: 'takerAddress',
          sourceIds: ['source1', 'source2'],
        })
      ).to.have.lengthOf(0);
    });
  });

  when('gas price service fails', () => {
    const sourceList = new DefaultSourceList({
      providerSource: PROVIDER_SOURCE,
      fetchService: FETCH_SERVICE,
      tokenService: TOKEN_SERVICE,
      gasService: FAILING_GAS_SERVICE,
      config: undefined,
    });
    then('rejection is handled', async () => {
      const quotes = await sourceList.getAllQuotes({
        chainId: 1,
        sellToken: 'sellToken',
        buyToken: 'buyToken',
        order: { type: 'sell', sellAmount: 1000 },
        slippagePercentage: 1,
        takerAddress: 'takerAddress',
        sourceIds: ['open-ocean'],
      });
      expect(quotes).to.have.lengthOf(1);
      expect(quotes[0]).to.contain({ error: 'Fail', failed: true, name: 'Open Ocean' });
    });
  });
});
