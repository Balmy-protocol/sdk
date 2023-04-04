import { getChainByKey } from '@chains';
import { expect } from 'chai';
import { QUOTE_SOURCES } from '@services/quotes/source-registry';

describe('Quote Sources', () => {
  it('all sources have known chains assigned', () => {
    for (const source of allSources()) {
      const {
        name,
        supports: { chains },
      } = source.getMetadata();
      for (const chain of chains) {
        expect(getChainByKey(chain), `Unknown chain with id ${chain} on ${name}`).to.not.be.undefined;
      }
    }
  });
});

function allSources() {
  return Object.values(QUOTE_SOURCES);
}
