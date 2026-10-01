import React, { useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Gem as GemIcon,
  Orbit,
  Check,
} from "lucide-react";

export const PACKAGES = [
  {
    grams: 10,
    name: "Idrok",
    color: "#66a9ff",
    image: new URL("./assets/cases/idrok.webp", import.meta.url).href,
  },
  {
    grams: 20,
    name: "Zakovat",
    color: "#ff6b83",
    image: new URL("./assets/cases/zakovat.webp", import.meta.url).href,
  },
  {
    grams: 50,
    name: "Tafakkur",
    color: "#64dda3",
    image: new URL("./assets/cases/tafakkur.webp", import.meta.url).href,
  },
  {
    grams: 100,
    name: "Zehn",
    color: "#6cc8ff",
    image: new URL("./assets/cases/zehn.webp", import.meta.url).href,
  },
  {
    grams: 250,
    name: "Donolik",
    color: "#c394ff",
    image: new URL("./assets/cases/donolik.webp", import.meta.url).href,
  },
  {
    grams: 500,
    name: "Daholik",
    color: "#f4c96d",
    image: new URL("./assets/cases/daholik.webp", import.meta.url).href,
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
}: {
  grams: number;
  onChange: (grams: number) => void;
}) {
  return (
    <div className="case-catalog" role="region" aria-label="Keyslar katalogi">
      {[
        {
          title: "Farosat toshlari",
          subtitle: "Kichik qadam. Katta farosat.",
          icon: GemIcon,
          items: PACKAGES.slice(0, 3),
        },
        {
          title: "Koinot farosati",
          subtitle: "Fikringiz uchun yangi ufqlar.",
          icon: Orbit,
          items: PACKAGES.slice(3),
        },
      ].map((section) => (
        <section className="case-category" key={section.title}>
          <div className="case-category-heading">
            <section.icon size={27} />
            <div>
              <h2>{section.title}</h2>
              <p>{section.subtitle}</p>
            </div>
          </div>
          <div className="case-grid">
            {section.items.map((pack) => (
              <button
                key={pack.grams}
                type="button"
                className={
                  "case-card " + (grams === pack.grams ? "selected" : "")
                }
                style={{ "--case-color": pack.color } as React.CSSProperties}
                aria-label={`${pack.name}: ${pack.grams} gramm`}
                aria-pressed={grams === pack.grams}
                onClick={() => onChange(pack.grams)}
              >
                {grams === pack.grams && (
                  <span className="case-selected">
                    <Check size={12} /> Tanlangan
                  </span>
                )}
                {pack.grams === 100 && grams !== pack.grams && (
                  <span className="case-popular">Ommabop</span>
                )}
                <div className="case-image-wrap">
                  <CaseArtwork pack={pack} eager={pack.grams <= 50} />
                </div>
                <h3>{pack.name}</h3>
                <span className="case-quantity">
                  {pack.grams} gramm farosat
                </span>
                <span className="case-price">
                  <Star size={14} fill="currentColor" />
                  {pack.grams}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
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
