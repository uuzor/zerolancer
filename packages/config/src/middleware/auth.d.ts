import type { Request, Response, NextFunction } from "express";
export type AuthPrincipal = "none" | "server" | "client" | "disabled";
export type AuthRequest = Request & {
    authPrincipal?: AuthPrincipal;
    authKeyKind?: "server" | "client";
};
export declare const CLIENT_ALLOWED_ROUTES: ReadonlyArray<{
    methods?: readonly string[];
    match: (path: string) => boolean;
}>;
export declare function isClientPathAllowed(method: string, path: string): boolean;
export declare function createApiKeyAuth(apiKey: string | undefined, publicPaths?: string[], disableAuth?: boolean, clientApiKey?: string): (_req: Request, res: Response, _next: NextFunction) => void;
export declare function enforceClientPathAllowlist(req: Request, res: Response, next: NextFunction): void;
export declare function requireServerAuth(req: Request, res: Response, next: NextFunction): void;
export declare function timingSafeTokenInList(token: string, candidates: string[]): boolean;
//# sourceMappingURL=auth.d.ts.map