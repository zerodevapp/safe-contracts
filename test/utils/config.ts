enum SafeSingletonTypes {
    Safe = "Safe",
    SafeL2 = "SafeL2",
}

export const safeContractUnderTest = (): SafeSingletonTypes => {
    if (typeof process.env.SAFE_CONTRACT_UNDER_TEST !== "undefined" && process.env.SAFE_CONTRACT_UNDER_TEST in SafeSingletonTypes) {
        return process.env.SAFE_CONTRACT_UNDER_TEST as SafeSingletonTypes;
    }

    return SafeSingletonTypes.Safe;
};
