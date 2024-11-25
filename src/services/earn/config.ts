import { Chains } from '@chains';
import { PERMIT2_ADAPTER_CONTRACT } from '@services/permit2/utils/config';
import { Contract } from '@shared/contracts';

export const EARN_VAULT = Contract.with({ defaultAddress: '0x58e5d76fbbd7e1b51f0fc0f66b7734e108be0461' }) // Polygon
  .and({ address: '0x9324a1f92a82b539f8fb1194a0b894025581ec33', onChain: Chains.BASE })
  .build();

export const EARN_VAULT_COMPANION = Contract.with({ defaultAddress: '0x814CE82aCDE3D99aB6f92e2722A87d8daa20d6cB' }) // Polygon
  .and({ address: '0x260B192b9A5679121FF7f9F0Cf3FED3238753A48', onChain: Chains.BASE })
  .build();

export const EARN_STRATEGY_REGISTRY = Contract.with({ defaultAddress: '0xb034a43d1ffe0f88ed3a50fc096179f543fd3f3a' }) // Polygon
  .and({ address: '0x04a3bd5cc16435f27e7b31e44e4e522c0bc413e9', onChain: Chains.BASE })
  .build();

export const COMPANION_SWAPPER_CONTRACT = PERMIT2_ADAPTER_CONTRACT;

export const DELAYED_WITHDRAWAL_MANAGER = Contract.with({ defaultAddress: '0x92fdb7604ca7e5635421332d4c9a00680dfa53e6' }) // Polygon
  .and({ address: '0x9b5004c016fe00bb81c90e2e2beaa128d1815108', onChain: Chains.BASE })
  .build();

export const EXTERNAL_FIREWALL = Contract.with({ defaultAddress: '0x6B35d4869C2E72F29fbc9a2EE3a29B5502DC1e10' }) // Polygon
  .and({ address: '0x0aDa65e309d609294ADC39Add02aA52331e372Ee', onChain: Chains.BASE })
  .build();
