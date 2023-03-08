import { expect } from 'chai';
import { FieldRequirementOptions } from '@types';
import { calculateFieldRequirements } from '@shared/field-requirements';
import { when, then } from '@test-utils/bdd';

describe('Field Requirements', () => {
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
      expected: 'required',
    });

    calculateRequirementsTest({
      support: 'optional',
      requirement: 'required',
      expected: 'required',
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
      const title = `when property is ${support}, requirement is ${requirement ?? 'not set'} and default is ${defaultValue ?? 'not set'}`;
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
});
