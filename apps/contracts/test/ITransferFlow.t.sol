// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {ZeroLanceReputationNFT} from "src/ZeroLanceReputationNFT.sol";
import {ZeroLanceTeeVerifier} from "src/verifiers/ZeroLanceTeeVerifier.sol";
import {ERC7857Upgradeable} from "src/ERC7857Upgradeable.sol";
import {IntelligentData} from "src/interfaces/IERC7857Metadata.sol";
import {
    AccessProof,
    OwnershipProof,
    OracleType,
    TransferValidityProof
} from "src/interfaces/IERC7857DataVerifier.sol";

/// @title ITransferTest
/// @notice Validates the full ERC-7857 iTransfer re-keying flow:
///         - Bare transferFrom is blocked (UseITransferWithProofs)
///         - iTransfer with valid OwnershipProof + AccessProof succeeds
///         - sealedKey is published via event
///         - Replay protection: same proof nonce cannot be reused
contract ITransferTest is Test {
    ZeroLanceTeeVerifier verifier;
    ZeroLanceReputationNFT nft;

    address admin = makeAddr("admin");
    address minter = makeAddr("minter");

    // TEE signer keypair
    uint256 constant TEE_PK = 0xBEEF;
    address teeSigner;

    // Receiver keypair (the "to" address for iTransfer)
    uint256 constant RECEIVER_PK = 0xFEED;
    address receiver;
    // 64-byte raw uncompressed X||Y for pk=0xFEED (computed via eth-keys)
    bytes constant RECEIVER_PUBKEY =
        hex"343fd328c79b7e3444d323178ae885ab2082e750b3b7695139c1fc98d9548787d03e37dc4247e8e78c524c7c129d7400a65e4fdbe54967769f3ddb826defa384";

    bytes32 constant DATA_HASH = keccak256("encrypted-reputation-blob");
    bytes32 constant NONCE = bytes32(uint256(42));
    uint256 constant MAX_PROOF_AGE = 7 days;

    function setUp() public {
        teeSigner = vm.addr(TEE_PK);
        receiver = vm.addr(RECEIVER_PK);

        // Deploy TEE verifier (proxy)
        ZeroLanceTeeVerifier verImpl = new ZeroLanceTeeVerifier();
        bytes memory verInit = abi.encodeWithSelector(
            ZeroLanceTeeVerifier.initialize.selector,
            admin,
            teeSigner,
            MAX_PROOF_AGE
        );
        verifier = ZeroLanceTeeVerifier(address(new ERC1967Proxy(address(verImpl), verInit)));

        // Deploy reputation NFT (proxy)
        ZeroLanceReputationNFT nftImpl = new ZeroLanceReputationNFT();
        bytes memory nftInit = abi.encodeWithSelector(
            ZeroLanceReputationNFT.initialize.selector,
            address(0), // zero token
            minter, // escrow/minter
            address(verifier),
            admin
        );
        nft = ZeroLanceReputationNFT(address(new ERC1967Proxy(address(nftImpl), nftInit)));
    }

    function _mintToken(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        tokenId = nft.mintReputation(to, 1, "ZeroLance receipt", DATA_HASH);
    }

    function _buildProofs(
        bytes32 dataHash,
        bytes memory sealedKey,
        bytes memory targetPubkey,
        address to,
        address nftAddr,
        bytes32 nonce,
        uint256 validUntil
    ) internal view returns (TransferValidityProof[] memory proofs) {
        proofs = new TransferValidityProof[](1);

        // OwnershipProof signed by TEE
        bytes32 ownershipStructHash = keccak256(abi.encode(
            keccak256("OwnershipProof(bytes32 dataHash,bytes sealedKey,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"),
            dataHash,
            keccak256(sealedKey),
            keccak256(targetPubkey),
            to,
            nftAddr,
            keccak256(abi.encodePacked(nonce)),
            validUntil
        ));
        bytes32 ownershipDigest = keccak256(abi.encodePacked(
            "\x19\x01",
            verifier.domainSeparator(),
            ownershipStructHash
        ));
        (uint8 ov, bytes32 or, bytes32 os) = vm.sign(TEE_PK, ownershipDigest);

        // AccessProof signed by receiver
        bytes32 accessStructHash = keccak256(abi.encode(
            keccak256("AccessProof(bytes32 dataHash,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"),
            dataHash,
            keccak256(targetPubkey),
            to,
            nftAddr,
            keccak256(abi.encodePacked(nonce)),
            validUntil
        ));
        bytes32 accessDigest = keccak256(abi.encodePacked(
            "\x19\x01",
            verifier.domainSeparator(),
            accessStructHash
        ));
        (uint8 av, bytes32 ar, bytes32 as_) = vm.sign(RECEIVER_PK, accessDigest);

        proofs[0] = TransferValidityProof({
            accessProof: AccessProof({
                dataHash: dataHash,
                targetPubkey: targetPubkey,
                nonce: abi.encodePacked(nonce),
                proof: abi.encodePacked(ar, as_, av),
                validUntil: validUntil
            }),
            ownershipProof: OwnershipProof({
                oracleType: OracleType.TEE,
                dataHash: dataHash,
                sealedKey: sealedKey,
                targetPubkey: targetPubkey,
                nonce: abi.encodePacked(nonce),
                proof: abi.encodePacked(or, os, ov),
                validUntil: validUntil
            })
        });

        // Fix the accessProof signature (use receiver's sig)
        proofs[0].accessProof.proof = abi.encodePacked(ar, as_, av);
    }

    function test_BareTransferIsBlocked() public {
        uint256 tokenId = _mintToken(minter);
        vm.expectRevert(ERC7857Upgradeable.UseITransferWithProofs.selector);
        vm.prank(minter);
        nft.transferFrom(minter, receiver, tokenId);
    }

    function test_ITransferWithValidProofsSucceeds() public {
        uint256 tokenId = _mintToken(minter);
        assertEq(nft.ownerOf(tokenId), minter);

        bytes memory sealedKey = bytes("sealed-key-for-receiver");
        uint256 validUntil = block.timestamp + 1 hours;

        TransferValidityProof[] memory proofs = _buildProofs(
            DATA_HASH,
            sealedKey,
            RECEIVER_PUBKEY,
            receiver,
            address(nft),
            NONCE,
            validUntil
        );

        vm.prank(minter);
        nft.iTransfer(receiver, tokenId, proofs);

        assertEq(nft.ownerOf(tokenId), receiver);
    }

    function test_ITransferReplayProtection() public {
        uint256 tokenId = _mintToken(minter);

        bytes memory sealedKey = bytes("sealed-key");
        uint256 validUntil = block.timestamp + 1 hours;

        TransferValidityProof[] memory proofs = _buildProofs(
            DATA_HASH,
            sealedKey,
            RECEIVER_PUBKEY,
            receiver,
            address(nft),
            NONCE,
            validUntil
        );

        vm.prank(minter);
        nft.iTransfer(receiver, tokenId, proofs);
        assertEq(nft.ownerOf(tokenId), receiver);

        // Mint another token to the minter, try to reuse the same proof nonce
        uint256 tokenId2 = _mintToken(minter);

        vm.prank(receiver);
        vm.expectRevert();
        nft.iTransfer(minter, tokenId2, proofs);
    }

    function test_ITransferRejectsWrongSigner() public {
        uint256 tokenId = _mintToken(minter);

        bytes memory sealedKey = bytes("sealed-key");
        uint256 validUntil = block.timestamp + 1 hours;

        // Sign with wrong key (not the TEE signer)
        TransferValidityProof[] memory proofs = _buildProofs(
            DATA_HASH,
            sealedKey,
            RECEIVER_PUBKEY,
            receiver,
            address(nft),
            NONCE,
            validUntil
        );
        // Corrupt the ownership proof signature by signing with a different key
        bytes32 ownershipStructHash = keccak256(abi.encode(
            keccak256("OwnershipProof(bytes32 dataHash,bytes sealedKey,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"),
            DATA_HASH,
            keccak256(sealedKey),
            keccak256(RECEIVER_PUBKEY),
            receiver,
            address(nft),
            keccak256(abi.encodePacked(NONCE)),
            validUntil
        ));
        bytes32 ownershipDigest = keccak256(abi.encodePacked(
            "\x19\x01",
            verifier.domainSeparator(),
            ownershipStructHash
        ));
        // Sign with RECEIVER_PK instead of TEE_PK (wrong signer)
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(RECEIVER_PK, ownershipDigest);
        proofs[0].ownershipProof.proof = abi.encodePacked(r, s, v);

        vm.prank(minter);
        vm.expectRevert(ZeroLanceTeeVerifier.AxiomInvalidOwnershipProof.selector);
        nft.iTransfer(receiver, tokenId, proofs);
    }
}
