import chai, { expect } from 'chai';
import { ChainId, FieldRequirementOptions, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { then, when } from '@test-utils/bdd';
import { EIP1159GasPrice, GasPriceResult, IGasPriceSource } from '@services/gas/types';
import chaiAsPromised from 'chai-as-promised';
import { Chains } from '@chains';
import { CachedGasPriceSource } from '@services/gas/gas-price-sources/cached-gas-price-source';
import { calculateFieldRequirements } from '@shared/requirements-and-support';
chai.use(chaiAsPromised);

const CHAIN_ID = Chains.ETHEREUM.chainId;
describe('Cached Gas Price Source', () => {
  cacheTest({
    when: 'called for the first time',
    calls: [{ chainId: CHAIN_ID, config: { timeout: '5s' } }],
    expected: ['pass-through'],
  });

  cacheTest({
    when: 'called for the second time with same required fields',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s', fields: { requirements: { fast: 'required' } } } },
      { chainId: CHAIN_ID, config: { timeout: '5s', fields: { requirements: { fast: 'required' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with same required fields but different timeout',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s', fields: { requirements: { fast: 'required' } } } },
      { chainId: CHAIN_ID, config: { timeout: '15s', fields: { requirements: { fast: 'required' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with same required fields but different standard requirements',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s', fields: { requirements: { fast: 'required', standard: 'best effort' } } } },
      { chainId: CHAIN_ID, config: { timeout: '15s', fields: { requirements: { fast: 'required', standard: 'can ignore' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with different requirement parameters, but same underlying required fields',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s', fields: { requirements: { fast: 'required' } } } },
      {
        chainId: CHAIN_ID,
        config: { timeout: '15s', fields: { requirements: { standard: 'best effort', instant: 'best effort' }, default: 'required' } },
      },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with different required fields',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s', fields: { requirements: { standard: 'required' } } } },
      { chainId: CHAIN_ID, config: { timeout: '15s', fields: { requirements: { fast: 'required' } } } },
    ],
    expected: ['pass-through', 'pass-through'],
  });

  function cacheTest({ when: title, calls, expected }: { when: string; calls: CallParams[]; expected: ('pass-through' | 'cached')[] }) {
    when(title, () => {
      then('it works as expected', async () => {
        const wrapped = new MockedGasPriceSource();
        const cached = new CachedGasPriceSource({
          underlying: wrapped,
          expiration: { default: { useCachedValue: 'always', useCachedValueIfCalculationFailed: 'always' } },
        });
        for (const call of calls) {
          expect(await cached.getGasPrice(call)).to.equal(RETURN_VALUE);
        }
        const expectedCalls = expected.filter((expected) => expected === 'pass-through').length;
        expect(wrapped.calls).to.have.lengthOf(expectedCalls);
        for (let i = 0; i < expectedCalls; i++) {
          const fieldRequirements = calculateFieldRequirements(wrapped.supportedSpeeds()[CHAIN_ID], calls[i].config?.fields);
          const requiredFields = Object.entries(fieldRequirements)
            .filter(([, requirement]) => requirement === 'required')
            .map(([field]) => field);
          const requirements = Object.fromEntries(requiredFields.map((field) => [field, 'required'])) as Partial<
            Record<keyof GasValues, FieldRequirementOptions>
          >;
          expect(wrapped.calls[i].chainId).to.eql(calls[i].chainId);
          expect(wrapped.calls[i].config).to.eql({ ...calls[i].config, fields: { requirements, default: 'best effort' } });
        }
      });
    });
  }
});

const RETURN_VALUE = { hello: true } as any;
type GasValues = { standard?: EIP1159GasPrice; fast?: EIP1159GasPrice; instant?: EIP1159GasPrice };
class MockedGasPriceSource implements IGasPriceSource<GasValues> {
  public calls: CallParams[] = [];

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'optional', fast: 'optional', instant: 'optional' };
    return { [CHAIN_ID]: support };
  }

  getGasPrice<Requirements extends FieldsRequirements<GasValues>>(params: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<GasPriceResult<GasValues, Requirements>> {
    this.calls.push(params);
    return RETURN_VALUE;
  }
}
type CallParams = {
  chainId: ChainId;
  config?: { fields?: FieldsRequirements<GasValues>; timeout?: TimeString };
};
