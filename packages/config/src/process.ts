/// Register process-level handlers so unhandled rejections don't crash silently.
/// Adapted from axiom-protocol.
export function registerProcessHandlers(): void {
  if (process.env.ZERO_DISABLE_PROCESS_HANDLERS === "true") return;
  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error(
      JSON.stringify({ level: "error", msg: "unhandledRejection", error: msg }),
    );
  });
  process.on("uncaughtException", (err) => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "uncaughtException",
        error: err.message,
        stack: err.stack,
      }),
    );
  });
}
