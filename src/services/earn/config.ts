import { Chains } from '@chains';
import { PERMIT2_ADAPTER_CONTRACT } from '@services/permit2/utils/config';
import { Contract } from '@shared/contracts';

export const EARN_VAULT = Contract.with({ defaultAddress: '0x9332b2ceCcb56beD1d727c5e350E174699f96cCA' }).build();

export const EARN_VAULT_COMPANION = Contract.with({ defaultAddress: '0xAbbFc43F00e88d0ab836c8c630A98E6a27094Bb5' }).build();

export const EARN_STRATEGY_REGISTRY = Contract.with({ defaultAddress: '0x020ebf53F4e5Ef859e18e2973bd8d8b9AF5C9c9F' }).build();

export const COMPANION_SWAPPER_CONTRACT = PERMIT2_ADAPTER_CONTRACT;

export const DELAYED_WITHDRAWAL_MANAGER = Contract.with({ defaultAddress: '0x0ed7f185b12f8C5Cb91daA16edDb1778E404d5D0' }).build();

export const EXTERNAL_FIREWALL = Contract.with({ defaultAddress: '0xDFaF88Ee13CECF3d854F5A4eebffe99a242bbe8A' }).build();
