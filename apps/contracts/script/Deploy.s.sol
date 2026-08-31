// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ZeroLanceToken} from "../src/ZeroLanceToken.sol";
import {ZeroLanceTeeVerifier} from "../src/verifiers/ZeroLanceTeeVerifier.sol";
import {ZeroLanceTaskRegistry} from "../src/ZeroLanceTaskRegistry.sol";
import {ZeroLanceArbitration} from "../src/ZeroLanceArbitration.sol";
import {ZeroLanceReputationNFT} from "../src/ZeroLanceReputationNFT.sol";
import {ZeroLanceTaskEscrow} from "../src/ZeroLanceTaskEscrow.sol";
import {ZeroLanceTaskVerifier} from "../src/ZeroLanceTaskVerifier.sol";

/// @notice Deploys the full ZeroLance protocol suite behind UUPS proxies and wires
///         the cross-contract references. The task escrow + task verifier replace
///         the old monolithic ZeroLanceEscrowVault: the escrow holds USDC and
///         releases it; the verifier owns the deliverable/verdict/dispute
///         orchestration. Writes a deployment manifest to
///         ../../docs/deployments/<network>.json.
contract Deploy is Script {
    struct Addrs {
        address usdc;
        address zeroToken;
        address teeVerifier;
        address taskRegistry;
        address taskEscrow;
        address taskVerifier;
        address arbitration;
        address reputationNFT;
    }

    function run() external returns (Addrs memory a) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address admin = vm.addr(pk);
        address oracleSigner = vm.envOr("ZERO_TEE_SIGNER", admin);
        address treasury = vm.envOr("ZERO_TREASURY", admin);

        vm.startBroadcast(pk);

        // 1. Payment token (devnet mock).
        MockUSDC usdc = new MockUSDC();

        // 2. $ZERO governance/utility token.
        ZeroLanceToken zeroImpl = new ZeroLanceToken();
        ZeroLanceToken zeroToken = ZeroLanceToken(
            address(new ERC1967Proxy(address(zeroImpl), abi.encodeCall(ZeroLanceToken.initialize, (admin, 1_000_000e18, 100_000_000e18))))
        );

        // 3. TEE verifier (signs AI verdicts + re-keys reputation metadata).
        ZeroLanceTeeVerifier verifierImpl = new ZeroLanceTeeVerifier();
        ZeroLanceTeeVerifier teeVerifier = ZeroLanceTeeVerifier(
            address(
                new ERC1967Proxy(
                    address(verifierImpl),
                    abi.encodeCall(ZeroLanceTeeVerifier.initialize, (admin, oracleSigner, 7 days))
                )
            )
        );

        // 4. Reputation NFT (depends on $ZERO; escrow reference set after escrow deploy).
        ZeroLanceReputationNFT repImpl = new ZeroLanceReputationNFT();
        ZeroLanceReputationNFT reputationNFT = ZeroLanceReputationNFT(
            address(
                new ERC1967Proxy(
                    address(repImpl),
                    abi.encodeCall(ZeroLanceReputationNFT.initialize, (address(zeroToken), admin, address(teeVerifier), admin))
                )
            )
        );

        // 5. Task registry (authorized setter set after escrow deploy).
        ZeroLanceTaskRegistry registryImpl = new ZeroLanceTaskRegistry();
        ZeroLanceTaskRegistry taskRegistry = ZeroLanceTaskRegistry(
            address(new ERC1967Proxy(address(registryImpl), abi.encodeCall(ZeroLanceTaskRegistry.initialize, (admin, admin))))
        );

        // 6. Arbitration (depends on task registry, reputation NFT, $ZERO; escrow
        //    reference set after escrow deploy).
        ZeroLanceArbitration arbImpl = new ZeroLanceArbitration();
        ZeroLanceArbitration arbitration = ZeroLanceArbitration(
            address(
                new ERC1967Proxy(
                    address(arbImpl),
                    abi.encodeCall(
                        ZeroLanceArbitration.initialize,
                        (admin, address(taskRegistry), address(reputationNFT), address(zeroToken), 10e18, 67, admin)
                    )
                )
            )
        );

        // 7. Task escrow (depends on task registry + verifier + arbitration).
        //    Funds-only vault. The escrow takes the task registry + verifier +
        //    arbitration addresses at initialize time; the verifier is wired
        //    after we deploy the TaskVerifier below.
        ZeroLanceTaskEscrow escrowImpl = new ZeroLanceTaskEscrow();
        ZeroLanceTaskEscrow taskEscrow = ZeroLanceTaskEscrow(
            address(
                new ERC1967Proxy(
                    address(escrowImpl),
                    abi.encodeCall(
                        ZeroLanceTaskEscrow.initialize,
                        (admin, address(taskRegistry), address(0), address(arbitration))
                    )
                )
            )
        );

        // 8. Task verifier (depends on registry, escrow, tee verifier, reputation
        //    NFT, arbitration). Owns deliverable submission, verdict relay,
        //    dispute opening, and reputation minting.
        ZeroLanceTaskVerifier taskVerifierImpl = new ZeroLanceTaskVerifier();
        ZeroLanceTaskVerifier taskVerifier = ZeroLanceTaskVerifier(
            address(
                new ERC1967Proxy(
                    address(taskVerifierImpl),
                    abi.encodeCall(
                        ZeroLanceTaskVerifier.initialize,
                        (admin, address(taskRegistry), address(teeVerifier), address(taskEscrow), address(reputationNFT), address(arbitration))
                    )
                )
            )
        );

        // 9. Wire cross-contract references. Arbitration and the escrow depend on
        //    each other's addresses (escrow → verifier → arbitration), so we set
        //    them in dependency order here.
        taskRegistry.setAuthorizedSetter(address(taskEscrow));
        arbitration.setEscrow(address(taskEscrow));
        taskEscrow.setVerifier(address(taskVerifier));
        reputationNFT.setEscrow(address(taskEscrow));
        reputationNFT.grantRole(reputationNFT.MINTER_ROLE(), address(taskVerifier));

        vm.stopBroadcast();

        a = Addrs({
            usdc: address(usdc),
            zeroToken: address(zeroToken),
            teeVerifier: address(teeVerifier),
            taskRegistry: address(taskRegistry),
            taskEscrow: address(taskEscrow),
            taskVerifier: address(taskVerifier),
            arbitration: address(arbitration),
            reputationNFT: address(reputationNFT)
        });

        _writeManifest(a, admin);

        // solhint-disable no-console
        console.log("=== ZeroLance deployed ===");
        console.log("MockUSDC:             ", a.usdc);
        console.log("ZeroLanceToken:       ", a.zeroToken);
        console.log("ZeroLanceTeeVerifier: ", a.teeVerifier);
        console.log("ZeroLanceTaskRegistry:", a.taskRegistry);
        console.log("ZeroLanceTaskEscrow:  ", a.taskEscrow);
        console.log("ZeroLanceTaskVerifier:", a.taskVerifier);
        console.log("ZeroLanceArbitration: ", a.arbitration);
        console.log("ZeroLanceReputationNFT:", a.reputationNFT);
        // solhint-enable no-console
    }

    function _writeManifest(Addrs memory a, address admin) internal {
        string memory network = vm.envOr("ZERO_NETWORK", string("galileo"));
        string memory json = string.concat(
            '{"network":"', network, '",',
            '"deployer":"', vm.toString(admin), '",',
            '"usdc":"', vm.toString(a.usdc), '",',
            '"zeroToken":"', vm.toString(a.zeroToken), '",',
            '"teeVerifier":"', vm.toString(a.teeVerifier), '",',
            '"taskRegistry":"', vm.toString(a.taskRegistry), '",',
            '"taskEscrow":"', vm.toString(a.taskEscrow), '",',
            '"taskVerifier":"', vm.toString(a.taskVerifier), '",',
            '"arbitration":"', vm.toString(a.arbitration), '",',
            '"reputationNFT":"', vm.toString(a.reputationNFT), '"}'
        );
        vm.writeFile(string.concat("../../docs/deployments/", network, ".json"), json);
    }
}