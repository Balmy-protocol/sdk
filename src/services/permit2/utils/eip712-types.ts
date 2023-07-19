export const PERMIT2_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { type: 'TokenPermissions', name: 'permitted' },
    { type: 'address', name: 'spender' },
    { type: 'uint256', name: 'nonce' },
    { type: 'uint256', name: 'deadline' },
  ],
  TokenPermissions: [
    { type: 'address', name: 'token' },
    { type: 'uint256', name: 'amount' },
  ],
};

export const PERMIT2_BATCH_TRANSFER_FROM_TYPES = {
  PermitBatchTransferFrom: [
    { type: 'TokenPermissions[]', name: 'permitted' },
    { type: 'address', name: 'spender' },
    { type: 'uint256', name: 'nonce' },
    { type: 'uint256', name: 'deadline' },
  ],
  TokenPermissions: [
    { type: 'address', name: 'token' },
    { type: 'uint256', name: 'amount' },
  ],
};
