import { PERMIT2_ADAPTER_CONTRACT } from '@services/permit2/utils/config';
import { Contract } from '@shared/contracts';

export const EARN_VAULT = Contract.with({ defaultAddress: '0x0aA2c8C6d099bEC1Bef626F45cEF7506b42B4Ad0' }).build();

export const EARN_VAULT_COMPANION = Contract.with({ defaultAddress: '0xCBb386756A4e05d3F042dfA83f3311c2F0B0b921' }).build();

export const EARN_STRATEGY_REGISTRY = Contract.with({ defaultAddress: '0xa169bbf65675524C498bA6aFD4Eed48cF467f3F0' }).build();

export const COMPANION_SWAPPER_CONTRACT = PERMIT2_ADAPTER_CONTRACT;

export const DELAYED_WITHDRAWAL_MANAGER = Contract.with({ defaultAddress: '0x' }).build(); // TO BE DEPLOYED
