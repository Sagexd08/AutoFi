// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AgentRegistry is Ownable, Pausable, ReentrancyGuard {
    struct Agent {
        uint256 agentId;
        address owner;
        string agentType;
        address agentWallet;
        uint256 dailyLimit;
        uint256 perTxLimit;
        uint256 dailySpent;
        uint256 lastResetDay;
        bool isActive;
        mapping(bytes32 => bool) permissions;
        mapping(address => bool) whitelist;
        mapping(address => bool) blacklist;
    }

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public ownerAgents;
    mapping(bytes32 => bool) public operationTypes;
    mapping(uint256 => uint256) public agentDailyWithdrawn;
    mapping(uint256 => uint256) public agentLastResetDay;

    uint256 public nextAgentId = 1;
    uint256 public constant SECONDS_PER_DAY = 86400;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentType, uint256 dailyLimit, uint256 perTxLimit);
    event AgentActionExecuted(uint256 indexed agentId, bytes32 indexed actionType, uint256 amount, address recipient);
    event SpendingLimitExceeded(uint256 indexed agentId, uint256 attempted, uint256 limit);
    event AgentPaused(uint256 indexed agentId, string reason);
    event AgentUnpaused(uint256 indexed agentId);
    event PermissionSet(uint256 indexed agentId, bytes32 indexed permission, bool allowed);
    event WhitelistUpdated(uint256 indexed agentId, address indexed account, bool allowed);

    constructor() Ownable() {
        operationTypes["TRANSFER"] = true;
        operationTypes["SWAP"] = true;
        operationTypes["STAKE"] = true;
        operationTypes["UNSTAKE"] = true;
        operationTypes["CLAIM_REWARDS"] = true;
        operationTypes["VOTE"] = true;
        operationTypes["MINT_NFT"] = true;
    }

    function registerAgent(string memory _agentType, address _agentWallet, uint256 _dailyLimit, uint256 _perTxLimit) external whenNotPaused returns (uint256) {
        require(_agentWallet != address(0), "Invalid agent wallet");
        require(_dailyLimit > 0, "Daily limit must be positive");
        require(_perTxLimit > 0, "Per-tx limit must be positive");
        require(_perTxLimit <= _dailyLimit, "Per-tx limit cannot exceed daily limit");

        uint256 agentId = nextAgentId++;
        Agent storage agent = agents[agentId];
        
        agent.agentId = agentId;
        agent.owner = msg.sender;
        agent.agentType = _agentType;
        agent.agentWallet = _agentWallet;
        agent.dailyLimit = _dailyLimit;
        agent.perTxLimit = _perTxLimit;
        agent.dailySpent = 0;
        agent.lastResetDay = block.timestamp / SECONDS_PER_DAY;
        agent.isActive = true;

        ownerAgents[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, _agentType, _dailyLimit, _perTxLimit);
        return agentId;
    }

    function setAgentPermissions(uint256 _agentId, bytes32[] memory _permissions, bool[] memory _allowed) external {
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        require(_permissions.length == _allowed.length, "Array length mismatch");

        for (uint256 i = 0; i < _permissions.length; i++) {
            require(operationTypes[_permissions[i]], "Invalid operation type");
            agents[_agentId].permissions[_permissions[i]] = _allowed[i];
            emit PermissionSet(_agentId, _permissions[i], _allowed[i]);
        }
    }

    function isOperationAllowed(uint256 _agentId, bytes32 _operation, uint256 _amount, address _recipient) external view returns (bool) {
        Agent storage agent = agents[_agentId];
        
        if (!agent.isActive) return false;
        if (agent.blacklist[_recipient]) return false;
        if (agent.whitelist[address(0)] == false && !agent.whitelist[_recipient]) return false;
        if (!agent.permissions[_operation]) return false;
        
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        if (currentDay > agent.lastResetDay) {
            return _amount <= agent.perTxLimit;
        } else {
            return _amount <= agent.perTxLimit && (agent.dailySpent + _amount) <= agent.dailyLimit;
        }
    }

    function recordAgentAction(uint256 _agentId, bytes32 _actionType, uint256 _amount, address _recipient) external nonReentrant {
        require(agents[_agentId].isActive, "Agent not active");
        require(agents[_agentId].agentWallet == msg.sender, "Not agent wallet");

        Agent storage agent = agents[_agentId];
        
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        if (currentDay > agent.lastResetDay) {
            agent.dailySpent = 0;
            agent.lastResetDay = currentDay;
        }

        require(_amount <= agent.perTxLimit, "Exceeds per-tx limit");
        require((agent.dailySpent + _amount) <= agent.dailyLimit, "Exceeds daily limit");

        agent.dailySpent += _amount;
        emit AgentActionExecuted(_agentId, _actionType, _amount, _recipient);
    }

    function getAgent(uint256 _agentId) external view returns (uint256 agentId, address owner, string memory agentType, address agentWallet, uint256 dailyLimit, uint256 perTxLimit, uint256 dailySpent, bool isActive) {
        Agent storage agent = agents[_agentId];
        return (agent.agentId, agent.owner, agent.agentType, agent.agentWallet, agent.dailyLimit, agent.perTxLimit, agent.dailySpent, agent.isActive);
    }

    function getOwnerAgents(address _owner) external view returns (uint256[] memory) {
        return ownerAgents[_owner];
    }

    function updateLimits(uint256 _agentId, uint256 _dailyLimit, uint256 _perTxLimit) external {
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        require(_dailyLimit > 0, "Daily limit must be positive");
        require(_perTxLimit > 0, "Per-tx limit must be positive");
        require(_perTxLimit <= _dailyLimit, "Per-tx limit cannot exceed daily limit");

        agents[_agentId].dailyLimit = _dailyLimit;
        agents[_agentId].perTxLimit = _perTxLimit;
    }

    function updateWhitelist(uint256 _agentId, address _account, bool _allowed) external {
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        agents[_agentId].whitelist[_account] = _allowed;
        emit WhitelistUpdated(_agentId, _account, _allowed);
    }

    function updateBlacklist(uint256 _agentId, address _account, bool _blocked) external {
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        agents[_agentId].blacklist[_account] = _blocked;
    }

    function pauseAgent(uint256 _agentId, string memory _reason) external {
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        agents[_agentId].isActive = false;
        emit AgentPaused(_agentId, _reason);
    }

    function unpauseAgent(uint256 _agentId) external {
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        agents[_agentId].isActive = true;
        emit AgentUnpaused(_agentId);
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
}
