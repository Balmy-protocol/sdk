import { PERMIT2_ADAPTER_CONTRACT } from '@services/permit2/utils/config';
import { Contract } from '@shared/contracts';

export const EARN_VAULT = Contract.with({ defaultAddress: '0x0990a4a641636D437Af9aa214a1A580377eF1954' }).build();

export const EARN_VAULT_COMPANION = Contract.with({ defaultAddress: '0x5cb7667A29D2029aC2e38aA43F0608b620FAd087' }).build();

export const COMPANION_SWAPPER_CONTRACT = PERMIT2_ADAPTER_CONTRACT;

export const DELAYED_WITHDRAWAL_MANAGER = Contract.with({ defaultAddress: '0x0ed7f185b12f8C5Cb91daA16edDb1778E404d5D0' }).build();

export const EARN_STRATEGY_ROUTER = Contract.with({ defaultAddress: '0xaA2e04112B149Dc415d3F29fc53dD97647ddeE30' }).build();

export const EXTERNAL_FIREWALL = Contract.with({ defaultAddress: '0xdcD1B12ab4941D1D2761119cd5f9B0C4a58e8eda' }).build();
