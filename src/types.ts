import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { Signer } from "ethers";
import type { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";

export type SafeRequiredSigner = Signer & TypedDataSigner;
export type HHEthersSigner = Awaited<ReturnType<HardhatEthersHelpers["getSigner"]>>;
