import chai, { expect } from 'chai';
import { Chains } from '@chains';
import { then, when } from '@test-utils/bdd';
import { BaseToken, ITokenSource, MergeTokenTokensFromSources, PropertiesRecord } from '@services/tokens/types';
import { Chain, ChainId, TimeString, TokenAddress } from '@types';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import ms from 'ms';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

const TOKEN_A = {
  address: '0x0000000000000000000000000000000000000001',
  symbol: 'TKNA',
  decimals: 18,
};

const TOKEN_A_WITH_EXTRA = {
  ...TOKEN_A,
  extra: 'extra',
};

const TOKEN_B = {
  address: '0x0000000000000000000000000000000000000002',
  symbol: 'TKNB',
  decimals: 18,
};

describe('Fallback Token Source', () => {
  when('source with all properties resolves', () => {
    then('fallback resolves even if other sources are pending', async () => {
      const { source: source1 } = source(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = sourceWithExtra(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A_WITH_EXTRA } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('the only source with all properties resolves but extra properties are missing', () => {
    then('fallback still resolves', async () => {
      const { source: source1 } = source(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = sourceWithExtra(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('one source with all properties resolves but extra properties are missing', () => {
    then('fallback waits for other sources with all properties', async () => {
      const { source: source1, promise: source1Promise } = sourceWithExtra(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = sourceWithExtra(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };
      const resultWithProperties = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A_WITH_EXTRA } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(resultWithProperties);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(resultWithProperties);
    });
  });

  when('all sources with extra properties resolved without these properties', () => {
    then('fallback still resolves', async () => {
      const { source: source1, promise: source1Promise } = sourceWithExtra(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = sourceWithExtra(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('the only source with all properties resolves but there are some missing tokens', () => {
    then('fallback waits for other source without extra properties', async () => {
      const { source: source1, promise: source1Promise } = sourceWithExtra(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = source(Chains.POLYGON);
      const resultWithA = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };
      const resultWithB = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A, [TOKEN_B.address]: TOKEN_B } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address, TOKEN_B.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(resultWithA);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(resultWithB);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(resultWithB);
    });
  });

  when('the source with all properties does not support the chain', () => {
    then('fallback resolves with the source without properties', async () => {
      const { source: source1 } = sourceWithExtra(Chains.ETHEREUM);
      const { source: source2, promise: source2Promise } = source(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('the source without all properties resolves', () => {
    then('fallback waits for the one with all the properties to resolve', async () => {
      const { source: source1, promise: source1Promise } = sourceWithExtra(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = source(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('the source without all properties resolves', () => {
    then('fallback waits for the one with all the properties to reject', async () => {
      const { source: source1, promise: source1Promise } = sourceWithExtra(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = source(Chains.POLYGON);
      const result = { [Chains.POLYGON.chainId]: { [TOKEN_A.address]: TOKEN_A } };

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('all sources fail', () => {
    then('fallback rejects', async () => {
      const { source: source1, promise: source1Promise } = sourceWithExtra(Chains.POLYGON);
      const { source: source2, promise: source2Promise } = source(Chains.POLYGON);

      const promise = getTokensFromSources({ [Chains.POLYGON.chainId]: [TOKEN_A.address] }, source1, source2);
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.reject();
      await sleep('10');
      expect(promise.status).to.equal('rejected');
      expect(promise.result).to.have.rejected;
    });
  });

  function source(...chains: Chain[]) {
    return buildSource<BaseToken>({
      chains,
    });
  }

  function sourceWithExtra(...chains: Chain[]) {
    return buildSource<TokenWithExtra>({
      chains,
      properties: {
        extra: 'optional',
      },
    });
  }

  function getTokensFromSources<Sources extends ITokenSource<BaseToken>[]>(addresses: Record<ChainId, TokenAddress[]>, ...sources: Sources) {
    const result = new FallbackTokenSource(sources).getTokens(addresses);
    const promiseWithState: PromiseWithState<Record<ChainId, Record<TokenAddress, MergeTokenTokensFromSources<Sources>>>> = {
      result,
      status: 'pending',
    };
    result.then(() => (promiseWithState.status = 'resolved')).catch(() => (promiseWithState.status = 'rejected'));
    return promiseWithState;
  }

  function promise<T>(): PromiseWithTriggers<T> {
    let resolveExternal: (value: T) => void, rejectExternal: (error?: any) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolveExternal = resolve;
      rejectExternal = reject;
    });
    // @ts-ignore
    return Object.assign(promise, { resolve: resolveExternal, reject: rejectExternal });
  }

  function buildSource<Token extends BaseToken>({
    chains,
    properties,
  }: {
    chains: Chain[];
    properties?: Omit<PropertiesRecord<Token>, keyof BaseToken>;
  }): { source: ITokenSource<Token>; promise: PromiseWithTriggers<Record<ChainId, Record<TokenAddress, Token>>> } {
    const sourcePromise = promise<Record<ChainId, Record<TokenAddress, Token>>>();
    const source: ITokenSource<Token> = {
      supportedChains: () => chains.map(({ chainId }) => chainId),
      getTokens: () => sourcePromise,
      tokenProperties: () => {
        return {
          address: 'present',
          decimals: 'present',
          symbol: 'present',
          ...properties,
        } as PropertiesRecord<Token>;
      },
    };
    return { source, promise: sourcePromise };
  }
});

function sleep(time: TimeString) {
  return new Promise((resolve) => setTimeout(resolve, ms(time)));
}

type TokenWithExtra = BaseToken & { extra?: string };
type PromiseWithTriggers<T> = Promise<T> & { resolve: (value: T) => void; reject: (error?: any) => void };
type PromiseWithState<T> = { status: 'pending' | 'resolved' | 'rejected'; result: Promise<T> };
