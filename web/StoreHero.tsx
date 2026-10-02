import React, { useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Brain, Flame, Sparkles, Pause, Play } from "lucide-react";
import type { Row } from "./api";

const art = new URL("./assets/store/hero.webp", import.meta.url).href;
const slides = [
  { label: "FAROSAT OLAMI", title: "Farosatingizga yangi kuch.", description: "Kristallardan koinotgacha. O‘zingizga mos keysni tanlang va guruhingizda bir qadam oldinga chiqing.", action: "Keyslarni ko‘rish" },
  { label: "KUNLIK LUQMA", title: "Har kuni bir luqma.", description: "Bugungi farosatingizni sinab ko‘ring. Seriyani davom ettiring va guruh reytingida o‘z o‘rningizni toping.", action: "Mening farosatim" },
  { label: "TELEGRAM STARS", title: "Bir Star. Bir gramm.", description: "Oddiy va aniq hisob. Xaridingiz aynan tanlagan guruhingizdagi farosat balansiga tushadi.", action: "Qora bozorga o‘tish" },
];

export function StoreHero({ profile, onBrowse, onProfile }: { profile: Row | null; onBrowse: () => void; onProfile: () => void }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  useEffect(() => {
    if (paused || manualPaused || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const timer = setInterval(() => setActive((value) => (value + 1) % slides.length), 8000);
    return () => clearInterval(timer);
  }, [paused, manualPaused]);
  const slide = slides[active];
  return (
    <div className="store-hero-grid">
      <section className="store-hero-banner" aria-label="Farosatxona bannerlari" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setPaused(false); }}>
        <img src={art} alt="" className="store-hero-art" width="1536" height="1024" decoding="async" />
        <div className="store-hero-shade" />
        <div className="store-hero-copy" key={active}>
          <span className="eyebrow">{slide.label}</span>
          <h2>{slide.title}</h2>
          <p>{slide.description}</p>
          <button className="hero-cta" onClick={active === 1 ? onProfile : onBrowse}>{slide.action} <ArrowUpRight size={18} /></button>
        </div>
        <div className="hero-pagination" aria-label="Banner tanlash">
          {slides.map((item, index) => <button key={item.label} aria-label={`${index + 1}-banner`} aria-pressed={active === index} onClick={() => setActive(index)}><span /></button>)}
        </div>
        <div className="hero-arrows">
          <button aria-label={manualPaused ? "Banner aylanishini davom ettirish" : "Banner aylanishini to‘xtatish"} aria-pressed={manualPaused} onClick={() => setManualPaused((value) => !value)}>{manualPaused ? <Play size={16} /> : <Pause size={16} />}</button>
          <button aria-label="Oldingi banner" onClick={() => setActive((value) => (value + slides.length - 1) % slides.length)}><ChevronLeft size={20} /></button>
          <button aria-label="Keyingi banner" onClick={() => setActive((value) => (value + 1) % slides.length)}><ChevronRight size={20} /></button>
        </div>
      </section>
      <div className="store-feature-stack">
        <section className="store-account-tile">
          <span className="tile-label"><Brain size={17} /> Sizning farosatingiz</span>
          <strong>{profile ? new Intl.NumberFormat("uz-UZ").format(profile.player.grams) : "…"}<small>gramm</small></strong>
          <div className="tile-footer"><span>{profile?.level?.emoji} {profile?.level?.name || "Hisob yuklanmoqda"}</span><button onClick={onProfile} aria-label="Farosat hisobini ochish"><ArrowUpRight size={19} /></button></div>
        </section>
        <section className="store-daily-tile">
          <span className="tile-label"><Sparkles size={17} /> Bugungi luqma</span>
          <p>{profile?.alreadyPlayed ? "Bugungi nasiba olingan." : "Bugun qancha farosat chiqarkin?"}</p>
          <div className="tile-footer"><span><Flame size={15} /> {profile?.player?.streak || 0} kunlik seriya</span><button onClick={onProfile}>{profile?.alreadyPlayed ? "Hisobim" : "Farosat olish"} <ArrowUpRight size={16} /></button></div>
        </section>
      </div>
    </div>
  );
}
