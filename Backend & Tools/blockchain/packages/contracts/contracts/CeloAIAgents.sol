// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract CeloAIAgents is Ownable, Pausable, ReentrancyGuard, ERC721, ERC721URIStorage {
    using SafeERC20 for IERC20;

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

    struct TimeLockedWithdrawal {
        uint256 agentId;
        address token;
        address recipient;
        uint256 amount;
        uint256 unlockTime;
        bool executed;
    }

    struct Order {
        uint256 orderId;
        address creator;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 deadline;
        bool isFilled;
        bool isCancelled;
    }

    struct NFTOrder {
        uint256 orderId;
        address creator;
        address nftContract;
        uint256 tokenId;
        address tokenOut;
        uint256 amountOut;
        uint256 deadline;
        bool isFilled;
        bool isCancelled;
    }

    struct NFTMetadata {
        string name;
        string description;
        string image;
        string eventName;
        uint256 eventDate;
        bool soulbound;
        uint256 mintedAt;
    }

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public ownerAgents;
    mapping(bytes32 => bool) public operationTypes;
    mapping(address => uint256) public tokenBalances;
    mapping(uint256 => TimeLockedWithdrawal) public timeLockedWithdrawals;
    mapping(uint256 => uint256) public agentDailyWithdrawn;
    mapping(uint256 => uint256) public agentLastResetDay;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => NFTOrder) public nftOrders;
    mapping(address => bool) public authorizedNFTContracts;
    mapping(uint256 => NFTMetadata) public tokenMetadata;
    mapping(address => bool) public authorizedMinters;
    mapping(address => uint256[]) public ownerTokens;
    mapping(string => bool) public usedMetadataURIs;
    mapping(address => uint256) public stakingBalances;
    mapping(address => uint256) public stakingTimestamps;
    mapping(address => uint256) public rewardRates;
    mapping(address => uint256) public lastClaimTime;
    mapping(address => uint256) public pendingRewards;

    uint256 public nextAgentId = 1;
    uint256 public nextTimeLockId = 1;
    uint256 public nextOrderId = 1;
    uint256 public nextTokenId = 1;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant MIN_TIME_LOCK = 1 hours;
    uint256 public constant MAX_TIME_LOCK = 30 days;
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant FEE_PERCENTAGE = 250;
    uint256 public constant BASIS_POINTS = 10000;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentType, uint256 dailyLimit, uint256 perTxLimit);
    event AgentActionExecuted(uint256 indexed agentId, bytes32 indexed actionType, uint256 amount, address recipient);
    event SpendingLimitExceeded(uint256 indexed agentId, uint256 attempted, uint256 limit);
    event AgentPaused(uint256 indexed agentId, string reason);
    event AgentUnpaused(uint256 indexed agentId);
    event PermissionSet(uint256 indexed agentId, bytes32 indexed permission, bool allowed);
    event WhitelistUpdated(uint256 indexed agentId, address indexed account, bool allowed);
    event Deposit(address indexed token, uint256 amount, address indexed depositor);
    event AgentWithdrawal(uint256 indexed agentId, address indexed token, address indexed recipient, uint256 amount);
    event BatchTransfer(uint256 indexed agentId, address indexed token, address[] recipients, uint256[] amounts);
    event TimeLockedWithdrawalScheduled(uint256 indexed timeLockId, uint256 indexed agentId, address indexed token, uint256 amount, uint256 unlockTime);
    event TimeLockedWithdrawalExecuted(uint256 indexed timeLockId, uint256 indexed agentId, address indexed token, uint256 amount);
    event OrderCreated(uint256 indexed orderId, address indexed creator, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event OrderFilled(uint256 indexed orderId, address indexed filler, uint256 amountIn, uint256 amountOut);
    event OrderCancelled(uint256 indexed orderId, address indexed creator);
    event NFTOrderCreated(uint256 indexed orderId, address indexed creator, address nftContract, uint256 tokenId, address tokenOut, uint256 amountOut);
    event NFTOrderFilled(uint256 indexed orderId, address indexed filler, address nftContract, uint256 tokenId, uint256 amountOut);
    event NFTOrderCancelled(uint256 indexed orderId, address indexed creator);
    event NFTOrderExpired(uint256 indexed orderId);
    event NFTContractAuthorized(address indexed nftContract, bool authorized);
    event NFTMinted(uint256 indexed tokenId, address indexed to, string metadataURI);
    event BatchNFTMinted(uint256[] tokenIds, address indexed to);
    event Staked(address indexed staker, address indexed token, uint256 amount);
    event Unstaked(address indexed staker, address indexed token, uint256 amount);
    event RewardsClaimed(address indexed staker, address indexed token, uint256 amount);

    constructor() ERC721("Celo AI Agents", "CAA") Ownable() {
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

    function deposit(address _token, uint256 _amount) external {
        require(_amount > 0, "Amount must be positive");
        
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        tokenBalances[_token] += _amount;
        
        emit Deposit(_token, _amount, msg.sender);
    }

    function agentWithdraw(uint256 _agentId, address _token, address _recipient, uint256 _amount) external nonReentrant {
        require(agents[_agentId].isActive, "Agent not active");
        require(agents[_agentId].agentWallet == msg.sender, "Not agent wallet");
        require(_amount > 0, "Amount must be positive");
        require(tokenBalances[_token] >= _amount, "Insufficient balance");

        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        if (currentDay > agentLastResetDay[_agentId]) {
            agentDailyWithdrawn[_agentId] = 0;
            agentLastResetDay[_agentId] = currentDay;
        }

        require(agentDailyWithdrawn[_agentId] + _amount <= agents[_agentId].dailyLimit, "Daily limit exceeded");

        tokenBalances[_token] -= _amount;
        agentDailyWithdrawn[_agentId] += _amount;

        IERC20(_token).safeTransfer(_recipient, _amount);
        emit AgentWithdrawal(_agentId, _token, _recipient, _amount);
    }

    function batchTransfer(uint256 _agentId, address _token, address[] memory _recipients, uint256[] memory _amounts) external nonReentrant {
        require(agents[_agentId].isActive, "Agent not active");
        require(agents[_agentId].agentWallet == msg.sender, "Not agent wallet");
        require(_recipients.length == _amounts.length, "Array length mismatch");
        require(_recipients.length <= MAX_BATCH_SIZE, "Batch size too large");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }

        require(tokenBalances[_token] >= totalAmount, "Insufficient balance");

        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        if (currentDay > agentLastResetDay[_agentId]) {
            agentDailyWithdrawn[_agentId] = 0;
            agentLastResetDay[_agentId] = currentDay;
        }

        require(agentDailyWithdrawn[_agentId] + totalAmount <= agents[_agentId].dailyLimit, "Daily limit exceeded");

        tokenBalances[_token] -= totalAmount;
        agentDailyWithdrawn[_agentId] += totalAmount;

        for (uint256 i = 0; i < _recipients.length; i++) {
            IERC20(_token).safeTransfer(_recipients[i], _amounts[i]);
        }

        emit BatchTransfer(_agentId, _token, _recipients, _amounts);
    }

    function scheduleTimeLockedWithdrawal(uint256 _agentId, address _token, address _recipient, uint256 _amount, uint256 _timeLock) external {
        require(agents[_agentId].isActive, "Agent not active");
        require(agents[_agentId].agentWallet == msg.sender, "Not agent wallet");
        require(_amount > 0, "Amount must be positive");
        require(_timeLock >= MIN_TIME_LOCK && _timeLock <= MAX_TIME_LOCK, "Invalid time lock");
        require(tokenBalances[_token] >= _amount, "Insufficient balance");

        uint256 timeLockId = nextTimeLockId++;
        timeLockedWithdrawals[timeLockId] = TimeLockedWithdrawal({
            agentId: _agentId,
            token: _token,
            recipient: _recipient,
            amount: _amount,
            unlockTime: block.timestamp + _timeLock,
            executed: false
        });

        tokenBalances[_token] -= _amount;
        emit TimeLockedWithdrawalScheduled(timeLockId, _agentId, _token, _amount, block.timestamp + _timeLock);
    }

    function executeTimeLockedWithdrawal(uint256 _timeLockId) external nonReentrant {
        TimeLockedWithdrawal storage withdrawal = timeLockedWithdrawals[_timeLockId];
        require(!withdrawal.executed, "Already executed");
        require(block.timestamp >= withdrawal.unlockTime, "Time lock not expired");
        require(agents[withdrawal.agentId].agentWallet == msg.sender, "Not agent wallet");

        withdrawal.executed = true;
        IERC20(withdrawal.token).safeTransfer(withdrawal.recipient, withdrawal.amount);
        emit TimeLockedWithdrawalExecuted(_timeLockId, withdrawal.agentId, withdrawal.token, withdrawal.amount);
    }

    function createOrder(address _tokenIn, address _tokenOut, uint256 _amountIn, uint256 _amountOut, uint256 _deadline) external returns (uint256) {
        require(_amountIn > 0 && _amountOut > 0, "Invalid amounts");
        require(_deadline > block.timestamp, "Invalid deadline");

        uint256 orderId = nextOrderId++;
        orders[orderId] = Order({
            orderId: orderId,
            creator: msg.sender,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            amountIn: _amountIn,
            amountOut: _amountOut,
            deadline: _deadline,
            isFilled: false,
            isCancelled: false
        });

        IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), _amountIn);
        emit OrderCreated(orderId, msg.sender, _tokenIn, _tokenOut, _amountIn, _amountOut);
        return orderId;
    }

    function fillOrder(uint256 _orderId, uint256 _amountIn) external nonReentrant {
        Order storage order = orders[_orderId];
        require(!order.isFilled && !order.isCancelled, "Order not available");
        require(block.timestamp <= order.deadline, "Order expired");
        require(_amountIn <= order.amountIn, "Amount exceeds order");

        uint256 amountOut = (_amountIn * order.amountOut) / order.amountIn;
        require(IERC20(order.tokenOut).balanceOf(address(this)) >= amountOut, "Insufficient liquidity");

        IERC20(order.tokenIn).safeTransferFrom(msg.sender, address(this), _amountIn);
        IERC20(order.tokenOut).safeTransfer(msg.sender, amountOut);

        if (_amountIn == order.amountIn) {
            order.isFilled = true;
        } else {
            order.amountIn -= _amountIn;
            order.amountOut -= amountOut;
        }

        emit OrderFilled(_orderId, msg.sender, _amountIn, amountOut);
    }

    function cancelOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.creator == msg.sender, "Not order creator");
        require(!order.isFilled && !order.isCancelled, "Order not available");

        order.isCancelled = true;
        IERC20(order.tokenIn).safeTransfer(msg.sender, order.amountIn);
        emit OrderCancelled(_orderId, msg.sender);
    }

    function createNFTSellOrder(address _nftContract, uint256 _tokenId, address _tokenOut, uint256 _amountOut, uint256 _deadline) external returns (uint256) {
        require(authorizedNFTContracts[_nftContract], "NFT contract not authorized");
        require(_amountOut > 0, "Invalid amount");
        require(_deadline > block.timestamp, "Invalid deadline");

        IERC721(_nftContract).transferFrom(msg.sender, address(this), _tokenId);

        uint256 orderId = nextOrderId++;
        nftOrders[orderId] = NFTOrder({
            orderId: orderId,
            creator: msg.sender,
            nftContract: _nftContract,
            tokenId: _tokenId,
            tokenOut: _tokenOut,
            amountOut: _amountOut,
            deadline: _deadline,
            isFilled: false,
            isCancelled: false
        });

        emit NFTOrderCreated(orderId, msg.sender, _nftContract, _tokenId, _tokenOut, _amountOut);
        return orderId;
    }

    function fillNFTOrder(uint256 _orderId) external nonReentrant {
        NFTOrder storage order = nftOrders[_orderId];
        require(!order.isFilled && !order.isCancelled, "Order not available");
        require(block.timestamp <= order.deadline, "Order expired");
        require(IERC20(order.tokenOut).balanceOf(address(this)) >= order.amountOut, "Insufficient liquidity");

        IERC20(order.tokenOut).safeTransferFrom(msg.sender, address(this), order.amountOut);
        IERC721(order.nftContract).transferFrom(address(this), msg.sender, order.tokenId);

        order.isFilled = true;
        emit NFTOrderFilled(_orderId, msg.sender, order.nftContract, order.tokenId, order.amountOut);
    }

    function cancelNFTOrder(uint256 _orderId) external {
        NFTOrder storage order = nftOrders[_orderId];
        require(order.creator == msg.sender, "Not order creator");
        require(!order.isFilled && !order.isCancelled, "Order not available");

        order.isCancelled = true;
        IERC721(order.nftContract).transferFrom(address(this), msg.sender, order.tokenId);
        emit NFTOrderCancelled(_orderId, msg.sender);
    }

    function authorizeNFTContract(address _nftContract, bool _authorized) external onlyOwner {
        authorizedNFTContracts[_nftContract] = _authorized;
        emit NFTContractAuthorized(_nftContract, _authorized);
    }

    function mintNFT(address _to, string memory _metadataURI, NFTMetadata memory _metadata) external returns (uint256) {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized minter");
        require(_to != address(0), "Invalid recipient");

        uint256 tokenId = nextTokenId++;
        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        tokenMetadata[tokenId] = _metadata;
        ownerTokens[_to].push(tokenId);
        usedMetadataURIs[_metadataURI] = true;

        emit NFTMinted(tokenId, _to, _metadataURI);
        return tokenId;
    }

    function batchMintNFTs(address _to, string[] memory _metadataURIs, NFTMetadata[] memory _metadatas) external returns (uint256[] memory) {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized minter");
        require(_to != address(0), "Invalid recipient");
        require(_metadataURIs.length == _metadatas.length, "Array length mismatch");
        require(_metadataURIs.length <= MAX_BATCH_SIZE, "Batch size too large");

        uint256[] memory tokenIds = new uint256[](_metadataURIs.length);

        for (uint256 i = 0; i < _metadataURIs.length; i++) {
            uint256 tokenId = nextTokenId++;
            _safeMint(_to, tokenId);
            _setTokenURI(tokenId, _metadataURIs[i]);

            tokenMetadata[tokenId] = _metadatas[i];
            ownerTokens[_to].push(tokenId);
            usedMetadataURIs[_metadataURIs[i]] = true;
            tokenIds[i] = tokenId;
        }

        emit BatchNFTMinted(tokenIds, _to);
        return tokenIds;
    }

    function setAuthorizedMinter(address _minter, bool _authorized) external onlyOwner {
        authorizedMinters[_minter] = _authorized;
    }

    function stake(address _token, uint256 _amount) external {
        require(_amount > 0, "Amount must be positive");
        
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        stakingBalances[_token] += _amount;
        stakingTimestamps[_token] = block.timestamp;
        
        emit Staked(msg.sender, _token, _amount);
    }

    function unstake(address _token, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be positive");
        require(stakingBalances[_token] >= _amount, "Insufficient staked balance");

        claimRewards(_token);
        stakingBalances[_token] -= _amount;
        IERC20(_token).safeTransfer(msg.sender, _amount);
        
        emit Unstaked(msg.sender, _token, _amount);
    }

    function claimRewards(address _token) public {
        uint256 rewards = calculateRewards(_token);
        if (rewards > 0) {
            pendingRewards[_token] = 0;
            lastClaimTime[_token] = block.timestamp;
            IERC20(_token).safeTransfer(msg.sender, rewards);
            emit RewardsClaimed(msg.sender, _token, rewards);
        }
    }

    function calculateRewards(address _token) public view returns (uint256) {
        if (stakingBalances[_token] == 0) return 0;
        
        uint256 timeStaked = block.timestamp - stakingTimestamps[_token];
        uint256 baseRewards = (stakingBalances[_token] * rewardRates[_token] * timeStaked) / (365 days * 10000);
        
        return baseRewards + pendingRewards[_token];
    }

    function setRewardRate(address _token, uint256 _rate) external onlyOwner {
        rewardRates[_token] = _rate;
    }

    function getAgent(uint256 _agentId) external view returns (uint256 agentId, address owner, string memory agentType, address agentWallet, uint256 dailyLimit, uint256 perTxLimit, uint256 dailySpent, bool isActive) {
        Agent storage agent = agents[_agentId];
        return (agent.agentId, agent.owner, agent.agentType, agent.agentWallet, agent.dailyLimit, agent.perTxLimit, agent.dailySpent, agent.isActive);
    }

    function getOwnerAgents(address _owner) external view returns (uint256[] memory) {
        return ownerAgents[_owner];
    }

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    function getNFTOrder(uint256 _orderId) external view returns (NFTOrder memory) {
        return nftOrders[_orderId];
    }

    function getTokenMetadata(uint256 _tokenId) external view returns (NFTMetadata memory) {
        return tokenMetadata[_tokenId];
    }

    function getOwnerTokens(address _owner) external view returns (uint256[] memory) {
        return ownerTokens[_owner];
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

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
