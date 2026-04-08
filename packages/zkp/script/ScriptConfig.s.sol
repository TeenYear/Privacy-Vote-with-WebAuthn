// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";

abstract contract ScriptConfig is Script {
    string internal constant ZK_KYC_ADDRESS_FILE = "./cache/zk_kyc_address.txt";

    function getZkKycAddress() internal view returns (address) {
        return vm.parseAddress(vm.readFile(ZK_KYC_ADDRESS_FILE));
    }
}