type SafeSingletonType = "Safe" | "SafeL2";

export const safeContractUnderTest = (): SafeSingletonType | undefined => {
    return !process.env.SAFE_CONTRACT_UNDER_TEST ? "Safe" : process.env.SAFE_CONTRACT_UNDER_TEST;
};
