// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin-4.5/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, initialSupply);
    }
}
