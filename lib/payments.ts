export type PaymentConfig = {
  beneficiaryName: string;
  account: string;
  paymentCode: string;
  purpose: string;
  referencePrefix: string;
};

export const defaultPaymentConfig: PaymentConfig = {
  beneficiaryName:
    process.env.NEXT_PUBLIC_NBS_BENEFICIARY_NAME ?? "STUDENTSKA LISTA - SUSS",
  account: process.env.NEXT_PUBLIC_NBS_ACCOUNT ?? "840000000000000000",
  paymentCode: process.env.NEXT_PUBLIC_NBS_PAYMENT_CODE ?? "289",
  purpose:
    process.env.NEXT_PUBLIC_NBS_PURPOSE ??
    "Donacija za SUSS terensku kampanju",
  referencePrefix: process.env.NEXT_PUBLIC_NBS_REFERENCE_PREFIX ?? "SUSS",
};

export function formatIpsAmount(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

export function createIpsPayload(
  amount: number,
  config: PaymentConfig,
  reference: string,
) {
  return [
    "K:PR",
    "V:01",
    "C:1",
    `R:${config.account.replace(/\D/g, "")}`,
    `N:${config.beneficiaryName}`,
    `I:RSD${formatIpsAmount(amount)}`,
    `SF:${config.paymentCode}`,
    `S:${config.purpose}`,
    `RO:00${reference}`,
  ].join("|");
}
