import chai, { expect } from 'chai';
import { then, when } from '@test-utils/bdd';
import { ChainId, TokenAddress } from '@types';
import chaiAsPromised from 'chai-as-promised';
import { IPriceSource, PriceResult } from '@services/prices';
import { PrioritizedPriceSource } from '@services/prices/price-sources/prioritized-price-source';
chai.use(chaiAsPromised);

const TOKEN_A = '0x0000000000000000000000000000000000000001';
const TOKEN_B = '0x0000000000000000000000000000000000000002';

describe('Prioritized Price Source', () => {
  when('source is created empty', () => {
    then('prioritized source fails', () => {
      expect(() => new PrioritizedPriceSource([])).to.throw('No sources were specified');
    });
  });

  when('one of the given chains is not supported by any source', () => {
    then('prioritized source fails', async () => {
      const { source: source1 } = source({ chains: [1] });
      const promise = getPrices({ addresses: { [2]: [TOKEN_A] }, sources: [source1] });
      await expect(promise.result).to.to.eventually.be.rejectedWith(`Current price sources can't support all the given chains`);
      expect(promise.status).to.equal('rejected');
    });
  });

  when('second source resolves', () => {
    then('prioritized source waits for the first one', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2, promise: source2Promise } = source({ chains: [1] });
      const result1 = { [1]: { [TOKEN_A]: { price: 10, closestTimestamp: 0 } } };
      const result2 = { [1]: { [TOKEN_A]: { price: 20, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result1);
    });
  });

  when('first one resolves and result is fulfilled', () => {
    then('resolves without waiting for second one', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2 } = source({ chains: [1] });
      const result1 = { [1]: { [TOKEN_A]: { price: 10, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result1);
    });
  });

  when('first one resolves but result is not fulfilled', () => {
    then('waits for the second one', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2, promise: source2Promise } = source({ chains: [1] });
      const result1 = { [1]: { [TOKEN_A]: { price: 10, closestTimestamp: 0 } } };
      const result2 = { [1]: { [TOKEN_B]: { price: 20, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A, TOKEN_B] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await wait();
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal({
        [1]: { [TOKEN_A]: { price: 10, closestTimestamp: 0 }, [TOKEN_B]: { price: 20, closestTimestamp: 0 } },
      });
    });
  });

  when('first one and second dont fulfil the request', () => {
    then('result it is returned anyways', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2, promise: source2Promise } = source({ chains: [1] });
      const result1 = { [1]: { [TOKEN_A]: { price: 10, closestTimestamp: 0 } } };
      const result2 = { [1]: { [TOKEN_A]: { price: 20, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A, TOKEN_B] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await wait();
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result1);
    });
  });

  when('first one fails', () => {
    then('second one is returned', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2, promise: source2Promise } = source({ chains: [1] });
      const result = { [1]: { [TOKEN_A]: { price: 20, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await wait();
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('first one is in another chain', () => {
    then('second result is returned', async () => {
      const { source: source1 } = source({ chains: [2] });
      const { source: source2, promise: source2Promise } = source({ chains: [1] });
      const result = { [1]: { [TOKEN_A]: { price: 20, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('asking for multiple chains', () => {
    then('results are combined', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2, promise: source2Promise } = source({ chains: [2] });
      const result1 = { [1]: { [TOKEN_A]: { price: 20, closestTimestamp: 0 } } };
      const result2 = { [2]: { [TOKEN_B]: { price: 10, closestTimestamp: 0 } } };

      const promise = getPrices({ addresses: { [1]: [TOKEN_A], [2]: [TOKEN_B] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await wait();
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal({ ...result1, ...result2 });
    });
  });

  when('all sources fail', () => {
    then('an empty result is returned', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1] });
      const { source: source2, promise: source2Promise } = source({ chains: [1] });

      const promise = getPrices({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      await wait();
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      source2Promise.reject();
      await wait();
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal({});
    });
  });
});
function getPrices({ addresses, sources }: { addresses: Record<ChainId, TokenAddress[]>; sources: IPriceSource[] }) {
  const tokens = Object.entries(addresses).flatMap(([chainIdString, tokens]) =>
    tokens.map((token) => ({ chainId: Number(chainIdString), token }))
  );
  const result = new PrioritizedPriceSource(sources).getCurrentPrices({ tokens });
  const promiseWithState: PromiseWithState<Awaited<typeof result>> = {
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

function source({ chains }: { chains: ChainId[] }): {
  source: IPriceSource;
  promise: PromiseWithTriggers<Record<ChainId, Record<TokenAddress, PriceResult>>>;
} {
  const sourcePromise = promise<Record<ChainId, Record<TokenAddress, PriceResult>>>();
  const source: IPriceSource = {
    getCurrentPrices: () => sourcePromise,
    getHistoricalPrices: () => Promise.reject('Not supported'),
    getBulkHistoricalPrices: () => Promise.reject('Not supported'),
    getChart: () => Promise.reject('Not supported'),
    supportedQueries: () =>
      Object.fromEntries(
        chains.map((chainId) => [
          chainId,
          { getHistoricalPrices: false, getCurrentPrices: true, getBulkHistoricalPrices: false, getChart: false },
        ])
      ),
  };
  return { source, promise: sourcePromise };
}

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

type PromiseWithTriggers<T> = Promise<T> & { resolve: (value: T) => void; reject: (error?: any) => void };
type PromiseWithState<T> = { status: 'pending' | 'resolved' | 'rejected'; result: Promise<T> };
