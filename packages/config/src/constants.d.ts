export declare const TRANSFER_TOPIC: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export declare const ZERO_HASH: `0x${string}`;
export declare function bigintReplacer(_key: string, value: unknown): unknown;
export declare const DEFAULT_EVENT_LIMIT: 500;
export declare const MAX_EVENT_QUERY_LIMIT: 500;
export declare const HTTP: {
    readonly OK: 200;
    readonly ACCEPTED: 202;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly UNPROCESSABLE: 422;
    readonly TOO_MANY: 429;
    readonly INTERNAL: 500;
    readonly BAD_GATEWAY: 502;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const EVENT_NAMES: {
    readonly TaskCreated: "TaskCreated";
    readonly TaskAssigned: "TaskAssigned";
    readonly DeliverableSubmitted: "DeliverableSubmitted";
    readonly VerdictSubmitted: "VerdictSubmitted";
    readonly Released: "Released";
    readonly Refunded: "Refunded";
    readonly DisputeOpened: "DisputeOpened";
    readonly VoteCast: "VoteCast";
    readonly DisputeResolved: "DisputeResolved";
    readonly ReputationMinted: "ReputationMinted";
    readonly Deposited: "Deposited";
    readonly Withdrawn: "Withdrawn";
    readonly Transfer: "Transfer";
    readonly Unknown: "Unknown";
};
export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
export declare const RETRY_WINDOW_SECONDS: number;
export declare const DEFAULT_PROTOCOL_FEE_BPS = 250;
export declare const BPS_DENOMINATOR = 10000;
//# sourceMappingURL=constants.d.ts.map