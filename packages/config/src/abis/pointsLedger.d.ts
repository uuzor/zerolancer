export declare const ZEROLANCE_POINTS_LEDGER_ABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "owner_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "awardBase";
    readonly inputs: readonly [{
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
    readonly name: "contributorPoints";
    readonly inputs: readonly [{
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "contributor";
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
    readonly name: "freezeWave";
    readonly inputs: readonly [{
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "isFrozen";
    readonly inputs: readonly [{
        readonly name: "waveId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
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
    readonly name: "setWaveOperator";
    readonly inputs: readonly [{
        readonly name: "op";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "totalPoints";
    readonly inputs: readonly [{
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
    readonly name: "waveOperator";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "PointsAwarded";
    readonly inputs: readonly [{
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
        readonly name: "kind";
        readonly type: "uint8";
        readonly indexed: false;
        readonly internalType: "enum IPointsLedger.AwardKind";
    }, {
        readonly name: "points";
        readonly type: "uint96";
        readonly indexed: false;
        readonly internalType: "uint96";
    }, {
        readonly name: "refHash";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "NotAuthorized";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "WaveFrozen";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ZeroAddress";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ZeroPoints";
    readonly inputs: readonly [];
}];
//# sourceMappingURL=pointsLedger.d.ts.map