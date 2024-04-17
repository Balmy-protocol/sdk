export default [
  {
    inputs: [
      {
        internalType: 'contract IDCAHub',
        name: '_hub',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint32',
        name: '_amountOfSwaps',
        type: 'uint32',
      },
      {
        internalType: 'uint32',
        name: '_swapInterval',
        type: 'uint32',
      },
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            internalType: 'enum IDCAPermissionManager.Permission[]',
            name: 'permissions',
            type: 'uint8[]',
          },
        ],
        internalType: 'struct IDCAPermissionManager.PermissionSet[]',
        name: '_permissions',
        type: 'tuple[]',
      },
      {
        internalType: 'bytes',
        name: '_miscellaneous',
        type: 'bytes',
      },
    ],
    name: 'depositWithBalanceOnContract',
    outputs: [
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },

  {
    inputs: [
      {
        internalType: 'contract IDCAHub',
        name: '_hub',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'uint32',
        name: '_newSwaps',
        type: 'uint32',
      },
    ],
    name: 'increasePositionWithBalanceOnContract',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes[]',
        name: '_data',
        type: 'bytes[]',
      },
    ],
    name: 'multicall',
    outputs: [
      {
        internalType: 'bytes[]',
        name: '_results',
        type: 'bytes[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IDCAPermissionManager',
        name: '_permissionManager',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            internalType: 'enum IDCAPermissionManager.Permission[]',
            name: 'permissions',
            type: 'uint8[]',
          },
        ],
        internalType: 'struct IDCAPermissionManager.PermissionSet[]',
        name: '_permissions',
        type: 'tuple[]',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_deadline',
        type: 'uint256',
      },
      {
        internalType: 'uint8',
        name: '_v',
        type: 'uint8',
      },
      {
        internalType: 'bytes32',
        name: '_r',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: '_s',
        type: 'bytes32',
      },
    ],
    name: 'permissionPermit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_nonce',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_deadline',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: '_signature',
        type: 'bytes',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'permitTakeFromCaller',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IDCAHub',
        name: '_hub',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'uint32',
        name: '_newSwaps',
        type: 'uint32',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'reducePosition',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_allowanceToken',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_value',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: '_swapData',
        type: 'bytes',
      },
      {
        internalType: 'address',
        name: '_tokenOut',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_minTokenOut',
        type: 'uint256',
      },
    ],
    name: 'runSwap',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_token',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'sendBalanceOnContractToRecipient',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IERC20',
        name: '_token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'takeFromCaller',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IDCAHub',
        name: '_hub',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_recipientUnswapped',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_recipientSwapped',
        type: 'address',
      },
    ],
    name: 'terminate',
    outputs: [
      {
        internalType: 'uint256',
        name: '_unswapped',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_swapped',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IDCAHub',
        name: '_hub',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_positionId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
    ],
    name: 'withdrawSwapped',
    outputs: [
      {
        internalType: 'uint256',
        name: '_swapped',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
