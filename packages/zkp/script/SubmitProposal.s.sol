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

        // Create 20 candidate proposals
        zkKYC.createProposal("alice", "Alice Morgan", "");
        zkKYC.createProposal("alice", "Bob Chen", "");
        zkKYC.createProposal("alice", "Carlos Rivera", "");
        zkKYC.createProposal("alice", "Diana Patel", "");
        zkKYC.createProposal("alice", "Elena Volkov", "");
        zkKYC.createProposal("alice", "Frank Osei", "");
        zkKYC.createProposal("alice", "Grace Kim", "");
        zkKYC.createProposal("alice", "Henry Zhang", "");
        zkKYC.createProposal("alice", "Iris Nakamura", "");
        zkKYC.createProposal("alice", "James Wilson", "");
        zkKYC.createProposal("alice", "Keiko Tanaka", "");
        zkKYC.createProposal("alice", "Liam Foster", "");
        zkKYC.createProposal("alice", "Maria Santos", "");
        zkKYC.createProposal("alice", "Noah Williams", "");
        zkKYC.createProposal("alice", "Olivia Dubois", "");
        zkKYC.createProposal("alice", "Patrick Murphy", "");
        zkKYC.createProposal("alice", "Quinn Anderson", "");
        zkKYC.createProposal("alice", "Rachel Cohen", "");
        zkKYC.createProposal("alice", "Samuel Park", "");
        zkKYC.createProposal("alice", "Tanya Sharma", "");

        vm.stopBroadcast();
    }
}
