import { ChainId, Chain } from '@types';

export type ChainName = keyof typeof Chains;
export const Chains = {
  ETHEREUM: {
    chainId: 1,
    name: 'Ethereum',
    ids: ['ethereum', 'mainnet', 'homestead'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    publicRPCs: [
      'https://rpc.ankr.com/eth',
      'https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79',
      'https://cloudflare-eth.com/',
      'https://main-light.eth.linkpool.io/',
      'https://api.mycryptoapi.com/eth',
    ],
    explorer: 'https://etherscan.io/',
  },
  OPTIMISM: {
    chainId: 10,
    name: 'Optimism',
    ids: ['optimism'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0x4200000000000000000000000000000000000006',
    publicRPCs: ['https://mainnet.optimism.io/'],
    explorer: 'https://optimistic.etherscan.io/',
  },
  ARBITRUM: {
    chainId: 42161,
    name: 'Arbitrum',
    ids: ['arbitrum'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    publicRPCs: ['https://arb1.arbitrum.io/rpc'],
    explorer: 'https://arbiscan.io/',
  },
  ARBITRUM_NOVA: {
    chainId: 42170,
    name: 'Arbitrum Nova',
    ids: ['nova'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0x722e8bdd2ce80a4422e880164f2079488e115365',
    publicRPCs: ['https://nova.arbitrum.io/rpc'],
    explorer: 'https://nova.arbiscan.io/',
  },
  POLYGON: {
    chainId: 137,
    name: 'Polygon',
    ids: ['polygon', 'matic'],
    nativeCurrency: { symbol: 'MATIC', name: 'Matic' },
    wToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    publicRPCs: ['https://polygon-rpc.com/', 'https://rpc-mainnet.maticvigil.com/'],
    explorer: 'https://polygonscan.com/',
  },
  BNB_CHAIN: {
    chainId: 56,
    name: 'BNB Chain',
    ids: ['bsc', 'bnb'],
    nativeCurrency: { symbol: 'BNB', name: 'BNB' },
    wToken: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    publicRPCs: [
      'https://rpc.ankr.com/bsc',
      'https://bsc-dataseed1.defibit.io/',
      'https://bsc-dataseed1.ninicoin.io/',
      'https://bsc-dataseed2.defibit.io/',
      'https://bsc-dataseed2.ninicoin.io/',
    ],
    explorer: 'https://bscscan.com/',
  },
  FANTOM: {
    chainId: 250,
    name: 'Fantom',
    ids: ['fantom'],
    nativeCurrency: { symbol: 'FTM', name: 'Fantom' },
    wToken: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
    publicRPCs: ['https://rpc.fantom.network', 'https://rpc.ftm.tools/', 'https://rpc.ankr.com/fantom', 'https://rpcapi.fantom.network'],
    explorer: 'https://ftmscan.com/',
  },
  CELO: {
    chainId: 42220,
    name: 'Celo',
    ids: ['celo'],
    nativeCurrency: { symbol: 'CELO', name: 'Celo' },
    wToken: '0x149d5bf28fbace2950b52d4aca1c79bfd9bbb6fc',
    publicRPCs: ['https://rpc.ankr.com/celo', 'https://celo-mainnet-archive.allthatnode.com', 'https://celo-mainnet-rpc.allthatnode.com'],
    explorer: 'https://celoscan.io/',
  },
  AVALANCHE: {
    chainId: 43114,
    name: 'Avalanche',
    ids: ['avalanche', 'avax'],
    nativeCurrency: { symbol: 'AVAX', name: 'Avalanche' },
    wToken: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    publicRPCs: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'],
    explorer: 'https://cchain.explorer.avax.network/',
  },
  HECO: {
    chainId: 128,
    name: 'Heco',
    ids: ['heco'],
    nativeCurrency: { symbol: 'HT', name: 'Heco' },
    wToken: '0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f',
    publicRPCs: ['https://http-mainnet.hecochain.com', 'https://pub001.hg.network/rpc'],
    explorer: 'https://scan.hecochain.com/',
  },
  OKC: {
    chainId: 66,
    name: 'OKC',
    ids: ['okc', 'okexchain'],
    nativeCurrency: { symbol: 'OKT', name: 'OKC Token' },
    wToken: '0x8f8526dbfd6e38e3d8307702ca8469bae6c56c15',
    publicRPCs: ['https://exchainrpc.okex.org', 'https://okc-mainnet.gateway.pokt.network/v1/lb/6275309bea1b320039c893ff'],
    explorer: 'https://www.oklink.com/en/okc/',
  },
  MOONRIVER: {
    chainId: 1285,
    name: 'Moonriver',
    ids: ['moonriver'],
    nativeCurrency: { symbol: 'MOVR', name: 'Moonriver' },
    wToken: '0x98878b06940ae243284ca214f92bb71a2b032b8a',
    publicRPCs: ['https://rpc.api.moonriver.moonbeam.network/', 'https://moonriver.api.onfinality.io/public'],
    explorer: 'https://moonriver.moonscan.io/',
  },
  MOONBEAM: {
    chainId: 1284,
    name: 'Moonbeam',
    ids: ['moonbeam'],
    nativeCurrency: { symbol: 'GLMR', name: 'Moonbeam' },
    wToken: '0xAcc15dC74880C9944775448304B263D191c6077F',
    publicRPCs: ['https://rpc.api.moonbeam.network'],
    explorer: 'https://moonscan.io/',
  },
  FUSE: {
    chainId: 122,
    name: 'Fuse',
    ids: ['fuse'],
    nativeCurrency: { symbol: 'FUSE', name: 'Fuse' },
    wToken: '0x0BE9e53fd7EDaC9F859882AfdDa116645287C629',
    publicRPCs: ['https://fuse-rpc.gateway.pokt.network', 'https://fuse-mainnet.chainstacklabs.com', 'https://rpc.fuse.io'],
    explorer: 'https://explorer.fuse.io/',
  },
  VELAS: {
    chainId: 106,
    name: 'Velas',
    ids: ['velas'],
    nativeCurrency: { symbol: 'VLX', name: 'Velas' },
    wToken: '0xc579D1f3CF86749E05CD06f7ADe17856c2CE3126',
    publicRPCs: ['https://evmexplorer.velas.com/rpc', 'https://explorer.velas.com/rpc'],
    explorer: 'https://explorer.velas.com/',
  },
  GNOSIS: {
    chainId: 100,
    name: 'Gnosis Chain',
    ids: ['gnosis', 'xdai'],
    nativeCurrency: { symbol: 'xDAI', name: 'xDAI' },
    wToken: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
    publicRPCs: [
      'https://rpc.gnosischain.com/',
      'https://gnosischain-rpc.gateway.pokt.network',
      'https://rpc.ankr.com/gnosis',
      'https://xdai-archive.blockscout.com',
    ],
    explorer: 'https://gnosisscan.io/',
  },
  CRONOS: {
    chainId: 25,
    name: 'Cronos',
    ids: ['cronos'],
    nativeCurrency: { symbol: 'CRO', name: 'Cronos' },
    wToken: '0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23',
    publicRPCs: ['https://cronosrpc-1.xstaking.sg', 'https://evm.cronos.org', 'https://rpc.vvs.finance', 'https://evm-cronos.crypto.org'],
    explorer: 'https://cronoscan.com/',
  },
  BOBA: {
    chainId: 288,
    name: 'Boba Network',
    ids: ['boba'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000',
    publicRPCs: [
      'https://mainnet.boba.network/',
      'https://mainnet.portal.pokt.network',
      'https://lightning-replica.boba.network',
      'https://boba-mainnet.gateway.pokt.network/v1/lb/623ad21b20354900396fed7f',
    ],
    explorer: 'https://bobascan.com/',
  },
  ONTOLOGY: {
    chainId: 58,
    name: 'Ontology',
    ids: ['ont', 'ontology'],
    nativeCurrency: { symbol: 'ONG', name: 'Ontology Gas' },
    wToken: '0xd8bc24cfd45452ef2c8bc7618e32330b61f2691b',
    publicRPCs: [
      'https://dappnode1.ont.io:10339',
      'https://dappnode2.ont.io:10339',
      'https://dappnode3.ont.io:10339',
      'https://dappnode4.ont.io:10339',
    ],
    explorer: 'https://explorer.ont.io/',
  },
  KLAYTN: {
    chainId: 8217,
    name: 'Klaytn',
    ids: ['klaytn'],
    nativeCurrency: { symbol: 'KLAY', name: 'Klaytn' },
    wToken: '0xe4f05a66ec68b54a58b17c22107b02e0232cc817',
    publicRPCs: ['https://public-en-cypress.klaytn.net', 'https://public-node-api.klaytnapi.com/v1/cypress'],
    explorer: 'https://scope.klaytn.com/',
  },
  AURORA: {
    chainId: 1313161554,
    name: 'Aurora',
    ids: ['aurora'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0xc9bdeed33cd01541e1eed10f90519d2c06fe3feb',
    publicRPCs: ['https://endpoints.omniatech.io/v1/aurora/mainnet/public', 'https://mainnet.aurora.dev'],
    explorer: 'https://explorer.mainnet.aurora.dev/',
  },
  ASTAR: {
    chainId: 592,
    name: 'Astar',
    ids: ['astar'],
    nativeCurrency: { symbol: 'ASTR', name: 'Astar' },
    wToken: '0xaeaaf0e2c81af264101b9129c00f4440ccf0f720',
    publicRPCs: ['https://evm.astar.network/', 'https://rpc.astar.network:8545', 'https://astar.api.onfinality.io/public'],
    explorer: 'https://astar.subscan.io/',
  },
  HARMONY_SHARD_0: {
    chainId: 1666600000,
    name: 'Harmony',
    ids: ['harmony'],
    nativeCurrency: { symbol: 'ONE', name: 'Harmony' },
    wToken: '0xcf664087a5bb0237a0bad6742852ec6c8d69a27a',
    publicRPCs: ['https://api.harmony.one'],
    explorer: 'https://explorer.harmony.one/',
  },
  BIT_TORRENT: {
    chainId: 199,
    name: 'BitTorrent',
    ids: ['bittorrent'],
    nativeCurrency: { symbol: 'BTT', name: 'BitTorrent' },
    wToken: '0x23181f21dea5936e24163ffaba4ea3b316b57f3c',
    publicRPCs: ['https://rpc.bittorrentchain.io'],
    explorer: 'https://bttcscan.com/',
  },
  OASIS_EMERALD: {
    chainId: 42262,
    name: 'Oasis Emerald',
    ids: ['oasis', 'emerald'],
    nativeCurrency: { symbol: 'ROSE', name: 'Oasis Network' },
    wToken: '0x21C718C22D52d0F3a789b752D4c2fD5908a8A733',
    publicRPCs: ['https://emerald.oasis.dev'],
    explorer: 'https://explorer.emerald.oasis.dev/',
  },
  CANTO: {
    chainId: 7700,
    name: 'Canto',
    ids: ['canto'],
    nativeCurrency: { symbol: 'CANTO', name: 'Canto' },
    wToken: '0x826551890Dc65655a0Aceca109aB11AbDbD7a07B',
    publicRPCs: ['https://mainnode.plexnode.org:8545', 'https://canto.slingshot.finance'],
    explorer: 'https://evm.explorer.canto.io/',
  },
  EVMOS: {
    chainId: 9001,
    name: 'EVMOS',
    ids: ['evmos'],
    nativeCurrency: { symbol: 'EVMOS', name: 'Evmos' },
    wToken: '0xD4949664cD82660AaE99bEdc034a0deA8A0bd517',
    publicRPCs: ['https://evmos-evm.publicnode.com', 'https://eth.bd.evmos.org:8545', 'https://evmos-mainnet.public.blastapi.io'],
    explorer: 'https://escan.live/',
  },
  ROOTSTOCK: {
    chainId: 30,
    name: 'Rootstock',
    ids: ['rsk'],
    nativeCurrency: { symbol: 'RBTC', name: 'Rootstock RSK' },
    wToken: '0x542fda317318ebf1d3deaf76e0b632741a7e677d',
    publicRPCs: ['https://mycrypto.rsk.co', 'https://public-node.rsk.co'],
    explorer: 'https://explorer.rsk.co/',
  },
  ETHEREUM_GOERLI: {
    chainId: 5,
    name: 'Ethereum Goerli',
    ids: ['goerli'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
    publicRPCs: ['https://rpc.ankr.com/eth_goerli', 'https://goerli.blockpi.network/v1/rpc/public'],
    explorer: 'https://goerli.etherscan.io/',
    testnet: true,
  },
  ETHEREUM_SEPOLIA: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    ids: ['sepolia'],
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum' },
    wToken: '0xf531b8f309be94191af87605cfbf600d71c2cfe0',
    publicRPCs: ['https://rpc.sepolia.org'],
    explorer: 'https://sepolia.etherscan.io/',
    testnet: true,
  },
  POLYGON_MUMBAI: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    ids: ['mumbai'],
    nativeCurrency: { symbol: 'MATIC', name: 'Matic' },
    wToken: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
    publicRPCs: ['https://rpc.ankr.com/polygon_mumbai', 'https://polygon-mumbai.blockpi.network/v1/rpc/public'],
    explorer: 'https://mumbai.polygonscan.com/',
    testnet: true,
  },
} satisfies Record<string, Chain>;

export function getAllChains(): Chain[] {
  return Object.values(Chains);
}

export function getChainByKey(key: string | ChainId): Chain | undefined {
  const toLower = `${key}`.toLowerCase();
  return getAllChains().find(({ chainId, ids }) => `${chainId}` === toLower || ids.includes(toLower));
}

export function getChainByKeyOrFail(key: string | ChainId): Chain {
  const chain = getChainByKey(key);
  if (!chain) throw new Error(`Failed to find a chain with key '${key}'`);
  return chain;
}

export function chainsIntersection(chains1: ChainId[], ...otherChains: ChainId[][]): ChainId[] {
  const chainSet = new Set(chains1);
  for (const chainList of otherChains) {
    const toCompare = new Set(chainList);
    for (const chainId of chainSet) {
      if (!toCompare.has(chainId)) {
        chainSet.delete(chainId);
      }
    }
  }
  return [...chainSet];
}

export function chainsUnion(chains: ChainId[][]): ChainId[] {
  const chainSet: Set<ChainId> = new Set();
  for (const chainList of chains) {
    for (const chain of chainList) {
      chainSet.add(chain);
    }
  }
  return [...chainSet];
}
