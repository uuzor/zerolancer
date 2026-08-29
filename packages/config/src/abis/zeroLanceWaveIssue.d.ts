export declare const ZEROLANCE_WAVE_ISSUE_ABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "MAX_BASE_POINTS";
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
    readonly name: "acceptRepo";
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
    readonly name: "addCompliment";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "points";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "claimIssue";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "confirmMerge";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "createIssue";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "repoHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "specHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "basePoints";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "complexity";
        readonly type: "uint64";
        readonly internalType: "uint64";
    }];
    readonly outputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "currentWave";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "isOpen";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "initialize";
    readonly inputs: readonly [{
        readonly name: "admin";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "waveProgram_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "issue";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceWaveIssue.Issue";
        readonly components: readonly [{
            readonly name: "programId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "waveId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "maintainer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "builder";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "specHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "repoHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "basePoints";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "bonusPoints";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deliveredPr";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deliverableHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "complexity";
            readonly type: "uint64";
            readonly internalType: "uint64";
        }, {
            readonly name: "state";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "pointsAwarded";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }];
    readonly stateMutability: "view";
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
    readonly name: "renounceOwnership";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "setIssuePoints";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "basePoints";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "setManager";
    readonly inputs: readonly [{
        readonly name: "m";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "submitPr";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "deliverableHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "prNumber";
        readonly type: "uint64";
        readonly internalType: "uint64";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
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
    readonly type: "event";
    readonly name: "ComplimentAdded";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "points";
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
    readonly name: "IssueClaimed";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "builder";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "waveId";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "IssueCreated";
    readonly inputs: readonly [{
        readonly name: "programId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "issueId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "maintainer";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "basePoints";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "repoHash";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "IssueMerged";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "builder";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "points";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "IssuePointsSet";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "basePoints";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "IssuePrSubmitted";
    readonly inputs: readonly [{
        readonly name: "issueId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "deliverableHash";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }, {
        readonly name: "prNumber";
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
    readonly name: "RepoAccepted";
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
    readonly type: "error";
    readonly name: "AddressEmptyCode";
    readonly inputs: readonly [{
        readonly name: "target";
        readonly type: "address";
        readonly internalType: "address";
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
    readonly name: "InvalidPoints";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "IssueNotFound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NoWaveOpen";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotBuilder";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotInitializing";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotMaintainer";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotManager";
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
    readonly name: "PointsLocked";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ReentrancyGuardReentrantCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "RepoNotAccepted";
    readonly inputs: readonly [];
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
    readonly name: "WrongIssueState";
    readonly inputs: readonly [{
        readonly name: "expected";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceWaveIssue.IssueState";
    }, {
        readonly name: "actual";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceWaveIssue.IssueState";
    }];
}];
//# sourceMappingURL=zeroLanceWaveIssue.d.ts.map