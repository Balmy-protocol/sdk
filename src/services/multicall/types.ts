import { Address, Network } from "@types";

export type IMulticallService = {
  supportedNetworks(): Network[]
  readOnlyMulticallToSingleTarget({ network, target, calls }: { network: Network, target: Address, calls: { calldata: string, decode: string }[] }): Promise<any[]>
  readOnlyMulticall({ network, calls }: { network: Network, calls: { target: Address, decode: string, calldata: string }[] }): Promise<any[]>
}