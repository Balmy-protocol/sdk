import { Network } from "@types"
import { providers } from "ethers"

export type IProviderSource = {
  supportedNetworks(): Network[],
  getProvider(network: Network): providers.BaseProvider
}
