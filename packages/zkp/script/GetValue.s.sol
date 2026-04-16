// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {console} from "forge-std/Script.sol";

import {ZK_KYC, Proposal} from "../src/ZK_KYC.sol";
import {UltraVerifier} from "../src/libraries/plonk_vk.sol";
import {ScriptConfig} from "./ScriptConfig.s.sol";

contract ZK_KYC_DEPLOY is ScriptConfig {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // link deployed address
        ZK_KYC zkKYC = ZK_KYC(getZkKycAddress());

        (string memory description, uint256 voteCount, uint256 votesFor, uint256 votesAgainst,,,) = zkKYC.proposals(0);

        console.log(description);
        console.log(voteCount);
        console.log(votesFor);
        console.log(votesAgainst);
    }
}
