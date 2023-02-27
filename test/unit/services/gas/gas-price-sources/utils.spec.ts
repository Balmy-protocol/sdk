import { expect } from 'chai';
import { IGasPriceSource } from '@services/gas/types';
import { combineSupportedSpeeds } from '@services/gas/gas-price-sources/utils';

describe('Gas Price Sources Utils', () => {
  describe('combineSupportedSpeeds', () => {
    test('works as expected', () => {
      const combined = combineSupportedSpeeds([source({ 1: ['standard'], 2: ['fast'] }), source({ 2: ['fast', 'instant'], 3: ['instant'] })]);
      expect(combined).to.deep.equal({
        1: ['standard'],
        2: ['fast', 'instant'],
        3: ['instant'],
      });
    });
  });

  function source(support: Record<string, string[]>): IGasPriceSource<any> {
    return {
      supportedSpeeds: () => support,
      getGasPrice: () => Promise.resolve({}),
    };
  }
});
