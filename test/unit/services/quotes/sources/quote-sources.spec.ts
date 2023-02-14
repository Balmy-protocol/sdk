import { getChainByKey } from '@chains';
import { expect } from 'chai';
import { buildSources, DefaultSourcesConfig } from '@services/quotes/source-registry';

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
  const config = { apiKey: '' };
  const sourcesConfig: DefaultSourcesConfig = {
    odos: config,
    firebird: config,
    rango: config,
  };
  return Object.values(buildSources(sourcesConfig));
}
