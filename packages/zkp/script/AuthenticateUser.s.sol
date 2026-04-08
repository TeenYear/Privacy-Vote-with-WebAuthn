// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {console} from "forge-std/Script.sol";

import {ZK_KYC} from "../src/ZK_KYC.sol";
import {ScriptConfig} from "./ScriptConfig.s.sol";

contract WebAuthnScript is ScriptConfig {
    function setUp() public {}

    function run() public {
        vm.broadcast();

        // link deployed address
        ZK_KYC zkKYC = ZK_KYC(getZkKycAddress());

        zkKYC.registerUser("alice");
        vm.broadcast();
    }
}
