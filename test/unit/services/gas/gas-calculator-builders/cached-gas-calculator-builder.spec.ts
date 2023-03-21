import chai, { expect } from 'chai';
import { ChainId, FieldsRequirements, SupportRecord, TimeString } from '@types';
import { then, when } from '@test-utils/bdd';
import { EIP1159GasPrice, IQuickGasCostCalculator, IQuickGasCostCalculatorBuilder } from '@services/gas/types';
import chaiAsPromised from 'chai-as-promised';
import { Chains } from '@chains';
import { CachedGasCalculatorBuilder } from '@services/gas/gas-calculator-builders/cached-gas-calculator-builder';
import { calculateFieldRequirements } from '@shared/requirements-and-support';
chai.use(chaiAsPromised);

const CHAIN_ID = Chains.ETHEREUM.chainId;
describe('Cached Gas Calculator Builder', () => {
  cacheTest({
    when: 'called for the first time',
    calls: [{ chainId: CHAIN_ID, config: { timeout: '5s' } }],
    expected: ['pass-through'],
  });

  cacheTest({
    when: 'called for the second time with same requirements',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s' } },
      { chainId: CHAIN_ID, config: { timeout: '5s' } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with same requirements but different timeout',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s' } },
      { chainId: CHAIN_ID, config: { timeout: '15s' } },
    ],
    expected: ['pass-through', 'cached'],
  });

  cacheTest({
    when: 'called for the second time with different requirements',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s' } },
      { chainId: CHAIN_ID, config: { timeout: '15s', fields: { requirements: { fast: 'required' } } } },
    ],
    expected: ['pass-through', 'pass-through'],
  });

  cacheTest({
    when: 'called for the second time with different requirement parameters, but same underlying requirements',
    calls: [
      { chainId: CHAIN_ID, config: { timeout: '5s' } },
      { chainId: CHAIN_ID, config: { timeout: '15s', fields: { requirements: { standard: 'required' } } } },
    ],
    expected: ['pass-through', 'cached'],
  });

  function cacheTest({ when: title, calls, expected }: { when: string; calls: CallParams[]; expected: ('pass-through' | 'cached')[] }) {
    when(title, () => {
      then('it works as expected', async () => {
        const wrapped = new MockedGasCalculatorBuilder();
        const cached = new CachedGasCalculatorBuilder({
          wrapped,
          expiration: { default: { useCachedValue: 'always', useCachedValueIfCalculationFailed: 'always' } },
        });
        for (const call of calls) {
          expect(await cached.build(call)).to.equal(RETURN_VALUE);
        }
        const expectedCalls = expected.filter((expected) => expected === 'pass-through').length;
        expect(wrapped.calls).to.have.lengthOf(expectedCalls);
        for (let i = 0; i < expectedCalls; i++) {
          const requirements = calculateFieldRequirements(wrapped.supportedSpeeds()[CHAIN_ID], calls[i].config?.fields);
          expect(wrapped.calls[i].chainId).to.eql(calls[i].chainId);
          expect(wrapped.calls[i].config).to.eql({ ...calls[i].config, fields: { requirements } });
        }
      });
    });
  }
});

const RETURN_VALUE = { hello: true } as any;
type GasValues = { standard: EIP1159GasPrice; fast?: EIP1159GasPrice; instant?: EIP1159GasPrice };
class MockedGasCalculatorBuilder implements IQuickGasCostCalculatorBuilder<GasValues> {
  public calls: CallParams[] = [];

  supportedSpeeds() {
    const support: SupportRecord<GasValues> = { standard: 'present', fast: 'optional', instant: 'optional' };
    return { [CHAIN_ID]: support };
  }
  build<Requirements extends FieldsRequirements<GasValues>>(params: {
    chainId: ChainId;
    config?: { fields?: Requirements; timeout?: TimeString };
  }): Promise<IQuickGasCostCalculator<GasValues, Requirements>> {
    this.calls.push(params);
    return RETURN_VALUE;
  }
}
type CallParams = {
  chainId: ChainId;
  config?: { fields?: FieldsRequirements<GasValues>; timeout?: TimeString };
};