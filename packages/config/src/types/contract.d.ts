import { Contract, type ContractRunner, type InterfaceAbi } from "ethers";
export declare class TypedContract<T> {
    readonly contract: T;
    readonly raw: Contract;
    constructor(address: string, abi: InterfaceAbi, runner: ContractRunner | null);
    get iface(): import("ethers").Interface;
}
//# sourceMappingURL=contract.d.ts.map