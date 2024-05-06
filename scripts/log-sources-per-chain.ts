import { ChainId } from '../src/types';
import { getChainByKeyOrFail } from '../src/chains';
import { QUOTE_SOURCES } from '../src/services/quotes/source-registry';

function main() {
  const allSources: Record<ChainId, string[]> = {};

  for (const source of Object.values(QUOTE_SOURCES)) {
    const metadata = source.getMetadata();
    for (const chainId of metadata.supports.chains) {
      if (chainId in allSources) {
        allSources[chainId].push(metadata.name);
      } else {
        allSources[chainId] = [metadata.name];
      }
    }
  }

  console.log('Sources per chain:');
  for (const [chainId, sources] of Object.entries(allSources)) {
    console.log(`- ${getChainByKeyOrFail(chainId).name} (${chainId}):`);
    for (const source of sources) {
      console.log(`  - ${source}`);
    }
  }
}

main();
