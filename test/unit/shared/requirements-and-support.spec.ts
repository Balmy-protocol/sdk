import { expect } from 'chai';
import { ChainId, FieldRequirementOptions, SupportInChain } from '@types';
import {
  calculateFieldRequirements,
  combineSourcesSupportInChain,
  doesResponseMeetRequirements,
  validateRequirements,
} from '@shared/requirements-and-support';
import { when, then } from '@test-utils/bdd';

const CHAIN_ID = 1;

describe('Requirements And Support', () => {
  describe('calculateFieldRequirements', () => {
    calculateRequirementsTest({
      support: 'present',
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'optional',
      expected: 'best effort',
    });

    calculateRequirementsTest({
      support: 'present',
      requirement: 'required',
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'present',
      requirement: 'best effort',
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'present',
      requirement: 'can ignore',
      expected: 'can ignore',
    });

    calculateRequirementsTest({
      support: 'optional',
      requirement: 'required',
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'optional',
      requirement: 'best effort',
      expected: 'best effort',
    });

    calculateRequirementsTest({
      support: 'optional',
      requirement: 'required',
      default: 'can ignore',
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'optional',
      requirement: 'best effort',
      default: 'required',
      expected: 'best effort',
    });

    calculateRequirementsTest({
      support: 'optional',
      default: 'required',
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'optional',
      default: 'best effort',
      expected: 'best effort',
    });

    calculateRequirementsTest({
      support: 'optional',
      default: 'can ignore',
      expected: 'can ignore',
    });

    function calculateRequirementsTest({
      support,
      requirement,
      default: defaultValue,
      expected,
    }: {
      support: 'present' | 'optional';
      expected: FieldRequirementOptions;
      requirement?: FieldRequirementOptions;
      default?: FieldRequirementOptions;
    }) {
      const title = `property is ${support}, requirement is ${requirement ?? 'not set'} and default is ${defaultValue ?? 'not set'}`;
      when(title, () => {
        then('result is calculated correctly', () => {
          const requirements =
            requirement || defaultValue ? { requirements: requirement ? { prop: requirement } : {}, default: defaultValue } : undefined;
          const result = calculateFieldRequirements({ prop: support }, requirements);
          expect(result).to.eql({ prop: expected });
        });
      });
    }
  });

  describe('combineSourcesSupportInChain', () => {
    combineSupportTest({
      source1: 'missing',
      source2: 'missing',
      expected: 'missing',
    });

    combineSupportTest({
      source1: 'missing',
      source2: 'optional',
      expected: 'optional',
    });

    combineSupportTest({
      source1: 'missing',
      source2: 'present',
      expected: 'optional',
    });

    combineSupportTest({
      source1: 'optional',
      source2: 'optional',
      expected: 'optional',
    });

    combineSupportTest({
      source1: 'optional',
      source2: 'present',
      expected: 'optional',
    });

    combineSupportTest({
      source1: 'present',
      source2: 'optional',
      expected: 'optional',
    });

    combineSupportTest({
      source1: 'present',
      source2: 'present',
      expected: 'present',
    });

    function combineSupportTest({ source1, source2, expected }: { source1: Support; source2: Support; expected: Support }) {
      const title = `property is '${source1}' and '${source2}'`;
      when(title, () => {
        then(`result is '${expected}'`, () => {
          const build = (support: Support) => (support === 'missing' ? {} : { prop: support });
          const s1 = source(build(source1));
          const s2 = source(build(source2));
          const result = combineSourcesSupportInChain(CHAIN_ID, [s1, s2], extractSupport);
          expect(result).to.eql(build(expected));
        });
      });
    }
  });

  describe('doesResponseMeetRequirements', () => {
    responseMeetsRequirementsTest({
      object: {},
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: {},
      requirement: 'required',
      meetsRequirements: false,
    });

    responseMeetsRequirementsTest({
      object: {},
      requirement: 'best effort',
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: {},
      requirement: 'can ignore',
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: undefined },
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: undefined },
      requirement: 'required',
      meetsRequirements: false,
    });

    responseMeetsRequirementsTest({
      object: { prop: undefined },
      requirement: 'best effort',
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: undefined },
      requirement: 'can ignore',
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: 'value' },
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: 'value' },
      requirement: 'required',
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: 'value' },
      requirement: 'best effort',
      meetsRequirements: true,
    });

    responseMeetsRequirementsTest({
      object: { prop: 'value' },
      requirement: 'can ignore',
      meetsRequirements: true,
    });

    function responseMeetsRequirementsTest({
      object,
      requirement,
      meetsRequirements,
    }: {
      object: any;
      requirement?: FieldRequirementOptions;
      meetsRequirements: boolean;
    }) {
      const present = !!object.prop ? 'present' : 'missing';
      const title = `property is ${present} and ${requirement ?? 'nothing'} as requirement`;
      const expected = (meetsRequirements ? '' : 'does not ') + 'meets requiremenets';
      when(title, () => {
        then(expected, () => {
          const result = doesResponseMeetRequirements(object, requirement && { requirements: { prop: requirement } });
          expect(result).to.equal(meetsRequirements);
        });
      });
    }
  });

  describe('filterSourcesBasedOnRequirements', () => {
    validateTest({
      support: 'missing',
      expected: 'ok',
    });

    validateTest({
      support: 'missing',
      requirement: 'best effort',
      expected: 'ok',
    });

    validateTest({
      support: 'missing',
      requirement: 'can ignore',
      expected: 'ok',
    });

    validateTest({
      support: 'missing',
      requirement: 'required',
      expected: 'fail',
    });

    validateTest({
      support: 'optional',
      expected: 'ok',
    });

    validateTest({
      support: 'optional',
      requirement: 'best effort',
      expected: 'ok',
    });

    validateTest({
      support: 'optional',
      requirement: 'can ignore',
      expected: 'ok',
    });

    validateTest({
      support: 'optional',
      requirement: 'required',
      expected: 'ok',
    });

    validateTest({
      support: 'present',
      expected: 'ok',
    });

    validateTest({
      support: 'present',
      requirement: 'best effort',
      expected: 'ok',
    });

    validateTest({
      support: 'present',
      requirement: 'can ignore',
      expected: 'ok',
    });

    validateTest({
      support: 'present',
      requirement: 'required',
      expected: 'ok',
    });

    function validateTest({
      support,
      requirement,
      expected,
    }: {
      support: Support;
      requirement?: FieldRequirementOptions;
      expected: 'ok' | 'fail';
    }) {
      const title = `support is ${support} and ${requirement ?? 'nothing'} as requirement`;
      when(title, () => {
        then(`result is ${expected}`, () => {
          const supportRecord: Record<ChainId, SupportInChain<object>> = support !== 'missing' ? { [CHAIN_ID]: { prop: support } } : {};
          const requirements = requirement ? { requirements: { prop: requirement } } : undefined;
          if (expected === 'ok') {
            validateRequirements(supportRecord, [CHAIN_ID], requirements);
          } else {
            expect(() => validateRequirements(supportRecord, [CHAIN_ID], requirements)).to.throw(
              `The provided field requirements cannot be met for chain with id ${CHAIN_ID}`
            );
          }
        });
      });
    }
  });
});

function extractSupport(source: Source) {
  return source.getSupport();
}

function source(support: SupportInChain<object>): Source {
  return {
    getSupport: () => ({ [CHAIN_ID]: support }),
  };
}
type Source = { getSupport: () => Record<ChainId, SupportInChain<object>> };
type Support = 'present' | 'optional' | 'missing';
