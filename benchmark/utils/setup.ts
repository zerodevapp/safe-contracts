import { expect } from "chai";
import hre, { deployments } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getDefaultCallbackHandler, getSafeWithOwners } from "../../test/utils/setup";
import {
    logGas,
    executeTx,
    SafeTransaction,
    safeSignTypedData,
    SafeSignature,
    executeContractCallWithSigners,
} from "../../src/utils/execution";
import { HHEthersSigner } from "../../src/types";
import { Contract } from "ethers";
import { AddressZero } from "@ethersproject/constants";

const getSigners = async (count: number) => {
    const signers = await hre.ethers.getSigners();
    return signers.slice(0, count);
};

export interface Contracts {
    targets: Contract[];
    additions: any | undefined;
}

const generateTarget = async (owners: HHEthersSigner[], threshold: number, guardAddress: string, logGasUsage?: boolean) => {
    const fallbackHandler = await getDefaultCallbackHandler();
    const safe = await getSafeWithOwners(
        owners.map((owner) => owner.address),
        threshold,
        fallbackHandler.address,
        logGasUsage,
    );
    await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], owners);
    return safe;
};

type BenchmarkConfig = {
    name: string;
    signers: number;
    threshold: number;
    useGuard?: boolean;
};

export const BENCHMARKS: BenchmarkConfig[] = [
    { name: "single owner", signers: 1, threshold: 1 },
    { name: "single owner and guard", signers: 1, threshold: 1, useGuard: true },
    { name: "2 out of 2", signers: 2, threshold: 2 },
    { name: "3 out of 3", signers: 3, threshold: 3 },
    { name: "3 out of 5", signers: 5, threshold: 3 },
];

export const setupBenchmarkContracts = (benchmarkFixture?: () => Promise<any>, logGasUsage?: boolean) => {
    return deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const guardFactory = await hre.ethers.getContractFactory("DelegateCallTransactionGuard");
        const guard = await guardFactory.deploy(AddressZero);
        const targets: Contract[] = [];
        for (const config of BENCHMARKS) {
            const signers = await getSigners(config.signers);
            const guardAddress = config.useGuard ? guard.address : AddressZero;

            targets.push(await generateTarget(signers, config.threshold, guardAddress, logGasUsage));
        }
        return {
            targets,
            additions: benchmarkFixture ? await benchmarkFixture() : undefined,
        };
    });
};

export interface Benchmark {
    name: string;
    prepare: (contracts: Contracts, target: string, nonce: number) => Promise<SafeTransaction>;
    after?: (contracts: Contracts) => Promise<void>;
    fixture?: () => Promise<any>;
}

export const benchmark = async (topic: string, benchmarks: Benchmark[]): Promise<void> => {
    for (const benchmark of benchmarks) {
        const { name, prepare, after, fixture } = benchmark;
        const contractSetup = setupBenchmarkContracts(fixture);
        describe(`${topic} - ${name}`, async () => {
            it("with an EOA", async () => {
                const contracts = await contractSetup();
                const signer = (await getSigners(1))[0];
                const tx = await prepare(contracts, signer.address, 0);
                await logGas(
                    name,
                    signer.sendTransaction({
                        to: tx.to,
                        value: tx.value,
                        data: tx.data,
                    }),
                );
                if (after) await after(contracts);
            });
            for (const i in BENCHMARKS) {
                const benchmark = BENCHMARKS[i];
                it(`with a ${benchmark.name} Safe`, async () => {
                    const contracts = await contractSetup();
                    const target = contracts.targets[i];
                    const nonce = await target.nonce();
                    const tx = await prepare(contracts, target.address, nonce);
                    const threshold = await target.getThreshold();
                    const signers = await getSigners(benchmark.signers);
                    const sigs: SafeSignature[] = await Promise.all(
                        signers.slice(0, threshold).map(async (signer) => {
                            return await safeSignTypedData(signer, target, tx);
                        }),
                    );
                    await expect(logGas(name, executeTx(target, tx, sigs))).to.emit(target, "ExecutionSuccess");
                    if (after) await after(contracts);
                });
            }
        });
    }
};
