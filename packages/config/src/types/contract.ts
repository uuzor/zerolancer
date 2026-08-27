import { Contract, type ContractRunner, type InterfaceAbi } from "ethers";

/// Minimal typed-contract wrapper (adapted from axiom-protocol).
/// `contract` is the ethers Contract typed as the methods generic; `raw` keeps
/// the untyped Contract for filters, interface parsing, and ABI access.
export class TypedContract<T> {
  readonly contract: T;
  readonly raw: Contract;

  constructor(
    address: string,
    abi: InterfaceAbi,
    runner: ContractRunner | null,
  ) {
    this.raw = new Contract(address, abi, runner);
    this.contract = this.raw as unknown as T;
  }

  get iface() {
    return this.raw.interface;
  }
}
