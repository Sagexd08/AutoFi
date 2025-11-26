// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract AgentTreasury is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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
    
    mapping(address => uint256) public tokenBalances;
    mapping(uint256 => TimeLockedWithdrawal) public timeLockedWithdrawals;
    mapping(uint256 => uint256) public agentDailyWithdrawn;
    mapping(uint256 => uint256) public agentLastResetDay;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => NFTOrder) public nftOrders;
    mapping(address => bool) public authorizedNFTContracts;
    
    uint256 public nextTimeLockId = 1;
    uint256 public nextOrderId = 1;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant MIN_TIME_LOCK = 1 hours;
    uint256 public constant MAX_TIME_LOCK = 30 days;
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant FEE_PERCENTAGE = 250;
    uint256 public constant BASIS_POINTS = 10000;

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

    constructor() Ownable() {}

    function deposit(address _token, uint256 _amount) external {
            require(_amount > 0, "Amount must be positive");
        
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
            tokenBalances[_token] += _amount;
        
            emit Deposit(_token, _amount, msg.sender);
    }

    function agentWithdraw(uint256 _agentId, address _token, address _recipient, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be positive");
        require(tokenBalances[_token] >= _amount, "Insufficient balance");

        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        if (currentDay > agentLastResetDay[_agentId]) {
            agentDailyWithdrawn[_agentId] = 0;
            agentLastResetDay[_agentId] = currentDay;
        }

        tokenBalances[_token] -= _amount;
        agentDailyWithdrawn[_agentId] += _amount;
        
            IERC20(_token).safeTransfer(_recipient, _amount);
        emit AgentWithdrawal(_agentId, _token, _recipient, _amount);
    }

    function batchTransfer(uint256 _agentId, address _token, address[] memory _recipients, uint256[] memory _amounts) external nonReentrant {
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

        tokenBalances[_token] -= totalAmount;
        agentDailyWithdrawn[_agentId] += totalAmount;
        
        for (uint256 i = 0; i < _recipients.length; i++) {
                IERC20(_token).safeTransfer(_recipients[i], _amounts[i]);
        }

        emit BatchTransfer(_agentId, _token, _recipients, _amounts);
    }

    function scheduleTimeLockedWithdrawal(uint256 _agentId, address _token, address _recipient, uint256 _amount, uint256 _timeLock) external {
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

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    function getNFTOrder(uint256 _orderId) external view returns (NFTOrder memory) {
        return nftOrders[_orderId];
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
}
