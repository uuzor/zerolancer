export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ZERO_HASH = ("0x" + "0".repeat(64));
export function bigintReplacer(_key, value) {
    return typeof value === "bigint" ? value.toString() : value;
}
export const DEFAULT_EVENT_LIMIT = 500;
export const MAX_EVENT_QUERY_LIMIT = 500;
export const HTTP = {
    OK: 200,
    ACCEPTED: 202,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    UNPROCESSABLE: 422,
    TOO_MANY: 429,
    INTERNAL: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
};
export const EVENT_NAMES = {
    TaskCreated: "TaskCreated",
    TaskAssigned: "TaskAssigned",
    DeliverableSubmitted: "DeliverableSubmitted",
    VerdictSubmitted: "VerdictSubmitted",
    Released: "Released",
    Refunded: "Refunded",
    DisputeOpened: "DisputeOpened",
    VoteCast: "VoteCast",
    DisputeResolved: "DisputeResolved",
    ReputationMinted: "ReputationMinted",
    Deposited: "Deposited",
    Withdrawn: "Withdrawn",
    Transfer: "Transfer",
    Unknown: "Unknown",
};
/// Default retry window for a failed AI verdict (must match the on-chain constant).
export const RETRY_WINDOW_SECONDS = 14 * 24 * 60 * 60;
/// Platform fee defaults (2.5% = 250 bps).
export const DEFAULT_PROTOCOL_FEE_BPS = 250;
export const BPS_DENOMINATOR = 10_000;
//# sourceMappingURL=constants.js.map