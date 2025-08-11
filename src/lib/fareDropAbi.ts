export const FAREDROP_ABI = [
    { "inputs": [], "name": "BadValue", "type": "error" },
    { "inputs": [], "name": "EmptyArrays", "type": "error" },
    { "inputs": [], "name": "LengthMismatch", "type": "error" },
    { "inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error" },
    {
      "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
      "name": "SafeERC20FailedOperation", "type": "error"
    },
    {
      "anonymous": false, "name": "AirdropERC20", "type": "event",
      "inputs": [
        { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
        { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
        { "indexed": false, "internalType": "uint256", "name": "count", "type": "uint256" },
        { "indexed": false, "internalType": "uint256", "name": "total", "type": "uint256" }
      ]
    },
    {
      "anonymous": false, "name": "AirdropNative", "type": "event",
      "inputs": [
        { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
        { "indexed": false, "internalType": "uint256", "name": "count", "type": "uint256" },
        { "indexed": false, "internalType": "uint256", "name": "total", "type": "uint256" }
      ]
    },
    {
      "inputs": [
        { "internalType": "address", "name": "token", "type": "address" },
        { "internalType": "address[]", "name": "recipients", "type": "address[]" },
        { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
      ],
      "name": "airdropERC20", "outputs": [], "stateMutability": "nonpayable", "type": "function"
    },
    {
      "inputs": [
        { "internalType": "address[]", "name": "recipients", "type": "address[]" },
        { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
      ],
      "name": "airdropNative", "outputs": [], "stateMutability": "payable", "type": "function"
    }
  ] as const;
  