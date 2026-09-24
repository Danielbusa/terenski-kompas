"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HandCoins, LockKeyhole, RefreshCw } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { defaultPaymentConfig, createIpsPayload } from "@/lib/payments";
import { useLanguage } from "@/components/language-provider";

const presets = [500, 1000, 2000, 5000];

export default function DonatePage() {
  const { t, language } = useLanguage();
  const [amount, setAmount] = useState(1000);
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState("");
  const reference = `${defaultPaymentConfig.referencePrefix}-DONACIJA`;
  const payload = useMemo(() => createIpsPayload(Math.max(1, amount || 0), defaultPaymentConfig, reference), [amount, reference]);
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 360 }))
      .then((value) => {
        if (!active) return;
        setQr(value);
        setQrError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setQr("");
        setQrError(error instanceof Error ? error.message : t("QR kod trenutno nije moguće generisati.", "The QR code could not be generated."));
      });
    return () => { active = false; };
  }, [payload, t]);
  return <div className="public-page"><PublicHeader /><main className="donate-layout"><section className="donate-copy"><p className="eyebrow">{t("MIKRO-DONACIJE", "MICRO-DONATIONS")}</p><h1>{t("Mala pomoć. Veliki domet.", "Small gift. Big reach.")}</h1><p>{t("Tvoja donacija pomaže štampanje terenskog materijala, obuku kontrolora i dolazak volontera do svakog mesta.", "Your donation supports field materials, poll-watcher training, and volunteer travel.")}</p><div className="donate-assurance"><span><LockKeyhole /></span><div><b>{t("Plaćanje kroz tvoju banku", "Payment through your bank")}</b><p>{t("QR kod ne prikuplja niti čuva podatke platne kartice.", "The QR code does not collect or store card details.")}</p></div></div><div className="beneficiary"><small>{t("Primalac", "Beneficiary")}</small><b>{defaultPaymentConfig.beneficiaryName}</b><span>{t("Račun", "Account")}: {defaultPaymentConfig.account}</span><span>{t("Šifra plaćanja", "Payment code")}: {defaultPaymentConfig.paymentCode}</span></div></section>
    <section className="qr-card"><div className="qr-head"><span><HandCoins /></span><div><p className="eyebrow">NBS IPS QR</p><h2>{t("Skeniraj i doniraj", "Scan and donate")}</h2></div></div><div className="preset-row">{presets.map(value => <button type="button" key={value} className={amount === value ? "active" : ""} onClick={() => setAmount(value)}>{value.toLocaleString(language === "sr" ? "sr-RS" : "en-GB")} RSD</button>)}</div><LabelledAmount amount={amount} setAmount={setAmount} label={t("Drugi iznos", "Custom amount")} />{qr ? <img className="ips-qr" src={qr} alt={t(`IPS QR kod za donaciju od ${amount} dinara`, `IPS QR code for a ${amount} RSD donation`)} /> : qrError ? <div className="qr-error" role="alert"><b>{t("QR kod nije generisan.", "QR code was not generated.")}</b><span>{qrError}</span></div> : <div className="qr-loading" aria-label={t("Generisanje QR koda", "Generating QR code")}><RefreshCw className="spin" /></div>}<div className="qr-summary"><span><b>{Math.max(1, amount).toLocaleString(language === "sr" ? "sr-RS" : "en-GB")} RSD</b><small>{defaultPaymentConfig.purpose}</small></span><CheckCircle2 /></div><p className="qr-help">{t("Otvori aplikaciju svoje banke, izaberi IPS skeniraj i potvrdi podatke pre plaćanja.", "Open your banking app, choose IPS scan, and confirm the details before paying.")}</p></section>
  </main><Toaster richColors position="top-center" /></div>;
}

function LabelledAmount({ amount, setAmount, label }: { amount: number; setAmount: (value: number) => void; label: string }) {
  return <label className="amount-field"><span>{label}</span><div><Input type="number" min={1} step={100} value={amount} onChange={event => setAmount(Number(event.target.value))} /><b>RSD</b></div></label>;
}
