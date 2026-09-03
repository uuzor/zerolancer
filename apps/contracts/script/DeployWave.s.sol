// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {WaveFundingVault} from "../src/zerolancewave/WaveFundingVault.sol";

/// @notice Deploys the simplified ZeroLance wave funding contract: a single
///         WaveFundingVault behind an ERC1967Proxy. The vault handles escrow,
///         points, and pro-rata distribution for all wave programs (OSS +
///         buildathon modes). All state machines live in the backend DB.
contract DeployWave is Script {
    struct Addrs {
        address waveFundingVault;
    }

    function run() external returns (Addrs memory a) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address admin = vm.addr(pk);
        address treasury = vm.envOr("ZERO_TREASURY", admin);
        address signer = vm.envOr("ZERO_TEE_SIGNER", admin);

        vm.startBroadcast(pk);

        WaveFundingVault vaultImpl = new WaveFundingVault();
        WaveFundingVault waveVault = WaveFundingVault(
            address(
                new ERC1967Proxy(
                    address(vaultImpl),
                    abi.encodeCall(WaveFundingVault.initialize, (admin, treasury, signer))
                )
            )
        );

        vm.stopBroadcast();

        a = Addrs({waveFundingVault: address(waveVault)});

        _writeManifest(a, admin);

        // solhint-disable no-console
        console.log("=== ZeroLance Wave deployed ===");
        console.log("WaveFundingVault: ", a.waveFundingVault);
        // solhint-enable no-console
    }

    function _writeManifest(Addrs memory a, address admin) internal {
        string memory network = vm.envOr("ZERO_NETWORK", string("galileo"));
        string memory json = string.concat(
            '{"network":"', network, '",',
            '"deployer":"', vm.toString(admin), '",',
            '"waveFundingVault":"', vm.toString(a.waveFundingVault), '"}'
        );
        vm.writeFile(string.concat("../../docs/deployments/", network, "-wave.json"), json);
    }
}
