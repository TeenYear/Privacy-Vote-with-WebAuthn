// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {console} from "forge-std/Script.sol";

import {ZK_KYC} from "../src/ZK_KYC.sol";
import {UltraVerifier} from "../src/libraries/plonk_vk.sol";
import {ScriptConfig} from "./ScriptConfig.s.sol";

contract ZK_KYC_DEPLOY is ScriptConfig {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // link deployed address
        ZK_KYC zkKYC = ZK_KYC(getZkKycAddress());

        string memory username = "alice";
        uint256 commitment = 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864;
        zkKYC.requestRegistration(username, commitment);
        vm.stopBroadcast();
    }
}
