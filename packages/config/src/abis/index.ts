// Placeholder ABIs. After `forge build`, run `pnpm generate-abis` to overwrite
// these with the full Foundry-exported ABIs (including errors and full event
// signatures). These human-readable stubs are sufficient for the backend to
// compile and call the core methods.

export const MOCK_USDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function faucet(address,uint256)",
  "function mint(address,uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const;

export const ZEROLANCE_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function mint(address,uint256)",
  "function burn(uint256)",
  "function burnFrom(address,uint256)",
  "function pause()",
  "function unpause()",
  "function initialize(address,uint256,uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

export const ZEROLANCE_TEE_VERIFIER_ABI = [
  "function registeredSigner() view returns (address)",
  "function maxProofAgeSeconds() view returns (uint256)",
  "function domainSeparator() view returns (bytes32)",
  "function verdictStructHash((uint256,bytes32,bool,uint256,bytes32,uint256)) pure returns (bytes32)",
  "function verdictMessageHash((uint256,bytes32,bool,uint256,bytes32,uint256)) view returns (bytes32)",
  "function recoverVerdictSigner((uint256,bytes32,bool,uint256,bytes32,uint256,bytes)) view returns (address)",
  "function verifyVerdict((uint256,bytes32,bool,uint256,bytes32,uint256,bytes)) returns (bool)",
  "function proposeSigner(address)",
  "function executeSigner()",
  "function cancelSignerProposal()",
  "function pendingSigner() view returns (address)",
  "function initialize(address,address,uint256)",
  "event SignerProposed(address indexed newSigner, uint256 executableAt)",
  "event SignerExecuted(address indexed oldSigner, address indexed newSigner)",
  "event SignerProposalCancelled(address indexed cancelledSigner)",
] as const;

export const ZEROLANCE_TASK_REGISTRY_ABI = [
  "function nextTaskId() view returns (uint256)",
  "function authorizedSetter() view returns (address)",
  "function setAuthorizedSetter(address)",
  "function createTask(bytes32,uint8,address,uint256,uint256,string,uint64,uint16) returns (uint256)",
  "function assignTask(uint256,address)",
  "function submitDeliverable(uint256,bytes32,uint64)",
  "function setStatus(uint256,uint8)",
  "function taskOf(uint256) view returns ((address,address,uint8,uint8,bytes32,bytes32,address,uint256,uint256,uint256,uint256,string,uint64,uint64,uint16))",
  "function specHashOf(uint256) view returns (bytes32)",
  "function initialize(address,address)",
  "event TaskCreated(uint256 indexed taskId, address indexed client, bytes32 indexed specHash, uint8 category, uint256 reward, uint256 deadline, string repoUrl, uint64 issueNumber)",
  "event TaskAssigned(uint256 indexed taskId, address indexed freelancer)",
  "event DeliverableSubmitted(uint256 indexed taskId, address indexed freelancer, bytes32 deliverableHash, uint64 prNumber)",
  "event TaskStatusChanged(uint256 indexed taskId, uint8 status)",
] as const;

export const ZEROLANCE_ESCROW_VAULT_ABI = [
  "function deposit(uint256,uint256)",
  "function submitDeliverable(uint256,bytes32,uint64)",
  "function submitVerdict((uint256,bytes32,bool,uint256,bytes32,uint256,bytes))",
  "function refund(uint256)",
  "function escalateDispute(uint256,address[])",
  "function resolveDispute(uint256,address)",
  "function setReputationNft(address)",
  "function mintReputationForTask(uint256,string,bytes32) returns (uint256)",
  "function setArbitration(address)",
  "function proposeProtocolTreasury(address)",
  "function executeProtocolTreasury()",
  "function setProtocolFeeBps(uint16)",
  "function escrowedOf(uint256) view returns (uint256)",
  "function releasedOf(uint256) view returns (bool)",
  "function protocolFeeBps() view returns (uint256)",
  "function protocolTreasury() view returns (address)",
  "function initialize(address,address,address,uint16,address,address)",
  "event Deposited(uint256 indexed taskId, address indexed client, uint256 amount)",
  "event DeliverableSubmitted(uint256 indexed taskId, bytes32 deliverableHash)",
  "event VerdictSubmitted(uint256 indexed taskId, bool passed, uint256 score)",
  "event Released(uint256 indexed taskId, address indexed freelancer, uint256 amount, uint256 fee)",
  "event Refunded(uint256 indexed taskId, address indexed client, uint256 amount)",
  "event DisputeEscalated(uint256 indexed taskId)",
] as const;

export const ZEROLANCE_ARBITRATION_ABI = [
  "function openDispute(uint256,address[])",
  "function vote(uint256,uint8)",
  "function slashArbiter(address)",
  "function disputeOf(uint256) view returns ((uint256,uint64,uint64,uint64,uint64,uint64,bool,address,uint256))",
  "function hasVoted(uint256,address) view returns (bool)",
  "function initialize(address,address,address,address,uint256,uint8,address)",
  "event DisputeOpened(uint256 indexed taskId, uint64 arbiterCount, uint64 quorum)",
  "event VoteCast(uint256 indexed taskId, address indexed arbiter, uint8 choice)",
  "event DisputeResolved(uint256 indexed taskId, address indexed winner, uint64 clientVotes, uint64 freelancerVotes)",
] as const;

export const ZEROLANCE_REPUTATION_NFT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function mintReputation(address,uint256,string,bytes32) returns (uint256)",
  "function appendPortfolio(uint256,string,bytes32)",
  "function updateMetadata(uint256,(string,bytes32)[])",
  "function stakeVerifiedBadge(uint256)",
  "function unstakeVerifiedBadge(uint256)",
  "function slashStake(address)",
  "function isVerified(address) view returns (bool)",
  "function stakeOf(address) view returns (uint256)",
  "function taskIdOf(uint256) view returns (uint256)",
  "function intelligentDatasOf(uint256) view returns ((string,bytes32)[])",
  "function tokenURI(uint256) view returns (string)",
  "function setEscrow(address)",
  "function initialize(address,address,address,address)",
  "event ReputationMinted(uint256 indexed tokenId, address indexed freelancer, uint256 indexed taskId)",
  "event VerifiedBadgeStaked(address indexed freelancer, uint256 amount)",
  "event VerifiedBadgeUnstaked(address indexed freelancer, uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
] as const;

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const;

