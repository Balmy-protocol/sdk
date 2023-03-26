import chai, { expect } from 'chai';
import { then, when } from '@test-utils/bdd';
import { IMetadataSource, MergeMetadata, MetadataResult } from '@services/metadata/types';
import { ChainId, FieldsRequirements, SupportInChain, TimeString, TokenAddress } from '@types';
import { FallbackMetadataSource } from '@services/metadata/metadata-sources/fallback-metadata-source';
import ms from 'ms';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

const TOKEN_A = '0x0000000000000000000000000000000000000001';
const TOKEN_B = '0x0000000000000000000000000000000000000002';

describe('Fallback Token Source', () => {
  when('one of the given chains is not supported by any source', () => {
    then('fallback fails', async () => {
      const { source: source1 } = source({ chains: [1], properties: { decimals: 'present' } });
      const promise = getMetadata({ addresses: { [2]: [TOKEN_A] }, sources: [source1] });
      await expect(promise.result).to.to.eventually.be.rejectedWith(`Couldn't find sources that supported the given chains`);
      expect(promise.status).to.equal('rejected');
    });
  });

  when('only source on chain resolves', () => {
    then('fallback resolves', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'present' } });
      const { source: source2 } = source({ chains: [2], properties: { decimals: 'present' } });
      const result = { [1]: { [TOKEN_A]: metadataWith('decimals') } };

      const promise = getMetadata({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when('only source on chain fails', () => {
    then('fallback fails', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'present' } });
      const { source: source2 } = source({ chains: [2], properties: { decimals: 'present' } });

      const promise = getMetadata({ addresses: { [1]: [TOKEN_A] }, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await expect(promise.result).to.to.eventually.be.rejectedWith('Could not find metadata for the given addresses');
      expect(promise.status).to.equal('rejected');
    });
  });

  when(`source with 'required' and 'best effort' properties resolves`, () => {
    then(`fallback doesn't wait for other sources with 'can ignore' properties`, async () => {
      const { source: source1, promise: source1Promise } = source({
        chains: [1],
        properties: { decimals: 'present', symbol: 'optional', name: 'optional' },
      });
      const { source: source2 } = source({ chains: [1], properties: { decimals: 'present', symbol: 'optional', name: 'optional' } });
      const result = { [1]: { [TOKEN_A]: metadataWith('decimals', 'symbol') } };

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A] },
        requirements: { decimals: 'required', symbol: 'best effort', name: 'can ignore' },
        sources: [source1, source2],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when(`source with 'required' properties resolves`, () => {
    then(`fallback waits for other sources with 'best effort' properties`, async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'present', symbol: 'optional' } });
      const { source: source2, promise: source2Promise } = source({ chains: [1], properties: { decimals: 'present', symbol: 'optional' } });
      const result1 = { [1]: { [TOKEN_A]: metadataWith('decimals') } };
      const result2 = { [1]: { [TOKEN_A]: metadataWith('decimals', 'symbol') } };

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A] },
        requirements: { decimals: 'required', symbol: 'best effort' },
        sources: [source1, source2],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result2);
    });
  });

  when(`source with all 'required' properties resolves and there are no more sources`, () => {
    then(`fallback resolves even if 'best effort' and 'can ignore' properties are not present`, async () => {
      const { source: source1, promise: source1Promise } = source({
        chains: [1],
        properties: { decimals: 'present', symbol: 'optional', name: 'optional' },
      });
      const result = { [1]: { [TOKEN_A]: metadataWith('decimals') } };

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A] },
        requirements: { decimals: 'required', symbol: 'best effort', name: 'can ignore' },
        sources: [source1],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result);
    });
  });

  when(`source with 'required' and 'best effort' properties resolves but a token's metadata is missing`, () => {
    then(`fallback waits for other sources`, async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'present', symbol: 'optional' } });
      const { source: source2, promise: source2Promise } = source({ chains: [1], properties: { decimals: 'present', symbol: 'optional' } });
      const result1 = { [1]: { [TOKEN_A]: metadataWith('decimals', 'symbol') } };
      const result2 = { [1]: { [TOKEN_A]: metadataWith('decimals', 'symbol'), [TOKEN_B]: metadataWith('decimals', 'symbol') } };

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A, TOKEN_B] },
        requirements: { decimals: 'required', symbol: 'best effort' },
        sources: [source1, source2],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal(result2);
    });
  });

  when(`only source with 'required' properties fails`, () => {
    then('fallback fails without waiting for other sources', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });
      const { source: source2 } = source({ chains: [2], properties: { symbol: 'optional' } });

      const promise = getMetadata({ addresses: { [1]: [TOKEN_A] }, requirements: { decimals: 'required' }, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await expect(promise.result).to.to.eventually.be.rejectedWith('Could not find metadata for the given addresses');
      expect(promise.status).to.equal('rejected');
    });
  });

  when(`all sources fail to return 'required' properties`, () => {
    then('fallback fails after waiting for all who supported it', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });
      const { source: source2, promise: source2Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });
      const { source: source3 } = source({ chains: [1], properties: { symbol: 'optional' } });

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A] },
        requirements: { decimals: 'required' },
        sources: [source1, source2, source3],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.reject();
      await expect(promise.result).to.to.eventually.be.rejectedWith('Could not find metadata for the given addresses');
      expect(promise.status).to.equal('rejected');
    });
  });

  when(`all sources fail to return a token's metadata`, () => {
    then('fallback fails after waiting for them all', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });
      const { source: source2, promise: source2Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });
      const result = { [1]: { [TOKEN_A]: metadataWith('decimals', 'symbol') } };

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A, TOKEN_B] },
        requirements: { decimals: 'required' },
        sources: [source1, source2],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result);
      await expect(promise.result).to.to.eventually.be.rejectedWith('Could not find metadata for the given addresses');
      expect(promise.status).to.equal('rejected');
    });
  });

  when(`all sources fail`, () => {
    then('fallback also fails', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });
      const { source: source2, promise: source2Promise } = source({ chains: [1], properties: { decimals: 'optional', symbol: 'optional' } });

      const promise = getMetadata({ addresses: { [1]: [TOKEN_A] }, requirements: { decimals: 'required' }, sources: [source1, source2] });
      expect(promise.status).to.equal('pending');
      source1Promise.reject();
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.reject();
      await expect(promise.result).to.to.eventually.be.rejectedWith('Could not find metadata for the given addresses');
      expect(promise.status).to.equal('rejected');
    });
  });

  when(`combining required properties from different sources`, () => {
    then('fallback waits for all of them', async () => {
      const { source: source1, promise: source1Promise } = source({ chains: [1], properties: { decimals: 'optional' } });
      const { source: source2, promise: source2Promise } = source({ chains: [1], properties: { symbol: 'optional' } });
      const result1 = { [1]: { [TOKEN_A]: metadataWith('decimals') } };
      const result2 = { [1]: { [TOKEN_A]: metadataWith('symbol') } };

      const promise = getMetadata({
        addresses: { [1]: [TOKEN_A] },
        requirements: { decimals: 'required', symbol: 'required' },
        sources: [source1, source2],
      });
      expect(promise.status).to.equal('pending');
      source1Promise.resolve(result1);
      await sleep('10');
      expect(promise.status).to.equal('pending');
      source2Promise.resolve(result2);
      await sleep('10');
      expect(promise.status).to.equal('resolved');
      expect(await promise.result).to.deep.equal({ [1]: { [TOKEN_A]: metadataWith('decimals', 'symbol') } });
    });
  });

  function metadataWith(...properties: string[]) {
    return Object.fromEntries(properties.map((property) => [property, 'value']));
  }

  function getMetadata<Sources extends IMetadataSource<object>[] | []>({
    addresses,
    requirements,
    sources,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    requirements?: FieldsRequirements<MergeMetadata<Sources>>['requirements'];
    sources: Sources;
  }) {
    const result = new FallbackMetadataSource(sources).getMetadata({ addresses, config: { fields: { requirements: requirements ?? {} } } });
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

  function source<TokenMetadata extends object>({
    chains,
    properties,
  }: {
    chains: ChainId[];
    properties: SupportInChain<TokenMetadata>;
  }): {
    source: IMetadataSource<TokenMetadata>;
    promise: PromiseWithTriggers<Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata>>>>;
  } {
    const sourcePromise = promise<Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata>>>>();
    const source: IMetadataSource<TokenMetadata> = {
      getMetadata: () => sourcePromise as any,
      supportedProperties: () => Object.fromEntries(chains.map((chainId) => [chainId, properties])),
    };
    return { source, promise: sourcePromise };
  }
});

function sleep(time: TimeString) {
  return new Promise((resolve) => setTimeout(resolve, ms(time)));
}

type PromiseWithTriggers<T> = Promise<T> & { resolve: (value: T) => void; reject: (error?: any) => void };
type PromiseWithState<T> = { status: 'pending' | 'resolved' | 'rejected'; result: Promise<T> };
