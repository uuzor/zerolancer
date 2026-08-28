// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ZeroLanceWaveProgram} from "../src/zerolancewave/ZeroLanceWaveProgram.sol";
import {ZeroLanceWaveIssue} from "../src/zerolancewave/ZeroLanceWaveIssue.sol";
import {ZeroLanceWaveBuildathon} from "../src/zerolancewave/ZeroLanceWaveBuildathon.sol";

/// @notice Deploys the ZeroLance wave funding suite (WaveProgram + Issue + Buildathon)
///         behind UUPS proxies. Grants the mode contracts as awarders on the program so
///         their points route through. Writes a manifest to
///         ../../docs/deployments/<network>-wave.json.
contract DeployWave is Script {
    struct Addrs {
        address waveProgram;
        address waveIssue;
        address waveBuildathon;
        address pointsLedger;
    }

    function run() external returns (Addrs memory a) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);

        ZeroLanceWaveProgram progImpl = new ZeroLanceWaveProgram();
        ZeroLanceWaveProgram waveProgram = ZeroLanceWaveProgram(
            address(
                new ERC1967Proxy(
                    address(progImpl),
                    abi.encodeCall(ZeroLanceWaveProgram.initialize, (admin))
                )
            )
        );

        ZeroLanceWaveIssue wiImpl = new ZeroLanceWaveIssue();
        ZeroLanceWaveIssue waveIssue = ZeroLanceWaveIssue(
            address(
                new ERC1967Proxy(
                    address(wiImpl),
                    abi.encodeCall(ZeroLanceWaveIssue.initialize, (admin, address(waveProgram)))
                )
            )
        );

        ZeroLanceWaveBuildathon baImpl = new ZeroLanceWaveBuildathon();
        ZeroLanceWaveBuildathon buildathon = ZeroLanceWaveBuildathon(
            address(
                new ERC1967Proxy(
                    address(baImpl),
                    abi.encodeCall(
                        ZeroLanceWaveBuildathon.initialize,
                        (admin, address(waveProgram))
                    )
                )
            )
        );

        // NOTE: awarder grants are per-program (grantAwarder(programId, who, allowed))
        // and are done by the organizer at runtime, not at deploy time.

        vm.stopBroadcast();

        a = Addrs({
            waveProgram: address(waveProgram),
            waveIssue: address(waveIssue),
            waveBuildathon: address(buildathon),
            pointsLedger: address(0)
        });

        _writeManifest(a, admin);

        // solhint-disable no-console
        console.log("=== ZeroLance Wave deployed ===");
        console.log("WaveProgram:   ", a.waveProgram);
        console.log("WaveIssue:     ", a.waveIssue);
        console.log("WaveBuildathon:", a.waveBuildathon);
        console.log("PointsLedger:  ", a.pointsLedger);
        // solhint-enable no-console
    }

    function _writeManifest(Addrs memory a, address admin) internal {
        string memory network = vm.envOr("ZERO_NETWORK", string("galileo"));
        string memory json = string.concat(
            '{"network":"', network, '",',
            '"deployer":"', vm.toString(admin), '",',
            '"waveProgram":"', vm.toString(a.waveProgram), '",',
            '"waveIssue":"', vm.toString(a.waveIssue), '",',
            '"waveBuildathon":"', vm.toString(a.waveBuildathon), '",',
            '"pointsLedger":"', vm.toString(a.pointsLedger), '"}'
        );
        vm.writeFile(string.concat("../../docs/deployments/", network, "-wave.json"), json);
    }
}