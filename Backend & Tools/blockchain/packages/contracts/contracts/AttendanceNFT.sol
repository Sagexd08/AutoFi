// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract AttendanceNFT is Ownable, Pausable, ReentrancyGuard, ERC721, ERC721URIStorage {
    using SafeERC20 for IERC20;

    struct NFTMetadata {
        string name;
        string description;
        string image;
        string eventName;
        uint256 eventDate;
        bool soulbound;
        uint256 mintedAt;
    }
    
    mapping(uint256 => NFTMetadata) public tokenMetadata;
    mapping(address => bool) public authorizedMinters;
    mapping(address => uint256[]) public ownerTokens;
    mapping(string => bool) public usedMetadataURIs;
    mapping(address => uint256) public stakingBalances;
    mapping(address => uint256) public stakingTimestamps;
    mapping(address => uint256) public rewardRates;
    mapping(address => uint256) public lastClaimTime;
    mapping(address => uint256) public pendingRewards;
    
    uint256 public nextTokenId = 1;
    uint256 public constant MAX_BATCH_SIZE = 100;

    event NFTMinted(uint256 indexed tokenId, address indexed to, string metadataURI);
    event BatchNFTMinted(uint256[] tokenIds, address indexed to);
    event Staked(address indexed staker, address indexed token, uint256 amount);
    event Unstaked(address indexed staker, address indexed token, uint256 amount);
    event RewardsClaimed(address indexed staker, address indexed token, uint256 amount);

    constructor() ERC721("Celo Attendance NFT", "CAN") Ownable() {}

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

    function getTokenMetadata(uint256 _tokenId) external view returns (NFTMetadata memory) {
        return tokenMetadata[_tokenId];
    }

    function getOwnerTokens(address _owner) external view returns (uint256[] memory) {
        return ownerTokens[_owner];
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

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
}
