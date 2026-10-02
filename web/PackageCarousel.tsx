import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Gem as GemIcon,
  Orbit,
  Heart,
} from "lucide-react";

export const PACKAGES = [
  {
    grams: 10,
    name: "Idrok",
    color: "#66a9ff",
    image: new URL("./assets/cases/v2/sapphire.webp", import.meta.url).href,
  },
  {
    grams: 20,
    name: "Zakovat",
    color: "#ff6b83",
    image: new URL("./assets/cases/v2/ruby.webp", import.meta.url).href,
  },
  {
    grams: 50,
    name: "Tafakkur",
    color: "#64dda3",
    image: new URL("./assets/cases/v2/emerald.webp", import.meta.url).href,
  },
  {
    grams: 100,
    name: "Zehn",
    color: "#6cc8ff",
    image: new URL("./assets/cases/v2/diamond.webp", import.meta.url).href,
  },
  {
    grams: 150,
    name: "Ilhom",
    color: "#6cc8ff",
    image: new URL("./assets/cases/v2/neuron.webp", import.meta.url).href,
  },
  {
    grams: 250,
    name: "Donolik",
    color: "#c394ff",
    image: new URL("./assets/cases/v2/black-hole.webp", import.meta.url).href,
  },
  {
    grams: 350,
    name: "Koinot",
    color: "#ff977d",
    image: new URL("./assets/cases/v2/nebula.webp", import.meta.url).href,
  },
  {
    grams: 500,
    name: "Daholik",
    color: "#9baeff",
    image: new URL("./assets/cases/v2/dark-matter.webp", import.meta.url).href,
  },
];
type Pack = (typeof PACKAGES)[number];
export function CaseArtwork({
  pack = PACKAGES[3],
  eager = false,
}: {
  pack?: Pack;
  eager?: boolean;
}) {
  return (
    <img
      src={pack.image}
      alt=""
      className="case-art"
      width={640}
      height={640}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

export function CaseCatalog({
  grams,
  onChange,
  storageKey = "farosat-case-favorites",
}: {
  grams: number;
  onChange: (grams: number) => void;
  storageKey?: string;
}) {
  const [category, setCategory] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      setFavorites(Array.isArray(saved) ? saved.filter((value) => PACKAGES.some((pack) => pack.grams === value)) : []);
    } catch { setFavorites([]); }
  }, [storageKey]);
  const toggleFavorite = (grams: number) => {
    const next = favorites.includes(grams) ? favorites.filter((value) => value !== grams) : [...favorites, grams];
    setFavorites(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
  };
  const shown = (items: typeof PACKAGES) => onlyFavorites ? items.filter((pack) => favorites.includes(pack.grams)) : items;
  const hasVisibleCases = shown(category === "crystal" ? PACKAGES.slice(0, 4) : category === "cosmic" ? PACKAGES.slice(4) : PACKAGES).length > 0;
  return (
    <div className="case-catalog" role="region" aria-label="Keyslar katalogi">
      <div className="catalog-heading"><h2>Barcha farosat keyslari</h2><span>1 Star = 1 gramm</span></div>
      <div className="catalog-toolbar">
        <div className="catalog-tabs" aria-label="Keys kategoriyalari">
          {[["all", "Barchasi"], ["crystal", "Kristallar"], ["cosmic", "Koinot"]].map(([id, title]) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{title}</button>)}
        </div>
        <button className={"catalog-favorites " + (onlyFavorites ? "active" : "")} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites((value) => !value)}><Heart size={17} fill={onlyFavorites ? "currentColor" : "none"} /> Tanlanganlar ({favorites.length})</button>
      </div>
      {[
        {
          id: "crystal",
          title: "Farosat toshlari",
          icon: GemIcon,
          items: PACKAGES.slice(0, 4),
        },
        {
          id: "cosmic",
          title: "Koinot farosati",
          icon: Orbit,
          items: PACKAGES.slice(4),
        },
      ].filter((section) => (category === "all" || category === section.id) && shown(section.items).length).map((section) => (
        <section className="case-category" key={section.title}>
          <div className="case-category-heading">
            <section.icon size={27} />
            <div>
              <h2>{section.title}</h2>
            </div>
          </div>
          <div className="case-grid">
            {shown(section.items).map((pack) => (
              <article
                key={pack.grams}
                className={
                  "case-card " + (grams === pack.grams ? "selected" : "")
                }
                style={{ "--case-color": pack.color } as React.CSSProperties}
              >
                <button className="case-favorite" aria-label={`${pack.name} keysini tanlanganlarga ${favorites.includes(pack.grams) ? "olib tashlash" : "qo‘shish"}`} aria-pressed={favorites.includes(pack.grams)} onClick={() => toggleFavorite(pack.grams)}><Heart size={18} fill={favorites.includes(pack.grams) ? "currentColor" : "none"} /></button>
                <button className="case-main" type="button" aria-label={`${pack.name}: ${pack.grams} gramm`} aria-pressed={grams === pack.grams} onClick={() => onChange(pack.grams)}>
                <div className="case-image-wrap">
                  <CaseArtwork pack={pack} eager={pack.grams <= 50} />
                </div>
                <h3>{pack.name}</h3>
                <span className="case-price">
                  <Star size={14} fill="currentColor" />
                  {pack.grams}
                </span>
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
      {!hasVisibleCases && <div className="catalog-empty"><Heart size={28} /><h3>{favorites.length ? "Bu kategoriyada tanlangan keyslar yo‘q" : "Hali tanlangan keyslar yo‘q"}</h3><p>Yoqtirgan keysingizdagi yurak belgisini bosing.</p></div>}
    </div>
  );
}

export function PackageCarousel({
  grams,
  onChange,
}: {
  grams: number;
  onChange: (grams: number) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const index = PACKAGES.findIndex((p) => p.grams === grams);
  const active =
    index < 0
      ? PACKAGES.reduce(
          (best, p, i) =>
            Math.abs(p.grams - grams) < Math.abs(PACKAGES[best].grams - grams)
              ? i
              : best,
          0,
        )
      : index;
  const selected = PACKAGES[active];
  const move = (direction: number) =>
    onChange(
      PACKAGES[(active + direction + PACKAGES.length) % PACKAGES.length].grams,
    );
  return (
    <div
      className="package-carousel"
      style={{ "--gem-color": selected.color } as React.CSSProperties}
    >
      <div
        className="package-scene"
        role="region"
        aria-label="Farosat paketlari"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            move(e.key === "ArrowLeft" ? -1 : 1);
          }
        }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onPointerUp={(e) => {
          const point = start.current;
          start.current = null;
          if (!point) return;
          const dx = e.clientX - point.x,
            dy = e.clientY - point.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
            move(dx < 0 ? 1 : -1);
        }}
      >
        <div className="gem-halo" />
        <div className="gem-main" key={grams}>
          <CaseArtwork pack={selected} eager />
        </div>
        <div className="gem-orbit" />
        <button
          type="button"
          className="carousel-arrow previous"
          aria-label="Oldingi paket"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          className="carousel-arrow next"
          aria-label="Keyingi paket"
          onClick={() => move(1)}
        >
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="package-dots" aria-label="Paketni tanlang">
        {PACKAGES.map((p, i) => (
          <button
            key={p.grams}
            type="button"
            aria-label={`${p.name}: ${p.grams} gramm`}
            aria-pressed={index === i}
            className={index === i ? "active" : ""}
            onClick={() => onChange(p.grams)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="package-caption" aria-live="polite" aria-atomic="true">
        <span className="package-name">
          {index < 0 ? "Sizning tanlovingiz" : selected.name}
        </span>
        <div className="package-grams">
          <strong>{grams || 0}</strong>
          <span>gramm farosat</span>
        </div>
        <span className="package-price">
          <Star size={14} /> {grams || 0} Stars
        </span>
      </div>
    </div>
  );
}
