import chai, { expect } from 'chai';
import { ChainId, DefaultRequirements, FieldRequirementOptions, FieldsRequirements, SupportRecord, TimeString, TokenAddress } from '@types';
import { then, when } from '@test-utils/bdd';
import chaiAsPromised from 'chai-as-promised';
import { Chains } from '@chains';
import { calculateFieldRequirements } from '@shared/requirements-and-support';
import { IMetadataSource } from '@services/metadata';
import { BaseTokenMetadata } from '@services/metadata/types';
import { CachedMetadataSource } from '@services/metadata/metadata-sources/cached-metadata-source';
import { StringValue } from 'ms';
chai.use(chaiAsPromised);

const CHAIN_ID = Chains.ETHEREUM.chainId;
const TOKEN = '0x0000000000000000000000000000000000000001';
describe('Cached Metadata Source', () => {
  cacheTest({
    when: 'called for the first time',
    calls: [{ config: { timeout: '5s' } }],
    expected: ['pass-through'],
  });

  cacheTest({
    when: 'called for the second time with same required fields',
    calls: [
      { config: { timeout: '5s', fields: { requirements: { symbol: 'required' } } } },
      { config: { timeout: '5s', fields: { requirements: { symbol: 'required' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with same required fields but different timeout',
    calls: [
      { config: { timeout: '5s', fields: { requirements: { symbol: 'required' } } } },
      { config: { timeout: '15s', fields: { requirements: { symbol: 'required' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with same required fields but different decimals requirements',
    calls: [
      { config: { timeout: '5s', fields: { requirements: { symbol: 'required', decimals: 'best effort' } } } },
      { config: { timeout: '15s', fields: { requirements: { symbol: 'required', decimals: 'can ignore' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with different requirement parameters, but same underlying required fields',
    calls: [
      { config: { timeout: '5s', fields: { requirements: { symbol: 'required' } } } },
      { config: { timeout: '15s', fields: { requirements: { decimals: 'best effort' }, default: 'required' } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with different required fields',
    calls: [
      { config: { timeout: '5s', fields: { requirements: { symbol: 'required' } } } },
      { config: { timeout: '15s', fields: { requirements: { decimals: 'required' } } } },
    ],
    expected: ['pass-through', 'pass-through'],
  });

  function cacheTest({
    when: title,
    calls,
    expected,
  }: {
    when: string;
    calls: Pick<CallParams, 'config'>[];
    expected: ('pass-through' | 'cached')[];
  }) {
    const addresses = { [CHAIN_ID]: [TOKEN] };
    when(title, () => {
      then('it works as expected', async () => {
        const wrapped = new MockedMetadataSource();
        const cached = new CachedMetadataSource(wrapped, {
          expiration: { useCachedValue: 'always', useCachedValueIfCalculationFailed: 'always' },
          maxSize: 100,
        });
        for (const call of calls) {
          const result = await cached.getMetadata({ addresses, ...call });
          expect(result).to.eql(RETURN_VALUE);
        }
        const expectedCalls = expected.filter((expected) => expected === 'pass-through').length;
        expect(wrapped.calls).to.have.lengthOf(expectedCalls);
        for (let i = 0; i < expectedCalls; i++) {
          const fieldRequirements = calculateFieldRequirements(wrapped.supportedProperties()[CHAIN_ID], calls[i].config?.fields);
          const requiredFields = Object.entries(fieldRequirements)
            .filter(([, requirement]) => requirement === 'required')
            .map(([field]) => field);
          const requirements = Object.fromEntries(requiredFields.map((field) => [field, 'required'])) as Partial<
            Record<keyof TokenMetadata, FieldRequirementOptions>
          >;
          expect(wrapped.calls[i].addresses).to.eql(addresses);
          expect(wrapped.calls[i].config).to.eql({ ...calls[i].config, fields: { requirements, default: 'best effort' } });
        }
      });
    });
  }
});

const RETURN_VALUE = { [CHAIN_ID]: { [TOKEN]: { symbol: 'SYMB', decimals: 18 } } } as any;
type TokenMetadata = Partial<BaseTokenMetadata>;
class MockedMetadataSource implements IMetadataSource<TokenMetadata> {
  public calls: CallParams[] = [];

  supportedProperties() {
    const support: SupportRecord<TokenMetadata> = { decimals: 'optional', symbol: 'optional' };
    return { [CHAIN_ID]: support };
  }
  getMetadata<Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>(params: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { fields?: Requirements; timeout?: StringValue };
  }) {
    this.calls.push(params);
    return RETURN_VALUE;
  }
}
type CallParams = {
  addresses: Record<ChainId, TokenAddress[]>;
  config?: { fields?: FieldsRequirements<TokenMetadata>; timeout?: TimeString };
};
