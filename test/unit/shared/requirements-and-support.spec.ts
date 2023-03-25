import { expect } from 'chai';
import { ChainId, FieldRequirementOptions, SupportInChain } from '@types';
import {
  calculateFieldRequirements,
  combineSupportRecords,
  doesResponseMeetRequirements,
  makeRequirementsCompatible,
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

  describe('combineSupportRecords', () => {
    combineSupportTest({
      record1: 'missing',
      record2: 'missing',
      expected: 'missing',
    });

    combineSupportTest({
      record1: 'missing',
      record2: 'optional',
      expected: 'optional',
    });

    combineSupportTest({
      record1: 'missing',
      record2: 'present',
      expected: 'optional',
    });

    combineSupportTest({
      record1: 'optional',
      record2: 'optional',
      expected: 'optional',
    });

    combineSupportTest({
      record1: 'optional',
      record2: 'present',
      expected: 'optional',
    });

    combineSupportTest({
      record1: 'present',
      record2: 'optional',
      expected: 'optional',
    });

    combineSupportTest({
      record1: 'present',
      record2: 'present',
      expected: 'present',
    });

    function combineSupportTest({ record1, record2, expected }: { record1: Support; record2: Support; expected: Support }) {
      const title = `property is '${record1}' and '${record2}'`;
      when(title, () => {
        then(`result is '${expected}'`, () => {
          const build = (support: Support) => (support === 'missing' ? {} : { prop: support });
          const r1 = build(record1);
          const r2 = build(record2);
          const result = combineSupportRecords([r1, r2]);
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
      meetsRequirements: true,
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
      const expected = (meetsRequirements ? '' : 'does not ') + 'meets requirements';
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
              `The provided field requirements cannot be met for all chains`
            );
          }
        });
      });
    }
  });
  describe('makeRequirementsCompatible', () => {
    compatibleRequirementsTest({
      chain1: 'missing',
      chain2: 'missing',
      requirement: 'required',
      expected: 'not set',
    });

    compatibleRequirementsTest({
      chain1: 'present',
      chain2: 'missing',
      requirement: 'required',
      expected: 'not set',
    });

    compatibleRequirementsTest({
      chain1: 'missing',
      chain2: 'optional',
      requirement: 'required',
      expected: 'not set',
    });

    compatibleRequirementsTest({
      chain1: 'present',
      chain2: 'optional',
      requirement: 'required',
      expected: 'required',
    });

    compatibleRequirementsTest({
      chain1: 'missing',
      chain2: 'missing',
      requirement: 'best effort',
      expected: 'best effort',
    });

    compatibleRequirementsTest({
      chain1: 'present',
      chain2: 'missing',
      requirement: 'best effort',
      expected: 'best effort',
    });

    compatibleRequirementsTest({
      chain1: 'missing',
      chain2: 'optional',
      requirement: 'best effort',
      expected: 'best effort',
    });

    compatibleRequirementsTest({
      chain1: 'present',
      chain2: 'optional',
      requirement: 'best effort',
      expected: 'best effort',
    });

    compatibleRequirementsTest({
      chain1: 'missing',
      chain2: 'missing',
      requirement: 'can ignore',
      expected: 'can ignore',
    });

    compatibleRequirementsTest({
      chain1: 'present',
      chain2: 'missing',
      requirement: 'can ignore',
      expected: 'can ignore',
    });

    compatibleRequirementsTest({
      chain1: 'missing',
      chain2: 'optional',
      requirement: 'can ignore',
      expected: 'can ignore',
    });

    compatibleRequirementsTest({
      chain1: 'present',
      chain2: 'optional',
      requirement: 'can ignore',
      expected: 'can ignore',
    });

    function compatibleRequirementsTest({
      chain1,
      chain2,
      requirement,
      expected,
    }: {
      chain1: Support;
      chain2: Support;
      requirement: FieldRequirementOptions;
      expected: FieldRequirementOptions | 'not set';
    }) {
      const title = `support is ${chain1} on chain 1, ${chain2} on chain 2 and requirement is ${requirement}`;
      when(title, () => {
        then(`result is ${expected}`, () => {
          const supportRecord: Record<ChainId, SupportInChain<object>> = {};
          if (chain1 !== 'missing') supportRecord[1] = { prop: chain1 };
          if (chain2 !== 'missing') supportRecord[2] = { prop: chain2 };
          const requirements = requirement ? { requirements: { prop: requirement } } : undefined;
          const result = makeRequirementsCompatible(supportRecord, [1, 2], requirements);
          if (expected === 'not set') {
            expect(result?.requirements.prop).to.be.undefined;
          } else {
            expect(result?.requirements.prop).to.equal(expected);
          }
        });
      });
    }
  });
});

type Support = 'present' | 'optional' | 'missing';
