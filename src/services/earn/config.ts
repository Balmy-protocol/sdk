import { PERMIT2_ADAPTER_CONTRACT } from '@services/permit2/utils/config';
import { Contract } from '@shared/contracts';

export const EARN_VAULT = Contract.with({ defaultAddress: '0x63a8aE714568EC8f8Ec14472674c68582b0B0458' }).build();

export const EARN_VAULT_COMPANION = Contract.with({ defaultAddress: '0xCBb386756A4e05d3F042dfA83f3311c2F0B0b921' }).build();

export const EARN_STRATEGY_REGISTRY = Contract.with({ defaultAddress: '0xF04647173Cd720158a2D2e5667343F7c397265cA' }).build();

export const COMPANION_SWAPPER_CONTRACT = PERMIT2_ADAPTER_CONTRACT;

export const DELAYED_WITHDRAWAL_MANAGER = Contract.with({ defaultAddress: '0xA4576169267E89DB08bA9eCef67dc6A2F8046568' }).build();
