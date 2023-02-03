import hre, { deployments } from "hardhat";
import { Signer, Contract, ContractFactory } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import { Deployment } from "hardhat-deploy/dist/types";
import solc from "solc";
import { logGas } from "../../src/utils/execution";
import { safeContractUnderTest } from "./config";
import { getRandomIntAsString } from "./numbers";

export const defaultCallbackHandlerDeployment = async (): Promise<Deployment> => {
    return await deployments.get("DefaultCallbackHandler");
};

export const defaultCallbackHandlerContract = async (): Promise<ContractFactory> => {
    return await hre.ethers.getContractFactory("DefaultCallbackHandler");
};

export const compatFallbackHandlerDeployment = async (): Promise<Deployment> => {
    return await deployments.get("CompatibilityFallbackHandler");
};

export const compatFallbackHandlerContract = async (): Promise<ContractFactory> => {
    return await hre.ethers.getContractFactory("CompatibilityFallbackHandler");
};

export const getSafeSingleton = async (): Promise<Contract> => {
    const SafeDeployment = await deployments.get(safeContractUnderTest());
    const Safe = await hre.ethers.getContractFactory(safeContractUnderTest());
    return Safe.attach(SafeDeployment.address);
};

export const getFactory = async (): Promise<Contract> => {
    const FactoryDeployment = await deployments.get("SafeProxyFactory");
    const Factory = await hre.ethers.getContractFactory("SafeProxyFactory");
    return Factory.attach(FactoryDeployment.address);
};

export const getSimulateTxAccessor = async (): Promise<Contract> => {
    const SimulateTxAccessorDeployment = await deployments.get("SimulateTxAccessor");
    const SimulateTxAccessor = await hre.ethers.getContractFactory("SimulateTxAccessor");
    return SimulateTxAccessor.attach(SimulateTxAccessorDeployment.address);
};

export const getMultiSend = async (): Promise<Contract> => {
    const MultiSendDeployment = await deployments.get("MultiSend");
    const MultiSend = await hre.ethers.getContractFactory("MultiSend");
    return MultiSend.attach(MultiSendDeployment.address);
};

export const getMultiSendCallOnly = async (): Promise<Contract> => {
    const MultiSendDeployment = await deployments.get("MultiSendCallOnly");
    const MultiSend = await hre.ethers.getContractFactory("MultiSendCallOnly");
    return MultiSend.attach(MultiSendDeployment.address);
};

export const getCreateCall = async (): Promise<Contract> => {
    const CreateCallDeployment = await deployments.get("CreateCall");
    const CreateCall = await hre.ethers.getContractFactory("CreateCall");
    return CreateCall.attach(CreateCallDeployment.address);
};

export const migrationContract = async (): Promise<ContractFactory> => {
    return await hre.ethers.getContractFactory("Migration");
};

export const getMock = async (): Promise<Contract> => {
    const Mock = await hre.ethers.getContractFactory("MockContract");
    return await Mock.deploy();
};

export const getSafeTemplate = async (saltNumber: string = getRandomIntAsString()): Promise<Contract> => {
    const singleton = await getSafeSingleton();
    const factory = await getFactory();
    const template = await factory.callStatic.createProxyWithNonce(singleton.address, "0x", saltNumber);
    await factory.createProxyWithNonce(singleton.address, "0x", saltNumber).then((tx: any) => tx.wait());
    const Safe = await hre.ethers.getContractFactory(safeContractUnderTest());
    return Safe.attach(template);
};

export const getSafeWithOwners = async (
    owners: string[],
    threshold?: number,
    fallbackHandler?: string,
    logGasUsage?: boolean,
    saltNumber: string = getRandomIntAsString(),
): Promise<Contract> => {
    const template = await getSafeTemplate(saltNumber);
    await logGas(
        `Setup Safe with ${owners.length} owner(s)${fallbackHandler && fallbackHandler !== AddressZero ? " and fallback handler" : ""}`,
        template.setup(owners, threshold || owners.length, AddressZero, "0x", fallbackHandler || AddressZero, AddressZero, 0, AddressZero),
        !logGasUsage,
    );
    return template;
};

export const getDefaultCallbackHandler = async (): Promise<Contract> => {
    return (await defaultCallbackHandlerContract()).attach((await defaultCallbackHandlerDeployment()).address);
};

export const getCompatFallbackHandler = async (): Promise<Contract> => {
    return (await compatFallbackHandlerContract()).attach((await compatFallbackHandlerDeployment()).address);
};

export const getSafeProxyRuntimeCode = async (): Promise<string> => {
    const proxyArtifact = await hre.artifacts.readArtifact("SafeProxy");

    return proxyArtifact.deployedBytecode;
};

export const compile = async (source: string) => {
    const input = JSON.stringify({
        language: "Solidity",
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
        sources: {
            "tmp.sol": {
                content: source,
            },
        },
    });
    const solcData = await solc.compile(input);
    const output = JSON.parse(solcData);
    if (!output["contracts"]) {
        console.log(output);
        throw Error("Could not compile contract");
    }
    const fileOutput = output["contracts"]["tmp.sol"];
    const contractOutput = fileOutput[Object.keys(fileOutput)[0]];
    const abi = contractOutput["abi"];
    const data = "0x" + contractOutput["evm"]["bytecode"]["object"];
    return {
        data: data,
        interface: abi,
    };
};

export const deployContract = async (deployer: Signer, source: string): Promise<Contract> => {
    const output = await compile(source);
    const transaction = await deployer.sendTransaction({ data: output.data, gasLimit: 6000000 });
    const receipt = await transaction.wait();
    return new Contract(receipt.contractAddress, output.interface, deployer);
};
