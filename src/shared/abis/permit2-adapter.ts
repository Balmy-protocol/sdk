export default [
  {
    inputs: [{ internalType: 'bytes[]', name: '_calls', type: 'bytes[]' }],
    name: 'simulate',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'success', type: 'bool' },
          { internalType: 'bytes', name: 'result', type: 'bytes' },
          { internalType: 'uint256', name: 'gasSpent', type: 'uint256' },
        ],
        internalType: 'struct ISimulationAdapter.SimulationResult[]',
        name: '_results',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
          { internalType: 'address', name: 'allowanceTarget', type: 'address' },
          { internalType: 'address', name: 'swapper', type: 'address' },
          { internalType: 'bytes', name: 'swapData', type: 'bytes' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'minAmountOut', type: 'uint256' },
          {
            components: [
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'shareBps', type: 'uint256' },
            ],
            internalType: 'struct Token.DistributionTarget[]',
            name: 'transferOut',
            type: 'tuple[]',
          },
          { internalType: 'bytes', name: 'misc', type: 'bytes' },
        ],
        internalType: 'struct ISwapPermit2Adapter.SellOrderSwapParams',
        name: '_params',
        type: 'tuple',
      },
    ],
    name: 'sellOrderSwap',
    outputs: [
      { internalType: 'uint256', name: '_amountIn', type: 'uint256' },
      { internalType: 'uint256', name: '_amountOut', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'uint256', name: 'maxAmountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
          { internalType: 'address', name: 'allowanceTarget', type: 'address' },
          { internalType: 'address', name: 'swapper', type: 'address' },
          { internalType: 'bytes', name: 'swapData', type: 'bytes' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
          {
            components: [
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'shareBps', type: 'uint256' },
            ],
            internalType: 'struct Token.DistributionTarget[]',
            name: 'transferOut',
            type: 'tuple[]',
          },
          { internalType: 'address', name: 'unspentTokenInRecipient', type: 'address' },
          { internalType: 'bytes', name: 'misc', type: 'bytes' },
        ],
        internalType: 'struct ISwapPermit2Adapter.BuyOrderSwapParams',
        name: '_params',
        type: 'tuple',
      },
    ],
    name: 'buyOrderSwap',
    outputs: [
      { internalType: 'uint256', name: '_amountIn', type: 'uint256' },
      { internalType: 'uint256', name: '_amountOut', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            internalType: 'struct IPermit2.TokenPermissions[]',
            name: 'tokens',
            type: 'tuple[]',
          },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.BatchPermit',
        name: '_batchPermit',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'address', name: 'allowanceTarget', type: 'address' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.AllowanceTarget[]',
        name: '_allowanceTargets',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.ContractCall[]',
        name: '_contractCalls',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          {
            components: [
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'shareBps', type: 'uint256' },
            ],
            internalType: 'struct Token.DistributionTarget[]',
            name: 'distribution',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.TransferOut[]',
        name: '_transferOut',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: '_deadline', type: 'uint256' },
    ],
    name: 'executeWithBatchPermit',
    outputs: [
      { internalType: 'bytes[]', name: '_executionResults', type: 'bytes[]' },
      { internalType: 'uint256[]', name: '_tokenBalances', type: 'uint256[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.SinglePermit',
        name: '_permit',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'address', name: 'allowanceTarget', type: 'address' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.AllowanceTarget[]',
        name: '_allowanceTargets',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.ContractCall[]',
        name: '_contractCalls',
        type: 'tuple[]',
      },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          {
            components: [
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'shareBps', type: 'uint256' },
            ],
            internalType: 'struct Token.DistributionTarget[]',
            name: 'distribution',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IArbitraryExecutionPermit2Adapter.TransferOut[]',
        name: '_transferOut',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: '_deadline', type: 'uint256' },
    ],
    name: 'executeWithPermit',
    outputs: [
      { internalType: 'bytes[]', name: '_executionResults', type: 'bytes[]' },
      { internalType: 'uint256[]', name: '_tokenBalances', type: 'uint256[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
