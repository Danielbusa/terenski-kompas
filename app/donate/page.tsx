"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HandCoins, LockKeyhole, RefreshCw } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { defaultPaymentConfig, createIpsPayload } from "@/lib/payments";

const presets = [500, 1000, 2000, 5000];

export default function DonatePage() {
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
        setQrError(error instanceof Error ? error.message : "QR kod trenutno nije moguće generisati.");
      });
    return () => { active = false; };
  }, [payload]);
  return <div className="public-page"><PublicHeader /><main className="donate-layout"><section className="donate-copy"><p className="eyebrow">MIKRO-DONACIJE</p><h1>Mala pomoć. Veliki domet.</h1><p>Tvoja donacija pomaže štampanje terenskog materijala, obuku kontrolora i dolazak volontera do svakog mesta.</p><div className="donate-assurance"><span><LockKeyhole /></span><div><b>Plaćanje kroz tvoju banku</b><p>QR kod ne prikuplja niti čuva podatke platne kartice.</p></div></div><div className="beneficiary"><small>Primalac</small><b>{defaultPaymentConfig.beneficiaryName}</b><span>Račun: {defaultPaymentConfig.account}</span><span>Šifra plaćanja: {defaultPaymentConfig.paymentCode}</span></div></section>
    <section className="qr-card"><div className="qr-head"><span><HandCoins /></span><div><p className="eyebrow">NBS IPS QR</p><h2>Skeniraj i doniraj</h2></div></div><div className="preset-row">{presets.map(value => <button type="button" key={value} className={amount === value ? "active" : ""} onClick={() => setAmount(value)}>{value.toLocaleString("sr-RS")} RSD</button>)}</div><LabelledAmount amount={amount} setAmount={setAmount} />{qr ? <img className="ips-qr" src={qr} alt={`IPS QR kod za donaciju od ${amount} dinara`} /> : qrError ? <div className="qr-error" role="alert"><b>QR kod nije generisan.</b><span>{qrError}</span></div> : <div className="qr-loading" aria-label="Generisanje QR koda"><RefreshCw className="spin" /></div>}<div className="qr-summary"><span><b>{Math.max(1, amount).toLocaleString("sr-RS")} RSD</b><small>{defaultPaymentConfig.purpose}</small></span><CheckCircle2 /></div><p className="qr-help">Otvori aplikaciju svoje banke, izaberi IPS skeniraj i potvrdi podatke pre plaćanja.</p></section>
  </main><Toaster richColors position="top-center" /></div>;
}

function LabelledAmount({ amount, setAmount }: { amount: number; setAmount: (value: number) => void }) {
  return <label className="amount-field"><span>Drugi iznos</span><div><Input type="number" min={1} step={100} value={amount} onChange={event => setAmount(Number(event.target.value))} /><b>RSD</b></div></label>;
}
