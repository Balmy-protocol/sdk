import chai, { expect } from 'chai';
import { Chains } from '@chains';
import { then, when } from '@test-utils/bdd';
import { ChainId, FieldRequirementOptions } from '@types';
import chaiAsPromised from 'chai-as-promised';
import { FastestGasPriceSourceCombinator } from '@services/gas/gas-price-sources/fastest-gas-price-source-combinator';
import { GasPriceResult, IGasPriceSource, GasSpeed } from '@services/gas/types';
import { wait } from '@shared/utils';
chai.use(chaiAsPromised);

describe('Fastest Gas Price Source Combinator', () => {
  const CHAIN_ID = Chains.ETHEREUM.chainId;
  const LEGACY = (amount: number) => ({ gasPrice: amount.toString() });

  when('trying to create without sources', () => {
    then('an error is thrown', () => {
      expect(() => new FastestGasPriceSourceCombinator([])).to.throw('No sources were specified');
    });
  });

  when('there are no sources for chain', () => {
    then('error is thrown', async () => {
      const { source: source1 } = source('standard', 'fast');
      const promise = getGasPriceFromSources({ requirements: {}, sources: [source1], chainId: 10 });
      await expect(promise.result).to.eventually.be.rejectedWith(`Chain with id 10 cannot support the given requirements`);
    });
  });

  when('there are no sources that meet requirements', () => {
    then('error is thrown', async () => {
      const { source: source1 } = source('standard', 'fast');
      const promise = getGasPriceFromSources({ requirements: { instant: 'required' }, sources: [source1] });
      await expect(promise.result).to.eventually.be.rejectedWith(`Chain with id 1 cannot support the given requirements`);
    });
  });

  when('all sources fail', () => {
    then('error is thrown', async () => {
      const { source: source1, promise: source1Promise } = source('standard', 'fast');

      const promise = getGasPriceFromSources({ requirements: { fast: 'required' }, sources: [source1] });
      source1Promise.reject();
      await expect(promise.result).to.eventually.be.rejectedWith('All promises were rejected');
    });
  });

  when('fastest source fails', () => {
    then('second one is returned', async () => {
      const { source: source1, promise: source1Promise } = source('standard');
      const { source: source2, promise: source2Promise } = source('standard', 'fast');

      const source2Result = { standard: LEGACY(10), fast: LEGACY(10) };

      const promise = getGasPriceFromSources({ requirements: {}, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      // First one fails
      source1Promise.reject();
      await wait(10);
      expect(promise.status).to.equal('pending');
      // Second one works
      source2Promise.resolve(source2Result);
      await wait(10);
      expect(promise.status).to.equal('resolved');
      // Returns second source's result
      expect(await promise.result).to.deep.equal(source2Result);
    });
  });

  when('fastest does not meet requirements', () => {
    then('second one is returned', async () => {
      const { source: source1, promise: source1Promise } = source('standard', 'fast');
      const { source: source2, promise: source2Promise } = source('standard', 'fast');

      const source1Result = { standard: LEGACY(10) };
      const source2Result = { standard: LEGACY(10), fast: LEGACY(10) };

      const promise = getGasPriceFromSources({ requirements: { fast: 'required' }, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      // First one resolves, and does not meet
      source1Promise.resolve(source1Result);
      await wait(10);
      // First one does not meet requirements, so we still wait
      expect(promise.status).to.equal('pending');
      // Second one resolves ok
      source2Promise.resolve(source2Result);
      await wait(10);
      expect(promise.status).to.equal('resolved');
      // Returns second source's result
      expect(await promise.result).to.deep.equal(source2Result);
    });
  });

  when('fastest one returns ok', () => {
    then('there is no need to wait for second one', async () => {
      const { source: source1, promise: source1Promise } = source('standard');
      const { source: source2, promise: source2Promise } = source('standard', 'fast');

      const source1Result = { standard: LEGACY(10) };

      const promise = getGasPriceFromSources({ requirements: {}, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      // First one resolves
      source1Promise.resolve(source1Result);
      await wait(10);
      expect(promise.status).to.equal('resolved');
      // Returns first source's result
      expect(await promise.result).to.deep.equal(source1Result);
      source2Promise.reject();
    });
  });

  function getGasPriceFromSources<Sources extends IGasPriceSource<any>[] | []>({
    requirements,
    sources,
    chainId,
  }: {
    requirements: Record<string, FieldRequirementOptions>;
    sources: Sources;
    chainId?: ChainId;
  }) {
    const result = new FastestGasPriceSourceCombinator(sources).getGasPrice({
      chainId: chainId ?? CHAIN_ID,
      config: { fields: { requirements: requirements as any } },
    });
    const promiseWithState: PromiseWithState<GasPriceResult<any>> = {
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

  function source(...speeds: GasSpeed[]): { source: IGasPriceSource<any>; promise: PromiseWithTriggers<GasPriceResult<any>> } {
    const support: Record<string, 'optional'> = Object.fromEntries(speeds.map((speed) => [speed, 'optional']));
    const sourcePromise = promise<GasPriceResult<any>>();
    const source: IGasPriceSource<any> = {
      getGasPrice: () => sourcePromise as any,
      supportedSpeeds: () => ({ [CHAIN_ID]: support }),
    };
    return { source, promise: sourcePromise };
  }
});

type PromiseWithTriggers<T> = Promise<T> & { resolve: (value: T) => void; reject: (error?: any) => void };
type PromiseWithState<T> = { status: 'pending' | 'resolved' | 'rejected'; result: Promise<T> };
