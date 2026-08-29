export declare const ZEROLANCE_WAVE_PROGRAM_ABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "BPS_DENOMINATOR";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "UPGRADE_INTERFACE_VERSION";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "approveRepo";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "repoHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "allowed";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "approved";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "repoHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "awardBase";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "contributor";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "points";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "refHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "awardCommunity";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "contributor";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "points";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "refHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "awardCompliment";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "contributor";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "points";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "refHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "cancelPause";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "claim";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "claimableShare";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "claimed";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "closeEvaluation";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "closeWave";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "createWaveProgram";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "genesisPool_";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "numWaves";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "buildWindow";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "evalWindow";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "complimentWindow";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "budgetMethod";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceWaveProgram.BudgetMethod";
    }, {
        readonly name: "feeBps";
        readonly type: "uint16";
        readonly internalType: "uint16";
    }, {
        readonly name: "treasury";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "depositPool";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "emergencyWithdraw";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "executePause";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "finalizeWave";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "grantAwarder";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "awarder";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "allowed";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "initialize";
    readonly inputs: readonly [{
        readonly name: "admin";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "openEvaluation";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "openWave";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "owner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "paused";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "pointsLedger";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract IPointsLedger";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "program";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceWaveProgram.Program";
        readonly components: readonly [{
            readonly name: "token";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "organizer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "genesisPool";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "numWaves";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "buildWindow";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "evalWindow";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "complimentWindow";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "budgetMethod";
            readonly type: "uint8";
            readonly internalType: "enum IZeroLanceWaveProgram.BudgetMethod";
        }, {
            readonly name: "feeBps";
            readonly type: "uint16";
            readonly internalType: "uint16";
        }, {
            readonly name: "treasury";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "points";
            readonly type: "address";
            readonly internalType: "contract IPointsLedger";
        }, {
            readonly name: "currentWave";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "waveSeq";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "initialized";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "proposePause";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "proxiableUUID";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "remainingPool";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "renounceOwnership";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "totalClaimable";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "transferOwnership";
    readonly inputs: readonly [{
        readonly name: "newOwner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "upgradeToAndCall";
    readonly inputs: readonly [{
        readonly name: "newImplementation";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "data";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "wave";
    readonly inputs: readonly [{
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceWaveProgram.Wave";
        readonly components: readonly [{
            readonly name: "programId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "status";
            readonly type: "uint8";
            readonly internalType: "enum IZeroLanceWaveProgram.WaveStatus";
        }, {
            readonly name: "buildEndAt";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "evalEndAt";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "complimentEndAt";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "budget";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "totalDistributed";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "finalized";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "waveBudget";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "EmergencyWithdrawn";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "EvaluationClosed";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "EvaluationOpened";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "evalEndAt";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Initialized";
    readonly inputs: readonly [{
        readonly name: "version";
        readonly type: "uint64";
        readonly indexed: false;
        readonly internalType: "uint64";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OwnershipTransferred";
    readonly inputs: readonly [{
        readonly name: "previousOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "newOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PauseProposed";
    readonly inputs: readonly [{
        readonly name: "effectiveAt";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Paused";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PoolDeposited";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "funder";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "ProgramCreated";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "organizer";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RepoApprovalChanged";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "repoHash";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "allowed";
        readonly type: "bool";
        readonly indexed: false;
        readonly internalType: "bool";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Unpaused";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Upgraded";
    readonly inputs: readonly [{
        readonly name: "implementation";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "WaveClaimed";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "contributor";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "WaveClosed";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "WaveFinalized";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "budget";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "WaveOpened";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "buildEndAt";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AddressEmptyCode";
    readonly inputs: readonly [{
        readonly name: "target";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "AddressInsufficientBalance";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "AlreadyClaimed";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "DelayNotElapsed";
    readonly inputs: readonly [{
        readonly name: "remaining";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC1967InvalidImplementation";
    readonly inputs: readonly [{
        readonly name: "implementation";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC1967NonPayable";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "EnforcedPause";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ExpectedPause";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "FailedInnerCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidInitialization";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidParams";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NoPendingProposal";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotEnoughPool";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotInitialized";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotInitializing";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotOrganizer";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "OwnableInvalidOwner";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "OwnableUnauthorizedAccount";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ProgramNotFound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ReentrancyGuardReentrantCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SafeERC20FailedOperation";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "UUPSUnauthorizedCallContext";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "UUPSUnsupportedProxiableUUID";
    readonly inputs: readonly [{
        readonly name: "slot";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
}, {
    readonly type: "error";
    readonly name: "WaveNotFound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "WrongStatus";
    readonly inputs: readonly [{
        readonly name: "expected";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceWaveProgram.WaveStatus";
    }, {
        readonly name: "actual";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceWaveProgram.WaveStatus";
    }];
}, {
    readonly type: "error";
    readonly name: "ZeroAddress";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ZeroBudget";
    readonly inputs: readonly [];
}];
//# sourceMappingURL=zeroLanceWaveProgram.d.ts.map