import { timingSafeEqual } from "node:crypto";
function splitKeys(raw) {
    if (!raw || typeof raw !== "string")
        return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function timingSafeMatch(presented, candidates) {
    const keyBuf = Buffer.from(presented, "utf-8");
    return candidates.some((api) => {
        const apiBuf = Buffer.from(api, "utf-8");
        return keyBuf.length === apiBuf.length && timingSafeEqual(keyBuf, apiBuf);
    });
}
/// Browser/client keys may only hit these path prefixes (method-aware where needed).
/// Everything else requires the server API key.
export const CLIENT_ALLOWED_ROUTES = [
    { match: (p) => p === "/health" || p.startsWith("/health/") },
    { match: (p) => p === "/v1/routes" || p === "/v1/config" },
    { match: (p) => p === "/v1/compute/providers" },
    { match: (p) => p.startsWith("/v1/compute/models") },
    { match: (p) => p.startsWith("/v1/compute/chat") },
    { match: (p) => p === "/v1/payment/config" },
    {
        methods: ["GET"],
        match: (p) => p === "/v1/events" || p.startsWith("/v1/events?"),
    },
    {
        methods: ["GET", "POST"],
        match: (p) => p.startsWith("/v1/tasks") ||
            p.startsWith("/v1/escrow") ||
            p.startsWith("/v1/disputes") ||
            p.startsWith("/v1/reputation") ||
            p.startsWith("/v1/verification") ||
            p.startsWith("/v1/github/auth/start") ||
            p.startsWith("/v1/github/auth/callback") ||
            p.startsWith("/v1/github/me") ||
            p.startsWith("/v1/github/repos") ||
            p.startsWith("/v1/github/connect") ||
            p.startsWith("/v1/github/issues") ||
            p.startsWith("/v1/github/task/"),
    },
];
export function isClientPathAllowed(method, path) {
    const m = method.toUpperCase();
    const pathOnly = path.split("?")[0] ?? path;
    return CLIENT_ALLOWED_ROUTES.some((rule) => {
        if (rule.methods && !rule.methods.includes(m))
            return false;
        return rule.match(pathOnly);
    });
}
/// API-key auth with capability split:
/// - server key (`ZERO_API_KEY`): full access
/// - client key (`ZERO_CLIENT_API_KEY`): only CLIENT_ALLOWED_ROUTES
export function createApiKeyAuth(apiKey, publicPaths = ["/health"], disableAuth = false, clientApiKey) {
    const serverKeys = splitKeys(apiKey);
    const clientKeys = splitKeys(clientApiKey).filter((k) => !serverKeys.includes(k));
    if (serverKeys.length === 0 && clientKeys.length === 0) {
        if (!disableAuth) {
            return (_req, res, _next) => {
                res
                    .status(503)
                    .json({ error: "service unavailable: API key not configured" });
            };
        }
        return (req, _res, next) => {
            req.authPrincipal = "disabled";
            next();
        };
    }
    return (req, res, next) => {
        if (publicPaths.includes(req.path)) {
            req.authPrincipal = "none";
            return next();
        }
        const raw = req.headers["x-api-key"];
        const key = typeof raw === "string" ? raw : "";
        if (timingSafeMatch(key, serverKeys)) {
            req.authPrincipal = "server";
            req.authKeyKind = "server";
            return next();
        }
        if (timingSafeMatch(key, clientKeys)) {
            req.authPrincipal = "client";
            req.authKeyKind = "client";
            return next();
        }
        res.status(401).json({ error: "unauthorized" });
    };
}
/// Deny client-key access outside the allowlist. Server/disabled/none pass.
export function enforceClientPathAllowlist(req, res, next) {
    const principal = req.authPrincipal;
    if (principal !== "client") {
        next();
        return;
    }
    if (isClientPathAllowed(req.method, req.path)) {
        next();
        return;
    }
    res.status(403).json({
        error: "forbidden: client API key cannot access this route",
        code: "CLIENT_PATH_DENIED",
        path: req.path,
    });
}
/// Operator-only: verdict submission, privileged payment, forensics, etc.
export function requireServerAuth(req, res, next) {
    const principal = req.authPrincipal;
    if (principal === "disabled" || principal === "server") {
        next();
        return;
    }
    res.status(403).json({
        error: "forbidden: server API key required",
        code: "SERVER_KEY_REQUIRED",
    });
}
/// Timing-safe membership test for WebSocket tokens (server or client keys).
export function timingSafeTokenInList(token, candidates) {
    return timingSafeMatch(token, candidates);
}
//# sourceMappingURL=auth.js.map