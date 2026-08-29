import { Contract } from "ethers";
/// Minimal typed-contract wrapper (adapted from axiom-protocol).
/// `contract` is the ethers Contract typed as the methods generic; `raw` keeps
/// the untyped Contract for filters, interface parsing, and ABI access.
export class TypedContract {
    contract;
    raw;
    constructor(address, abi, runner) {
        this.raw = new Contract(address, abi, runner);
        this.contract = this.raw;
    }
    get iface() {
        return this.raw.interface;
    }
}
//# sourceMappingURL=contract.js.map