import { Chains } from '@chains';
import { Contract } from '@shared/contracts';

export const DCA_HUB_CONTRACT = Contract.with({ defaultAddress: '0xA5AdC5484f9997fBF7D405b9AA62A7d88883C345' })
  .and({ address: '0x8CC0Df843610cefF7f4AFa01100B6abf6756Bdf2', onChain: Chains.ROOTSTOCK.chainId })
  .build();
export const DCA_PERMISSION_MANAGER_CONTRACT = Contract.with({ defaultAddress: '0x20bdAE1413659f47416f769a4B27044946bc9923' })
  .and({ address: '0x1EE410Fc840cC13C4e1b17DC6f93E245a918c19e', onChain: Chains.ROOTSTOCK.chainId })
  .build();
export const COMPANION_CONTRACT = Contract.with({ defaultAddress: '0x6C615481E96806edBd9987B6E522A4Ea85d13659' })
  .and({ address: '0x5872E8D5Ec9Dbf67949FdD4B5e05707644D60876', onChain: Chains.ROOTSTOCK.chainId })
  .build();
export const COMPANION_SWAPPER_CONTRACT = Contract.with({ defaultAddress: '0xED306e38BB930ec9646FF3D917B2e513a97530b1' }).build();
