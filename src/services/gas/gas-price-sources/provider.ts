import { Network } from '@types'
import { IProviderSource } from '@services/providers/types'
import { IGasPriceSource, GasSpeed, GasPrice } from '@services/gas/types'

// We are using the provider here to calculate the gas price
export class ProviderGasPriceSource implements IGasPriceSource {

  constructor(private readonly providerService: IProviderSource) { }

  supportedNetworks(): Network[] {
    return this.providerService.supportedNetworks()
  }

  async getGasPrice(network: Network): Promise<Record<GasSpeed, GasPrice>> {
    const feeData = await this.providerService.getProvider(network).getFeeData()
    const gasPrice = 'maxFeePerGas' in feeData
      ? { maxFeePerGas: feeData.maxFeePerGas!, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas! }
      : { gasPrice: feeData! }
    return {
      'standard': gasPrice,
      'fast': gasPrice,
      'instant': gasPrice
    }
  }
}
