// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {WaveFundingEscrow} from "../src/zerolancewave/WaveFundingEscrow.sol";
import {WaveFundingVerifier} from "../src/zerolancewave/WaveFundingVerifier.sol";
import {ZeroLanceOssWave} from "../src/zerolancewave/ZeroLanceOssWave.sol";
import {ZeroLanceBuildathonWave} from "../src/zerolancewave/ZeroLanceBuildathonWave.sol";
import {PointsLedger} from "../src/zerolancewave/PointsLedger.sol";

/// @notice Deploys the rewritten ZeroLance wave funding suite: WaveFundingEscrow
///         (funds-only vault), WaveFundingVerifier (state + rules + points),
///         ZeroLanceOssWave (OSS issue mode), ZeroLanceBuildathonWave (buildathon
///         mode), and a shared PointsLedger (non-upgradeable, owned by the
///         verifier). All four protocol contracts are UUPS-proxied. Writes a
///         manifest to ../../docs/deployments/<network>-wave.json.
contract DeployWave is Script {
    struct Addrs {
        address waveFundingEscrow;
        address waveFundingVerifier;
        address ossWave;
        address buildathonWave;
        address pointsLedger;
    }

    function run() external returns (Addrs memory a) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address admin = vm.addr(pk);
        address treasury = vm.envOr("ZERO_TREASURY", admin);

        vm.startBroadcast(pk);

        // 1. Shared points ledger (constructor-style, non-upgradeable).
        //    The verifier takes ownership so it can assign the wave operator.
        PointsLedger ledgerImpl = new PointsLedger(admin);
        address pointsLedger = address(ledgerImpl);

        // 2. WaveFundingEscrow behind UUPS proxy.
        WaveFundingEscrow escrowLogic = new WaveFundingEscrow();
        WaveFundingEscrow waveFundingEscrow = WaveFundingEscrow(
            address(
                new ERC1967Proxy(
                    address(escrowLogic),
                    abi.encodeCall(
                        WaveFundingEscrow.initialize, (admin, treasury, address(0))
                    )
                )
            )
        );

        // 3. WaveFundingVerifier behind UUPS proxy. Pass escrow + ledger addresses.
        WaveFundingVerifier verifierLogic = new WaveFundingVerifier();
        WaveFundingVerifier waveFundingVerifier = WaveFundingVerifier(
            address(
                new ERC1967Proxy(
                    address(verifierLogic),
                    abi.encodeCall(
                        WaveFundingVerifier.initialize,
                        (admin, address(waveFundingEscrow), pointsLedger)
                    )
                )
            )
        );

        // 4. Re-point escrow.verifier to the deployed verifier, and hand the
        //    ledger's waveOperator over to the verifier.
        waveFundingEscrow.setVerifier(address(waveFundingVerifier));
        ledgerImpl.setWaveOperator(address(waveFundingVerifier));

        // 5. ZeroLanceOssWave (OSS issue mode) behind UUPS proxy.
        ZeroLanceOssWave ossLogic = new ZeroLanceOssWave();
        ZeroLanceOssWave ossWave = ZeroLanceOssWave(
            address(
                new ERC1967Proxy(
                    address(ossLogic),
                    abi.encodeCall(
                        ZeroLanceOssWave.initialize,
                        (admin, address(waveFundingVerifier))
                    )
                )
            )
        );

        // 6. ZeroLanceBuildathonWave (buildathon mode) behind UUPS proxy.
        ZeroLanceBuildathonWave buildathonLogic = new ZeroLanceBuildathonWave();
        ZeroLanceBuildathonWave buildathonWave = ZeroLanceBuildathonWave(
            address(
                new ERC1967Proxy(
                    address(buildathonLogic),
                    abi.encodeCall(
                        ZeroLanceBuildathonWave.initialize,
                        (admin, address(waveFundingVerifier))
                    )
                )
            )
        );

        vm.stopBroadcast();

        a = Addrs({
            waveFundingEscrow: address(waveFundingEscrow),
            waveFundingVerifier: address(waveFundingVerifier),
            ossWave: address(ossWave),
            buildathonWave: address(buildathonWave),
            pointsLedger: pointsLedger
        });

        _writeManifest(a, admin);

        // solhint-disable no-console
        console.log("=== ZeroLance Wave deployed ===");
        console.log("WaveFundingEscrow:   ", a.waveFundingEscrow);
        console.log("WaveFundingVerifier: ", a.waveFundingVerifier);
        console.log("OssWave:             ", a.ossWave);
        console.log("BuildathonWave:      ", a.buildathonWave);
        console.log("PointsLedger:        ", a.pointsLedger);
        // solhint-enable no-console
    }

    function _writeManifest(Addrs memory a, address admin) internal {
        string memory network = vm.envOr("ZERO_NETWORK", string("galileo"));
        string memory json = string.concat(
            '{"network":"', network, '",',
            '"deployer":"', vm.toString(admin), '",',
            '"waveFundingEscrow":"', vm.toString(a.waveFundingEscrow), '",',
            '"waveFundingVerifier":"', vm.toString(a.waveFundingVerifier), '",',
            '"ossWave":"', vm.toString(a.ossWave), '",',
            '"buildathonWave":"', vm.toString(a.buildathonWave), '",',
            '"pointsLedger":"', vm.toString(a.pointsLedger), '"}'
        );
        vm.writeFile(string.concat("../../docs/deployments/", network, "-wave.json"), json);
    }
}