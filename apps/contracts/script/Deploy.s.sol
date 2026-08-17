// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ZeroLanceToken} from "../src/ZeroLanceToken.sol";
import {ZeroLanceTeeVerifier} from "../src/verifiers/ZeroLanceTeeVerifier.sol";
import {ZeroLanceTaskRegistry} from "../src/ZeroLanceTaskRegistry.sol";
import {ZeroLanceEscrowVault} from "../src/ZeroLanceEscrowVault.sol";
import {ZeroLanceArbitration} from "../src/ZeroLanceArbitration.sol";
import {ZeroLanceReputationNFT} from "../src/ZeroLanceReputationNFT.sol";

/// @notice Deploys the full ZeroLance protocol suite behind UUPS proxies and wires
///         the cross-contract references. Writes a deployment manifest to
///         ../../docs/deployments/<network>-<date>.json (fs_permissions in foundry.toml).
contract Deploy is Script {
    struct Addrs {
        address usdc;
        address zeroToken;
        address teeVerifier;
        address taskRegistry;
        address escrow;
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

        // 4. Reputation NFT (depends on $ZERO, escrow set after escrow deploy).
        ZeroLanceReputationNFT repImpl = new ZeroLanceReputationNFT();
        // Deploy with a placeholder escrow, then re-point after escrow is wired.
        ZeroLanceReputationNFT reputationNFT = ZeroLanceReputationNFT(
            address(
                new ERC1967Proxy(
                    address(repImpl),
                    abi.encodeCall(ZeroLanceReputationNFT.initialize, (address(zeroToken), admin, address(teeVerifier), admin))
                )
            )
        );

        // 5. Task registry (authorized setter = escrow, set after escrow deploy).
        ZeroLanceTaskRegistry registryImpl = new ZeroLanceTaskRegistry();
        ZeroLanceTaskRegistry taskRegistry = ZeroLanceTaskRegistry(
            address(new ERC1967Proxy(address(registryImpl), abi.encodeCall(ZeroLanceTaskRegistry.initialize, (admin, admin))))
        );

        // 6. Arbitration (depends on escrow, task registry, reputation NFT, $ZERO).
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

        // 7. Escrow vault (depends on task registry, verifier, treasury, arbitration).
        ZeroLanceEscrowVault escrowImpl = new ZeroLanceEscrowVault();
        ZeroLanceEscrowVault escrow = ZeroLanceEscrowVault(
            address(
                new ERC1967Proxy(
                    address(escrowImpl),
                    abi.encodeCall(
                        ZeroLanceEscrowVault.initialize,
                        (address(taskRegistry), address(teeVerifier), treasury, 250, address(arbitration), admin)
                    )
                )
            )
        );

        // 8. Wire cross-contract references.
        //    Arbitration and reputation NFT are deployed before the escrow
        //    (the escrow depends on arbitration's address), so their escrow
        //    references must be re-pointed here.
        taskRegistry.setAuthorizedSetter(address(escrow));
        arbitration.setEscrow(address(escrow));
        reputationNFT.setEscrow(address(escrow));
        reputationNFT.grantRole(reputationNFT.MINTER_ROLE(), address(escrow));
        escrow.setReputationNft(address(reputationNFT));

        vm.stopBroadcast();

        a = Addrs({
            usdc: address(usdc),
            zeroToken: address(zeroToken),
            teeVerifier: address(teeVerifier),
            taskRegistry: address(taskRegistry),
            escrow: address(escrow),
            arbitration: address(arbitration),
            reputationNFT: address(reputationNFT)
        });

        // Write manifest.
        _writeManifest(a, admin);

        // solhint-disable no-console
        console.log("=== ZeroLance deployed ===");
        console.log("MockUSDC:            ", a.usdc);
        console.log("ZeroLanceToken:      ", a.zeroToken);
        console.log("ZeroLanceTeeVerifier:", a.teeVerifier);
        console.log("ZeroLanceTaskRegistry:", a.taskRegistry);
        console.log("ZeroLanceEscrowVault:", a.escrow);
        console.log("ZeroLanceArbitration:", a.arbitration);
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
            '"escrow":"', vm.toString(a.escrow), '",',
            '"arbitration":"', vm.toString(a.arbitration), '",',
            '"reputationNFT":"', vm.toString(a.reputationNFT), '"}'
        );
        vm.writeFile(string.concat("../../docs/deployments/", network, ".json"), json);
    }
}
