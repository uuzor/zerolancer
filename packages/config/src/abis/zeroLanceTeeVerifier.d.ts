export declare const ZEROLANCE_TEE_VERIFIER_ABI: readonly [{
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
    readonly name: "cancelSignerProposal";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "cleanExpiredProofs";
    readonly inputs: readonly [{
        readonly name: "proofNonces";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "domainSeparator";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "executeSigner";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "initialize";
    readonly inputs: readonly [{
        readonly name: "_owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "_signer";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "_maxProofAge";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "maxProofAgeSeconds";
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
    readonly name: "pendingSigner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "proposeSigner";
    readonly inputs: readonly [{
        readonly name: "newSigner";
        readonly type: "address";
        readonly internalType: "address";
    }];
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
    readonly name: "recoverVerdictSigner";
    readonly inputs: readonly [{
        readonly name: "v";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceTeeVerifier.Verdict";
        readonly components: readonly [{
            readonly name: "taskId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deliverableHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "passed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "score";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "validUntil";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "registeredSigner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
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
    readonly name: "verdictMessageHash";
    readonly inputs: readonly [{
        readonly name: "v";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceTeeVerifier.Verdict";
        readonly components: readonly [{
            readonly name: "taskId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deliverableHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "passed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "score";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "validUntil";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "verdictStructHash";
    readonly inputs: readonly [{
        readonly name: "v";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceTeeVerifier.Verdict";
        readonly components: readonly [{
            readonly name: "taskId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deliverableHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "passed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "score";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "validUntil";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "pure";
}, {
    readonly type: "function";
    readonly name: "verifyTransferValidity";
    readonly inputs: readonly [{
        readonly name: "proofs";
        readonly type: "tuple[]";
        readonly internalType: "struct TransferValidityProof[]";
        readonly components: readonly [{
            readonly name: "accessProof";
            readonly type: "tuple";
            readonly internalType: "struct AccessProof";
            readonly components: readonly [{
                readonly name: "dataHash";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "targetPubkey";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "nonce";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "proof";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "validUntil";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }];
        }, {
            readonly name: "ownershipProof";
            readonly type: "tuple";
            readonly internalType: "struct OwnershipProof";
            readonly components: readonly [{
                readonly name: "oracleType";
                readonly type: "uint8";
                readonly internalType: "enum OracleType";
            }, {
                readonly name: "dataHash";
                readonly type: "bytes32";
                readonly internalType: "bytes32";
            }, {
                readonly name: "sealedKey";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "targetPubkey";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "nonce";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "proof";
                readonly type: "bytes";
                readonly internalType: "bytes";
            }, {
                readonly name: "validUntil";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }];
        }];
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "nft";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "outputs";
        readonly type: "tuple[]";
        readonly internalType: "struct TransferValidityProofOutput[]";
        readonly components: readonly [{
            readonly name: "dataHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "sealedKey";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "targetPubkey";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "wantedKey";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "accessAssistant";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "accessProofNonce";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "ownershipProofNonce";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "verifyVerdict";
    readonly inputs: readonly [{
        readonly name: "verdict";
        readonly type: "tuple";
        readonly internalType: "struct IZeroLanceTeeVerifier.Verdict";
        readonly components: readonly [{
            readonly name: "taskId";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "deliverableHash";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "passed";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "score";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "validUntil";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "valid";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "nonpayable";
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
    readonly name: "SignerExecuted";
    readonly inputs: readonly [{
        readonly name: "oldSigner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "newSigner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "SignerProposalCancelled";
    readonly inputs: readonly [{
        readonly name: "cancelledSigner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "SignerProposed";
    readonly inputs: readonly [{
        readonly name: "newSigner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "executableAt";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
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
    readonly name: "AxiomInvalidAccessProof";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AxiomInvalidOwnershipProof";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AxiomInvalidSigner";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AxiomProofExpired";
    readonly inputs: readonly [{
        readonly name: "validUntil";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "blockTimestamp";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "AxiomValidUntilTooFar";
    readonly inputs: readonly [{
        readonly name: "validUntil";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "blockTimestamp";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "maxProofAgeSeconds";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
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
    readonly name: "ECDSAInvalidSignature";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ECDSAInvalidSignatureLength";
    readonly inputs: readonly [{
        readonly name: "length";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ECDSAInvalidSignatureS";
    readonly inputs: readonly [{
        readonly name: "s";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
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
    readonly name: "FailedInnerCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidInitialization";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NoPendingProposal";
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
    readonly name: "ProofAlreadyUsed";
    readonly inputs: readonly [{
        readonly name: "proofHash";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
}, {
    readonly type: "error";
    readonly name: "ProofFieldMismatch";
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
    readonly name: "ZeroAddress";
    readonly inputs: readonly [];
}];
//# sourceMappingURL=zeroLanceTeeVerifier.d.ts.map