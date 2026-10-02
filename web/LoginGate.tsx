import React from "react";
import { ArrowRight, Brain, LockKeyhole } from "lucide-react";

const art = new URL("./assets/store/hero.webp", import.meta.url).href;

export function LoginGate({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-art">
          <img src={art} alt="" width={1536} height={1024} decoding="async" />
          <span><Brain size={23} /> farosatxona.</span>
        </div>
        <section className="auth-content" aria-label="Telegram orqali kirish">
          <span className="eyebrow">FAROSAT SIZ BILAN</span>
          <h1>Farosatning yangi manzili.</h1>
          <p>Hisobingiz, reyting va Qora bozor — barchasi Telegram ichida. Bot orqali ilovani oching va o‘z hisobingizga kiring.</p>
          <a className="auth-telegram" href="https://t.me/farosatxonabot?startapp" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.6 3.8 18.4 20c-.2 1.1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9L18 6.9c.4-.3-.1-.5-.5-.2L6.3 13.8l-4.8-1.5c-1-.3-1-1 .2-1.4L20.3 3.7c.9-.3 1.5.2 1.3.1Z" /></svg>
            Telegramda ochish <ArrowRight size={17} />
          </a>
          {error && <div className="inline-error" role="alert"><LockKeyhole size={17} />{error}</div>}
          <button className="auth-retry" onClick={onRetry}>Qayta urinish <ArrowRight size={15} /></button>
          <small>Hisob Telegram orqali tasdiqlanadi. Xaridlar Telegram Stars bilan amalga oshiriladi.</small>
        </section>
      </div>
    </div>
  );
}
