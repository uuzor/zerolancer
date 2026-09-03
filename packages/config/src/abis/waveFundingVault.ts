// Hand-written readable-name ABI for WaveFundingVault — do not edit.
export const WAVE_FUNDING_VAULT_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "UPGRADE_INTERFACE_VERSION",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "string", "internalType": "string" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "BPS_DENOMINATOR",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "builderPoints",
    "inputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" },
      { "name": "builder", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" },
      { "name": "builder", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimableShare",
    "inputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" },
      { "name": "builder", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "closeWave",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" },
      { "name": "waveId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createProgram",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "genesisPool", "type": "uint256", "internalType": "uint256" },
      { "name": "numWaves", "type": "uint256", "internalType": "uint256" },
      { "name": "feeBps", "type": "uint16", "internalType": "uint16" },
      { "name": "treasury", "type": "address", "internalType": "address" },
      { "name": "specHash", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "distributed",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "emergencyWithdraw",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" },
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "finalizeWave",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" },
      { "name": "waveId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      { "name": "admin", "type": "address", "internalType": "address" },
      { "name": "treasury", "type": "address", "internalType": "address" },
      { "name": "signer", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "openWave",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pooled",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "programOf",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct WaveFundingVault.Program",
        "components": [
          { "name": "organizer", "type": "address", "internalType": "address" },
          { "name": "token", "type": "address", "internalType": "address" },
          { "name": "genesisPool", "type": "uint256", "internalType": "uint256" },
          { "name": "feeBps", "type": "uint16", "internalType": "uint16" },
          { "name": "treasury", "type": "address", "internalType": "address" },
          { "name": "numWaves", "type": "uint256", "internalType": "uint256" },
          { "name": "specHash", "type": "bytes32", "internalType": "bytes32" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proxiableUUID",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "bytes32", "internalType": "bytes32" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveDispute",
    "inputs": [
      { "name": "taskId", "type": "uint256", "internalType": "uint256" },
      { "name": "winner", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPoints",
    "inputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" },
      { "name": "builder", "type": "address", "internalType": "address" },
      { "name": "points", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "totalWavePoints",
    "inputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      { "name": "newOwner", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "upgradeToAndCall",
    "inputs": [
      { "name": "newImplementation", "type": "address", "internalType": "address" },
      { "name": "data", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "waveCount",
    "inputs": [
      { "name": "programId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "waveOf",
    "inputs": [
      { "name": "waveId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct WaveFundingVault.Wave",
        "components": [
          { "name": "programId", "type": "uint256", "internalType": "uint256" },
          { "name": "waveSeq", "type": "uint256", "internalType": "uint256" },
          { "name": "budget", "type": "uint256", "internalType": "uint256" },
          { "name": "totalPoints", "type": "uint256", "internalType": "uint256" },
          { "name": "status", "type": "uint8", "internalType": "enum WaveFundingVault.WaveStatus" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      { "name": "waveId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "builder", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Deposited",
    "inputs": [
      { "name": "programId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "from", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmergencyWithdrawn",
    "inputs": [
      { "name": "programId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "to", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      { "name": "version", "type": "uint64", "indexed": false, "internalType": "uint64" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      { "name": "previousOwner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "newOwner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Paused",
    "inputs": [
      { "name": "account", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PointsSet",
    "inputs": [
      { "name": "waveId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "builder", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "points", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProgramCreated",
    "inputs": [
      { "name": "programId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "organizer", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "token", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Resolved",
    "inputs": [
      { "name": "taskId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "winner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TreasurySet",
    "inputs": [
      { "name": "treasury", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Unpaused",
    "inputs": [
      { "name": "account", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Upgraded",
    "inputs": [
      { "name": "implementation", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WaveClosed",
    "inputs": [
      { "name": "programId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "waveId", "type": "uint256", "indexed": true, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WaveFinalized",
    "inputs": [
      { "name": "programId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "waveId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "budget", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WaveOpened",
    "inputs": [
      { "name": "programId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "waveId", "type": "uint256", "indexed": true, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC1967InvalidImplementation",
    "inputs": [
      { "name": "implementation", "type": "address", "internalType": "address" }
    ]
  },
  {
    "type": "error",
    "name": "ERC1967NonPayable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EnforcedPause",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExpectedPause",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientPool",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidInitialization",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitializing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotSigner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      { "name": "owner", "type": "address", "internalType": "address" }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      { "name": "account", "type": "address", "internalType": "address" }
    ]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" }
    ]
  },
  {
    "type": "error",
    "name": "UUPSUnauthorizedCallContext",
    "inputs": [
      { "name": "slot", "type": "bytes32", "internalType": "bytes32" }
    ]
  },
  {
    "type": "error",
    "name": "UUPSUnsupportedProxiableUUID",
    "inputs": [
      { "name": "slot", "type": "bytes32", "internalType": "bytes32" }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  }
] as const;
