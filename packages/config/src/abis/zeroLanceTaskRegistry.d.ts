export declare const ZEROLANCE_TASK_REGISTRY_ABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [];
    readonly stateMutability: "nonpayable";
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
    readonly name: "assignTask";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "freelancer";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "authorizedSetter";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "createTask";
    readonly inputs: readonly [{
        readonly name: "specHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "category";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceTaskRegistry.TaskCategory";
    }, {
        readonly name: "paymentToken";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "reward";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "deadline";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "repoUrl";
        readonly type: "string";
        readonly internalType: "string";
    }, {
        readonly name: "issueNumber";
        readonly type: "uint64";
        readonly internalType: "uint64";
    }, {
        readonly name: "coverageGateBps";
        readonly type: "uint16";
        readonly internalType: "uint16";
    }];
    readonly outputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "initialize";
    readonly inputs: readonly [{
        readonly name: "admin";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "authorizedSetters_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "nextTaskId";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
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
    readonly name: "pause";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
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
    readonly name: "setAuthorizedSetter";
    readonly inputs: readonly [{
        readonly name: "authorizedSetters_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "setStatus";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "status";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceTaskRegistry.TaskStatus";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "specHashOf";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "submitDeliverable";
    readonly inputs: readonly [{
        readonly name: "taskId";
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
    readonly name: "taskOf";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceTaskRegistry.Task";
        readonly components: readonly [{
            readonly name: "client";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "freelancer";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "status";
            readonly type: "uint8";
            readonly internalType: "enum IZeroLanceTaskRegistry.TaskStatus";
        }, {
            readonly name: "category";
            readonly type: "uint8";
            readonly internalType: "enum IZeroLanceTaskRegistry.TaskCategory";
        }, {
            readonly name: "specHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "deliverableHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "paymentToken";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "reward";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deadline";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "retryDeadline";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "repoUrl";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "issueNumber";
            readonly type: "uint64";
            readonly internalType: "uint64";
        }, {
            readonly name: "prNumber";
            readonly type: "uint64";
            readonly internalType: "uint64";
        }, {
            readonly name: "coverageGateBps";
            readonly type: "uint16";
            readonly internalType: "uint16";
        }];
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
    readonly name: "unpause";
    readonly inputs: readonly [];
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
    readonly name: "DeliverableSubmitted";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "freelancer";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
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
    readonly name: "TaskAssigned";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "freelancer";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "TaskCreated";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "client";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "specHash";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "category";
        readonly type: "uint8";
        readonly indexed: false;
        readonly internalType: "enum IZeroLanceTaskRegistry.TaskCategory";
    }, {
        readonly name: "reward";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "deadline";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "repoUrl";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "issueNumber";
        readonly type: "uint64";
        readonly indexed: false;
        readonly internalType: "uint64";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "TaskStatusChanged";
    readonly inputs: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "status";
        readonly type: "uint8";
        readonly indexed: false;
        readonly internalType: "enum IZeroLanceTaskRegistry.TaskStatus";
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
    readonly name: "AlreadyAssigned";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "DeadlineInPast";
    readonly inputs: readonly [];
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
    readonly name: "EmptyRepoUrl";
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
    readonly name: "InvalidCoverageGate";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidInitialization";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotAssigned";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotClient";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotFreelancer";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotInitializing";
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
    readonly name: "ReentrancyGuardReentrantCall";
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
    readonly name: "WrongStatus";
    readonly inputs: readonly [{
        readonly name: "expected";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceTaskRegistry.TaskStatus";
    }, {
        readonly name: "actual";
        readonly type: "uint8";
        readonly internalType: "enum IZeroLanceTaskRegistry.TaskStatus";
    }];
}, {
    readonly type: "error";
    readonly name: "ZeroAddress";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ZeroAmount";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ZeroSpecHash";
    readonly inputs: readonly [];
}];
//# sourceMappingURL=zeroLanceTaskRegistry.d.ts.map