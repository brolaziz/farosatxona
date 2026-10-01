import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Wallet,
  Megaphone,
  Settings2,
  ShieldCheck,
  ScrollText,
  Activity,
  Database,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Plus,
  Search,
  X,
  Check,
  Star,
  Brain,
  Flame,
  Trophy,
  ShoppingBag,
  CircleUserRound,
  Menu,
  ChevronDown,
  Download,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Send,
  LockKeyhole,
  LogOut,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  api,
  post,
  patch,
  download,
  setToken,
  type Row,
  type Session,
} from "./api";
import "./style.css";
import "@fontsource-variable/nunito";
import "./experience.css";
import {
  PackageCarousel,
  CaseCatalog,
  CaseArtwork,
  PACKAGES,
} from "./PackageCarousel";

declare global {
  interface Window {
    Telegram?: { WebApp: any };
  }
}
const format = (n: number | undefined) =>
  new Intl.NumberFormat("uz-UZ").format(n || 0);
const date = (s: string) =>
  s
    ? new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z").toLocaleString(
        "uz-UZ",
        {
          timeZone: "Asia/Tashkent",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        },
      )
    : "—";
const labels: Row = {
  pending: "Kutilmoqda",
  credited: "Bajarilgan",
  refunded: "Qaytarilgan",
  duplicate: "Tekshirish kerak",
  scheduled: "Rejalashtirilgan",
  queued: "Yuborilmoqda",
  cancelled: "Bekor qilingan",
  done: "Bajarilgan",
  failed: "Xatolik",
  completed: "Bajarilgan",
};
const roleLabels: Row = {
  owner: "Tizim egasi",
  admin: "Administrator",
  moderator: "Moderator",
  viewer: "Kuzatuvchi",
  user: "Farosat egasi",
};
const nav = [
  {
    id: "dashboard",
    title: "Boshqaruv paneli",
    icon: LayoutDashboard,
    permission: "read",
  },
  { id: "groups", title: "Guruhlar", icon: Building2, permission: "read" },
  { id: "players", title: "Foydalanuvchilar", icon: Users, permission: "read" },
  { id: "orders", title: "To‘lovlar", icon: Wallet, permission: "finance" },
  {
    id: "broadcasts",
    title: "E’lonlar",
    icon: Megaphone,
    permission: "settings",
  },
  {
    id: "settings",
    title: "O‘yin sozlamalari",
    icon: Settings2,
    permission: "settings",
  },
  { id: "roles", title: "Adminlar", icon: ShieldCheck, permission: "owner" },
  {
    id: "audit",
    title: "Amallar tarixi",
    icon: ScrollText,
    permission: "read",
  },
  {
    id: "system",
    title: "Tizim holati",
    icon: Activity,
    permission: "settings",
  },
  { id: "data", title: "Ma’lumotlar", icon: Database, permission: "finance" },
];
const userNav = [
  { id: "home", title: "Bosh sahifa", icon: Brain },
  { id: "shop", title: "Qora bozor", icon: ShoppingBag },
  { id: "ranking", title: "Reyting", icon: Trophy },
  { id: "profile", title: "Profil", icon: CircleUserRound },
];
function Badge({
  status,
  children,
}: {
  status?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={"badge " + (status || "")}>
      <i />
      {children || labels[status || ""] || status}
    </span>
  );
}
function Empty({
  title = "Hozircha ma’lumot yo‘q",
  detail = "Natijalar shu yerda ko‘rinadi.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <Brain size={32} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function Avatar({ name, size = "" }: { name: string; size?: string }) {
  return (
    <span className={"avatar " + size}>
      {(name || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current
      ?.querySelector<HTMLElement>("button,input,select,textarea,a")
      ?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || []),
        ];
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay" onClick={close}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Yopish" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Metric({
  title,
  value,
  icon: Icon,
  note,
  accent = false,
}: {
  title: string;
  value: string;
  icon: any;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={"metric " + (accent ? "accent-metric" : "")}>
      <div className="metric-label">
        {title}
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <span>{note}</span>
    </div>
  );
}
export function App() {
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [booting, setBooting] = useState(true);
  const [admin, setAdmin] = useState(true),
    [tab, setTab] = useState("dashboard"),
    [mobileMenu, setMobileMenu] = useState(false);
  const [group, setGroup] = useState(""),
    [data, setData] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState(""),
    [q, setQ] = useState(""),
    [debounced, setDebounced] = useState(""),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState(""),
    [days, setDays] = useState(7);
  const [quickSearch, setQuickSearch] = useState("");
  const quickSearchRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLElement>(null);
  const [modal, setModal] = useState<Row | null>(null),
    [form, setForm] = useState<Row>({}),
    [detail, setDetail] = useState<Row | null>(null);
  const [grams, setGrams] = useState(100),
    [terms, setTerms] = useState(false),
    [order, setOrder] = useState<Row | null>(null),
    [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState<Row | null>(null);
  const loadSequence = useRef(0);
  const clearPage = () => {
    // Invalidate pending responses before rendering a page with another schema.
    loadSequence.current++;
    setData(null);
    setBusy(true);
    setError("");
  };
  const can = (permission: string) =>
    session &&
    (permission === "owner"
      ? session.role === "owner"
      : permission === "manage"
        ? ["owner", "admin", "moderator"].includes(session.role)
        : permission === "read"
          ? session.role !== "user"
          : ["owner", "admin"].includes(session.role));
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  };
  const login = async (mode?: string) => {
    clearPage();
    setBooting(true);
    setError("");
    try {
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor("#161718");
      tg?.setBackgroundColor("#161718");
      tg?.setBottomBarColor?.("#161718");
      const result = await post("session", {
        initData: tg?.initData || "",
        mode,
      });
      setToken(result.token);
      setSession(result);
      const isAdmin = result.role !== "user";
      setAdmin(isAdmin);
      setTab(isAdmin ? (result.chat_id ? "groups" : "dashboard") : "home");
      const start = tg?.initDataUnsafe?.start_param || "";
      const hinted =
        new URLSearchParams(location.search).get("group") ||
        (start.startsWith("group_") ? "-" + start.slice(6) : "");
      setGroup(
        result.groups.find((c: Row) => c.chat_id === hinted)?.chat_id ||
          result.groups[0]?.chat_id ||
          "",
      );
      setQ("");
      setFilter("");
      setOffset(0);
      setOrder(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooting(false);
    }
  };
  useEffect(() => {
    void login();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        admin &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        quickSearchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [admin]);
  const load = useCallback(async () => {
    if (!session) return;
    const sequence = ++loadSequence.current;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({
      q: debounced,
      offset: String(offset),
      limit: "20",
    });
    try {
      let result;
      if (!admin) {
        if (!group) {
          setData(null);
          return;
        }
        result =
          tab === "ranking"
            ? await api(
                "me/leaderboard?chatId=" +
                  group +
                  "&bucket=" +
                  (filter || "total"),
              )
            : await api("me/profile?chatId=" + group);
      } else {
        if (tab === "dashboard")
          result = await api("admin/dashboard?days=" + days);
        else if (tab === "groups")
          result = await api("admin/groups?" + params + "&type=" + filter);
        else if (tab === "players")
          result = await api("admin/players?" + params + "&chatId=" + filter);
        else if (tab === "orders")
          result = await api("admin/orders?" + params + "&status=" + filter);
        else if (tab === "audit") result = await api("admin/audit?" + params);
        else if (tab === "system") result = await api("admin/health");
        else if (tab === "data")
          result = can("owner") ? await api("admin/backups") : { items: [] };
        else result = await api("admin/" + tab);
      }
      if (sequence !== loadSequence.current) return;
      setData(result);
      if (tab === "settings") setSettings(result);
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setError((e as Error).message);
      setData(null);
      if ((e as Row).statusCode === 401) {
        setSession(null);
        setToken("");
      }
    } finally {
      if (sequence === loadSequence.current) setBusy(false);
    }
  }, [session, admin, group, tab, debounced, offset, filter, days]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load]);
  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const timer = setInterval(async () => {
      try {
        const result = await api("me/orders/" + order.id);
        setOrder(result);
        if (result.status === "credited") {
          notify("Xarid bajarildi. Farosat hisobingizga tushdi.");
          void load();
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [order?.id, order?.status, load]);
  const changeTab = (id: string) => {
    clearPage();
    setTab(id);
    setOffset(0);
    setQ("");
    setFilter("");
    setMobileMenu(false);
    setModal(null);
  };
  const act = async (
    fn: () => Promise<any>,
    success = "Saqlandi",
    close = true,
  ) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await fn();
      notify(success);
      if (close) setModal(null);
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  };
  const openPlayer = async (p: Row) => {
    setModal({ kind: "player", player: p });
    setDetail(null);
    try {
      setDetail(await api("admin/players/" + p.chat_id + "/" + p.user_id));
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const purchase = async () => {
    if (!terms) {
      notify("Avval xarid shartlarini tasdiqlang.");
      return;
    }
    if (session?.preview) {
      notify("Namoyishda haqiqiy Stars to‘lovlari o‘chirilgan.");
      return;
    }
    setActionBusy(true);
    try {
      const created = await post("me/orders", {
        chatId: group,
        grams,
        acceptTerms: true,
      });
      setOrder(created);
      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) throw new Error("To‘lovni Telegram ichida oching.");
      tg.openInvoice(created.invoice_url, (status: string) => {
        if (status === "cancelled") notify("To‘lov bekor qilindi.");
        if (status === "failed")
          notify("To‘lov bajarilmadi. Qayta urinib ko‘ring.");
      });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  };
  const remaining = data?.nextPlayAt
    ? Math.max(0, Math.floor((Date.parse(data.nextPlayAt) - now) / 1000))
    : 0;
  const countdown = [
    Math.floor(remaining / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const visibleNav = admin
    ? nav.filter(
        (item) =>
          can(item.permission) &&
          (!session?.chat_id || ["groups", "players"].includes(item.id)),
      )
    : userNav;
  const selectedChat = session?.groups.find((c) => c.chat_id === group);
  const heading = admin
    ? nav.find((n) => n.id === tab)?.title
    : userNav.find((n) => n.id === tab)?.title;
  const descriptions: Row = {
    dashboard: "Bugungi farosat, xaridlar va harakat bir ko‘rinishda.",
    groups: "Har bir guruh, bitta boshqaruv markazida.",
    players: "Farosat egalari va ularning natijalari.",
    orders: "Har bir Star va har bir gramm hisobda.",
    broadcasts: "Kerakli xabar, kerakli auditoriyaga.",
    settings: "O‘yin qoidalari sizning nazoratingizda.",
    roles: "Vakolatlar aniq, boshqaruv tartibli.",
    audit: "Barcha o‘zgarishlarning izi shu yerda.",
    system: "Bot va xizmatlarning ishlash holati.",
    data: "Ma’lumotlaringizni saqlang va eksport qiling.",
  };
  const field = (key: string, value: any) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  if (booting)
    return (
      <div className="gate">
        <div className="brand-mark large">
          <Brain />
        </div>
        <h2>Farosatxona</h2>
        <span className="spinner" />
        <p>Farosatingizni tayyorlayapmiz…</p>
      </div>
    );
  if (!session)
    return (
      <div className="gate">
        <div className="brand-mark large">
          <Brain />
        </div>
        <span className="eyebrow">FAROSATXONA</span>
        <h1>Farosatning yangi manzili.</h1>
        <p>Hisobingiz, reyting va Qora bozor — barchasi Telegram ichida.</p>
        <div className="inline-error">
          <LockKeyhole size={18} />
          {error}
        </div>
        <button className="primary" onClick={() => login()}>
          Qayta urinish <ArrowRight size={16} />
        </button>
      </div>
    );
  return (
    <div className={"app " + (!admin ? "user-app" : "")}>
      {mobileMenu && (
        <div className="menu-scrim" onClick={() => setMobileMenu(false)} />
      )}
      <aside className={"sidebar " + (mobileMenu ? "open" : "")}>
        <div className="brand">
          <div className="brand-mark">
            <Brain size={22} />
          </div>
          <div>
            <strong>
              farosatxona<span>.</span>
            </strong>
            <small>{admin ? "BOSHQARUV MARKAZI" : "FAROSAT OLAMI"}</small>
          </div>
        </div>
        <div className="workspace">
          <span className="workspace-icon">
            {admin ? <ShieldCheck size={18} /> : <Sparkles size={18} />}
          </span>
          <div>
            <b>{admin ? "Admin panel" : "Mening farosatim"}</b>
            <small>
              {admin ? "To‘liq nazorat sizda" : "Har kuni bir luqma"}
            </small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="nav-label">{admin ? "BOSHQARUV" : "KASHF ETING"}</span>
        <nav aria-label={admin ? "Admin menyusi" : "Asosiy menyu"}>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => changeTab(item.id)}
            >
              <item.icon size={18} />
              <span>{item.title}</span>
              {tab === item.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {session.role !== "user" && (
            <button
              className="switch-view"
              onClick={() => {
                setAdmin(!admin);
                changeTab(
                  admin ? "home" : session.chat_id ? "groups" : "dashboard",
                );
              }}
            >
              <ArrowUpRight size={16} />
              {admin ? "Foydalanuvchi oynasi" : "Admin boshqaruvi"}
            </button>
          )}
          <div className="system-indicator">
            <i />
            {session.preview ? "Namoyish rejimi" : "Telegram bilan ulangan"}
          </div>
          <div className="account">
            <Avatar name={session.user.first_name} />
            <div>
              <b>{session.user.first_name}</b>
              <small>{roleLabels[session.role]}</small>
            </div>
            <ShieldCheck size={17} />
          </div>
          <div className="sidebar-clock">
            <time>
              {new Intl.DateTimeFormat("uz-UZ", {
                timeZone: "Asia/Tashkent",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(now)}
            </time>
            <span>
              {new Intl.DateTimeFormat("uz-UZ", {
                timeZone: "Asia/Tashkent",
                day: "numeric",
                month: "long",
                weekday: "long",
              }).format(now)}
            </span>
            <small>
              Toshkent vaqti <i />
            </small>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-only"
              aria-label="Menyuni ochish"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={20} />
            </button>
            {!admin && <b>{heading}</b>}
            {admin && (
              <form
                className="quick-search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  changeTab("players");
                  setQ(quickSearch.trim());
                  setDebounced(quickSearch.trim());
                }}
              >
                <button type="submit" aria-label="Qidiruvni boshlash">
                  <Search size={17} />
                </button>
                <input
                  ref={quickSearchRef}
                  aria-label="Foydalanuvchini tezkor qidirish"
                  placeholder="Ism, username yoki ID qidiring"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                />
                <kbd>⌘ K</kbd>
              </form>
            )}
          </div>
          <div className="top-right">
            {session.preview && (
              <button
                className="demo-button"
                onClick={() =>
                  login(session.user.id === 1001 ? "user" : "admin")
                }
              >
                Namoyish ·{" "}
                {session.user.id === 1001
                  ? "User sifatida ko‘rish"
                  : "Admin sifatida ko‘rish"}
              </button>
            )}
            <span className="live">
              <i />
              {session.preview ? "DEMO" : "ULANGAN"}
            </span>
            <Avatar name={session.user.first_name} size="small" />
            <div className="header-account">
              <b>{session.user.first_name}</b>
              <small>{roleLabels[session.role]}</small>
            </div>
          </div>
        </header>
        <main>
          {session.preview && (
            <div className="preview-note">
              Bu alohida namoyish muhiti. Haqiqiy bot, hisoblar va Stars
              to‘lovlariga ta’sir qilmaydi.
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {admin ? "FAROSATXONA / ADMIN" : "FAROSAT SIZ BILAN"}
              </span>
              <h1>
                {!admin && tab === "home"
                  ? "Salom, " + session.user.first_name + "."
                  : heading}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {admin
                  ? descriptions[tab]
                  : tab === "shop"
                    ? "Farosat yetishmayaptimi? Omborda bor."
                    : tab === "ranking"
                      ? "Guruhning eng farosatli odamlari."
                      : "Bugungi luqmangizni unutib qo‘ymang."}
              </p>
            </div>
            <div className="heading-actions">
              {admin && tab === "dashboard" && (
                <select
                  aria-label="Hisobot davri"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={7}>Oxirgi 7 kun</option>
                  <option value={30}>Oxirgi 30 kun</option>
                  <option value={90}>Oxirgi 90 kun</option>
                </select>
              )}
              <button
                className="secondary refresh"
                aria-label="Yangilash"
                onClick={() => load()}
              >
                <RefreshCw size={16} className={busy ? "spinning" : ""} />
                <span>Yangilash</span>
              </button>
            </div>
          </div>
          {!admin && (
            <div className="group-selector">
              <Building2 size={18} />
              <select
                aria-label="Guruhni tanlang"
                value={group}
                onChange={(e) => {
                  clearPage();
                  setGroup(e.target.value);
                  setOrder(null);
                }}
              >
                <option value="" disabled>
                  Guruhni tanlang
                </option>
                {session.groups.map((c) => (
                  <option key={c.chat_id} value={c.chat_id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <span>Guruh hisobi</span>
            </div>
          )}
          {error && (
            <div className="inline-error">
              <AlertCircle size={18} />
              {error}
              <button className="text-btn" onClick={() => load()}>
                Qayta urinish
              </button>
            </div>
          )}
          {busy && !data && (
            <div className="loading">
              <span className="spinner" />
              Ma’lumotlar yuklanmoqda…
            </div>
          )}
          {!admin && !group && (
            <Empty
              title="Guruhingiz hali ko‘rinmayapti"
              detail="Bot qo‘shilgan guruhda /farosat yozing, keyin Web App’ni qayta oching."
            />
          )}
          {admin && tab === "dashboard" && data && (
            <>
              <div className="metrics">
                <Metric
                  title="Foydalanuvchilar"
                  value={format(data.stats.uniqueUsers)}
                  icon={Users}
                  note={format(data.stats.totalPlayers) + " ta guruh profili"}
                  accent
                />
                <Metric
                  title="Guruhlar"
                  value={format(data.stats.groups)}
                  icon={Building2}
                  note={format(data.stats.privateChats) + " ta shaxsiy chat"}
                />
                <Metric
                  title="Jami farosat"
                  value={format(data.stats.totalGrams) + " g"}
                  icon={Brain}
                  note={format(data.stats.paidGrams) + " g xarid qilingan"}
                />
                <Metric
                  title="Stars tushumi"
                  value={format(data.stats.stars)}
                  icon={Star}
                  note={format(data.stats.purchases) + " ta bajarilgan xarid"}
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Kunlik faollik</h2>
                      <p>Farosat olish uchun qilingan urinishlar</p>
                    </div>
                    <span className="chart-key">
                      <i />
                      Urinishlar
                    </span>
                  </div>
                  <div className="chart-summary">
                    <strong>
                      {format(
                        data.activity.reduce(
                          (sum: number, row: Row) => sum + row.plays,
                          0,
                        ),
                      )}
                    </strong>
                    <span>tanlangan davrda</span>
                  </div>
                  {data.activity.length ? (
                    <div className="chart">
                      <div className="chart-lines">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="bars">
                        {data.activity.map((row: Row) => (
                          <div
                            className="bar-slot"
                            key={row.day}
                            title={row.day + ": " + row.plays + " urinish"}
                          >
                            <div
                              style={{
                                height:
                                  Math.max(
                                    3,
                                    (row.plays /
                                      Math.max(
                                        ...data.activity.map(
                                          (r: Row) => r.plays,
                                        ),
                                      )) *
                                      100,
                                  ) + "%",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="chart-axis">
                        <span>{data.activity[0].day}</span>
                        <span>
                          {
                            data.activity[Math.floor(data.activity.length / 2)]
                              .day
                          }
                        </span>
                        <span>{data.activity.at(-1).day}</span>
                      </div>
                    </div>
                  ) : (
                    <Empty detail="Birinchi urinishdan keyin grafik paydo bo‘ladi." />
                  )}
                </section>
                <section className="panel today-panel">
                  <span className="eyebrow">BUGUNGI NATIJA</span>
                  <h2>Har bir gramm hisobda.</h2>
                  <div className="today-row">
                    <span>
                      <Brain size={17} />
                      Kunlik urinishlar
                    </span>
                    <strong>{format(data.stats.todayPlays)}</strong>
                  </div>
                  <div className="today-row">
                    <span>
                      <Star size={17} />
                      Stars tushumi
                    </span>
                    <strong className="accent-text">
                      {format(data.stats.todayStars)}
                    </strong>
                  </div>
                  <div className="today-row">
                    <span>
                      <Flame size={17} />
                      Jami urinishlar
                    </span>
                    <strong>{format(data.stats.totalPlays)}</strong>
                  </div>
                  <div className="today-footer">
                    <span className="status-dot" />
                    Toshkent vaqti bo‘yicha hisoblanadi
                  </div>
                </section>
                <section className="panel dashboard-activity">
                  <div className="panel-head">
                    <div>
                      <h2>So‘nggi o‘zgarishlar</h2>
                      <p>Boshqaruvdagi oxirgi amallar</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => changeTab("audit")}
                    >
                      Barchasini ko‘rish <ArrowRight size={15} />
                    </button>
                  </div>
                  {data.recent.length ? (
                    <div className="activity-list">
                      {data.recent.map((row: Row) => (
                        <div className="activity-row" key={row.id}>
                          <span className="activity-icon">
                            <ScrollText size={17} />
                          </span>
                          <div>
                            <b>{row.action}</b>
                            <small>
                              Admin {row.actor}
                              {row.chat_id ? " · Guruh " + row.chat_id : ""}
                            </small>
                          </div>
                          <time>{date(row.created_at)}</time>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty detail="Admin amallari shu yerda qayd etiladi." />
                  )}
                </section>
              </div>
            </>
          )}
          {admin && ["groups", "players", "orders", "audit"].includes(tab) && (
            <>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Qidirish"
                      placeholder={
                        tab === "players"
                          ? "Ism, username yoki ID orqali qidirish..."
                          : "Nom yoki ID orqali qidirish..."
                      }
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setOffset(0);
                      }}
                    />
                  </div>
                  <div className="toolbar-right">
                    {tab === "groups" && (
                      <select
                        aria-label="Chat turi"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setOffset(0);
                        }}
                      >
                        <option value="">Barcha chatlar</option>
                        <option value="supergroup">Superguruhlar</option>
                        <option value="group">Guruhlar</option>
                        <option value="private">Shaxsiy chatlar</option>
                      </select>
                    )}
                    {tab === "orders" && (
                      <select
                        aria-label="To‘lov holati"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setOffset(0);
                        }}
                      >
                        <option value="">Barcha holatlar</option>
                        <option value="credited">Bajarilgan</option>
                        <option value="pending">Kutilmoqda</option>
                        <option value="refunded">Qaytarilgan</option>
                      </select>
                    )}
                    <span className="count">{format(data?.total)} ta</span>
                    {can("finance") &&
                      ["players", "orders", "audit"].includes(tab) && (
                        <button
                          className="icon-btn"
                          aria-label="CSV eksport"
                          onClick={() =>
                            act(
                              () =>
                                download("admin/export/" + tab, tab + ".csv"),
                              "Eksport tayyor",
                              false,
                            )
                          }
                        >
                          <Download size={17} />
                        </button>
                      )}
                    {tab === "orders" && (
                      <button
                        className="secondary"
                        onClick={() =>
                          act(
                            async () => {
                              const result = await api("admin/stars");
                              setDetail(result);
                              setModal({ kind: "stars" });
                            },
                            "Telegram hisobi olindi",
                            false,
                          )
                        }
                      >
                        <Star size={15} />
                        Stars hisobi
                      </button>
                    )}
                  </div>
                </div>
                {data?.items?.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {(tab === "groups"
                            ? [
                                "Guruh / chat",
                                "O‘yinchilar",
                                "Farosat",
                                "Holat",
                                "",
                              ]
                            : tab === "players"
                              ? [
                                  "Foydalanuvchi",
                                  "Guruh",
                                  "Jami farosat",
                                  "Kunlik seriya",
                                  "",
                                ]
                              : tab === "orders"
                                ? [
                                    "Buyurtma",
                                    "Guruh / xaridor",
                                    "Miqdor",
                                    "Holat",
                                    "Sana",
                                    "",
                                  ]
                                : ["Amal", "Admin", "Guruh", "Tafsilot", "Sana"]
                          ).map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((row: Row, i: number) => (
                          <tr
                            key={row.id || row.chat_id + ":" + row.user_id || i}
                          >
                            {tab === "groups" && (
                              <>
                                <td>
                                  <div className="person">
                                    <span className="group-avatar">
                                      <Building2 size={19} />
                                    </span>
                                    <div>
                                      <b>{row.title}</b>
                                      <small>{row.chat_id}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>{format(row.players)}</td>
                                <td className="number">
                                  {format(row.grams)} <small>g</small>
                                </td>
                                <td>
                                  <Badge
                                    status={
                                      row.game_enabled ? "credited" : "pending"
                                    }
                                  >
                                    {row.game_enabled
                                      ? "O‘yin ochiq"
                                      : "To‘xtatilgan"}
                                  </Badge>
                                </td>
                                <td>
                                  <button
                                    className="icon-btn"
                                    aria-label={row.title + " boshqarish"}
                                    onClick={() => {
                                      setModal({ kind: "group", group: row });
                                      setForm({
                                        ...row,
                                        game_enabled: Boolean(row.game_enabled),
                                        shop_enabled: Boolean(row.shop_enabled),
                                      });
                                    }}
                                  >
                                    <ArrowUpRight size={18} />
                                  </button>
                                </td>
                              </>
                            )}
                            {tab === "players" && (
                              <>
                                <td>
                                  <div className="person">
                                    <Avatar name={row.display_name} />
                                    <div>
                                      <b>{row.display_name}</b>
                                      <small>
                                        {row.username
                                          ? "@" + row.username
                                          : row.user_id}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="muted">
                                    {row.chat_title || row.chat_id}
                                  </span>
                                </td>
                                <td className="number">
                                  {format(row.grams)} <small>g</small>
                                </td>
                                <td>
                                  <span className="streak">
                                    <Flame size={15} />
                                    {row.streak} kun
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="icon-btn"
                                    aria-label={
                                      row.display_name + " profilini ochish"
                                    }
                                    onClick={() => openPlayer(row)}
                                  >
                                    <ArrowUpRight size={18} />
                                  </button>
                                </td>
                              </>
                            )}
                            {tab === "orders" && (
                              <>
                                <td>
                                  <b className="mono">{row.id.slice(0, 8)}</b>
                                  <small className="block">
                                    {row.charge_id
                                      ? "Telegram tasdiqlagan"
                                      : "To‘lov kutilmoqda"}
                                  </small>
                                </td>
                                <td>
                                  <b>{row.chat_title}</b>
                                  <small className="block">
                                    ID: {row.user_id}
                                  </small>
                                </td>
                                <td>
                                  <span className="accent-text">
                                    ⭐ {format(row.stars)}
                                  </span>
                                  <small className="block">
                                    {row.grams} g farosat
                                  </small>
                                </td>
                                <td>
                                  <Badge
                                    status={
                                      row.receipt_status === "duplicate"
                                        ? "duplicate"
                                        : row.status
                                    }
                                  />
                                  {row.refund_error && (
                                    <small className="block error-text">
                                      Qaytarishni tekshiring
                                    </small>
                                  )}
                                </td>
                                <td className="muted">
                                  {date(row.created_at)}
                                </td>
                                <td>
                                  {row.charge_id &&
                                    row.receipt_status !== "refunded" && (
                                      <button
                                        className="text-btn"
                                        onClick={() => {
                                          setModal({
                                            kind: "refund",
                                            order: row,
                                          });
                                          setForm({ reason: "" });
                                        }}
                                      >
                                        Qaytarish
                                      </button>
                                    )}
                                </td>
                              </>
                            )}
                            {tab === "audit" && (
                              <>
                                <td>
                                  <b>{row.action}</b>
                                </td>
                                <td className="mono">{row.actor}</td>
                                <td className="mono">{row.chat_id || "—"}</td>
                                <td>
                                  <button
                                    className="text-btn"
                                    onClick={() => {
                                      setDetail(row);
                                      setModal({ kind: "audit" });
                                    }}
                                  >
                                    Ko‘rish <ArrowUpRight size={14} />
                                  </button>
                                </td>
                                <td className="muted">
                                  {date(row.created_at)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  !busy && (
                    <Empty
                      title={
                        q
                          ? "Qidiruv bo‘yicha natija yo‘q"
                          : "Ro‘yxat hozircha bo‘sh"
                      }
                      detail={
                        q
                          ? "Boshqa ism yoki ID bilan urinib ko‘ring."
                          : "Yangi ma’lumotlar shu yerda ko‘rinadi."
                      }
                    />
                  )
                )}
                <div className="pagination">
                  <span>
                    {data?.total
                      ? offset +
                        1 +
                        "–" +
                        Math.min(offset + 20, data.total) +
                        " / " +
                        data.total
                      : "0 ta natija"}
                  </span>
                  <div>
                    <button
                      className="secondary"
                      disabled={!offset || busy}
                      onClick={() => setOffset(Math.max(0, offset - 20))}
                    >
                      <ArrowLeft size={15} />
                      Oldingi
                    </button>
                    <button
                      className="secondary"
                      disabled={!data || offset + 20 >= data.total || busy}
                      onClick={() => setOffset(offset + 20)}
                    >
                      Keyingi
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
              {tab === "groups" && can("owner") && (
                <div className="danger-strip">
                  <div>
                    <b>Barcha guruhlarning o‘yin hisobini reset qilish</b>
                    <p>Xarid gramm va moliyaviy tarix saqlanadi.</p>
                  </div>
                  <button
                    className="danger-btn"
                    onClick={() =>
                      setModal({ kind: "reset", action: "reset-all" })
                    }
                  >
                    Barcha hisoblarni reset qilish
                  </button>
                </div>
              )}
            </>
          )}
          {admin && tab === "settings" && settings && (
            <section className="panel settings-panel">
              <div className="panel-head">
                <div>
                  <h2>Asosiy qoidalar</h2>
                  <p>1 Star = 1 gramm kursi doimiy.</p>
                </div>
              </div>
              <label className="toggle-row">
                <div>
                  <b>Texnik xizmat rejimi</b>
                  <p>Yangi urinish va xaridlarni vaqtincha to‘xtatadi.</p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  checked={settings.maintenance}
                  onChange={(e) =>
                    setSettings({ ...settings, maintenance: e.target.checked })
                  }
                />
              </label>
              <label className="toggle-row">
                <div>
                  <b>Qora bozor ochiq</b>
                  <p>Foydalanuvchilar Stars orqali xarid qilishi mumkin.</p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  checked={settings.shopEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, shopEnabled: e.target.checked })
                  }
                />
              </label>
              <label className="field compact">
                <span>Bitta xariddagi maksimal gramm</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={settings.maxPurchase}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxPurchase: Number(e.target.value),
                    })
                  }
                />
              </label>
              <div className="section-divider" />
              <h2>Kunlik darajalar</h2>
              <p className="muted">
                Omad va yutuqlar ishlab topilgan farosatga bog‘liq.
              </p>
              <div className="table-scroll">
                <table className="levels-table">
                  <thead>
                    <tr>
                      <th>Daraja</th>
                      <th>Chegara (g)</th>
                      <th>Omad (%)</th>
                      <th>Yutuq (g)</th>
                      <th>Minus (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.levels.map((level: Row, i: number) => {
                      const update = (key: string, value: any) =>
                        setSettings({
                          ...settings,
                          levels: settings.levels.map((l: Row, j: number) =>
                            j === i ? { ...l, [key]: value } : l,
                          ),
                        });
                      return (
                        <tr key={level.key}>
                          <td>
                            {level.emoji} {level.name}
                          </td>
                          <td>
                            <input
                              aria-label={level.name + " chegarasi"}
                              type="number"
                              min={0}
                              value={level.min}
                              onChange={(e) =>
                                update("min", Number(e.target.value))
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={level.name + " omad foizi"}
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={Math.round(level.positiveChance * 100)}
                              onChange={(e) =>
                                update(
                                  "positiveChance",
                                  Number(e.target.value) / 100,
                                )
                              }
                            />
                          </td>
                          <td>
                            <div className="range-fields">
                              {[0, 1].map((j) => (
                                <input
                                  key={j}
                                  aria-label={level.name + " yutuq " + j}
                                  type="number"
                                  min={1}
                                  value={level.gain[j]}
                                  onChange={(e) =>
                                    update(
                                      "gain",
                                      level.gain.map((v: number, k: number) =>
                                        j === k ? Number(e.target.value) : v,
                                      ),
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="range-fields">
                              {[0, 1].map((j) => (
                                <input
                                  key={j}
                                  aria-label={level.name + " minus " + j}
                                  type="number"
                                  min={1}
                                  value={level.loss[j]}
                                  onChange={(e) =>
                                    update(
                                      "loss",
                                      level.loss.map((v: number, k: number) =>
                                        j === k ? Number(e.target.value) : v,
                                      ),
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                <button
                  className="primary"
                  disabled={actionBusy}
                  onClick={() =>
                    act(
                      () => patch("admin/settings", settings),
                      "O‘yin sozlamalari saqlandi",
                    )
                  }
                >
                  <Check size={16} />
                  O‘zgarishlarni saqlash
                </button>
              </div>
            </section>
          )}
          {admin && tab === "roles" && data && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Boshqaruv jamoasi</h2>
                  <p>Har bir rol uchun alohida vakolatlar.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setModal({ kind: "role" });
                    setForm({ role: "viewer", userId: "", chatId: "" });
                  }}
                >
                  <Plus size={16} />
                  Admin qo‘shish
                </button>
              </div>
              <div className="activity-list">
                {data.owners.map((id: string) => (
                  <div className="activity-row" key={id}>
                    <span className="activity-icon accent">
                      <ShieldCheck size={19} />
                    </span>
                    <div>
                      <b>Telegram ID: {id}</b>
                      <small>
                        Tizim egasi · muhit sozlamasidan belgilanadi
                      </small>
                    </div>
                    <Badge status="credited">Ega</Badge>
                  </div>
                ))}
                {data.items.map((r: Row) => (
                  <div className="activity-row" key={r.user_id}>
                    <Avatar name={r.user_id} />
                    <div>
                      <b>Telegram ID: {r.user_id}</b>
                      <small>
                        {roleLabels[r.role]}
                        {r.chat_id
                          ? " · Guruh " + r.chat_id
                          : " · Barcha guruhlar"}
                      </small>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setModal({ kind: "role" });
                        setForm({
                          userId: r.user_id,
                          role: r.role,
                          chatId: r.chat_id || "",
                        });
                      }}
                    >
                      O‘zgartirish
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {admin && tab === "broadcasts" && (
            <>
              <div className="two-columns">
                <section className="panel form-panel">
                  <h2>Yangi e’lon</h2>
                  <p className="muted">
                    Xabarni avval o‘zingizga yuborib tekshiring.
                  </p>
                  <label className="field">
                    <span>Xabar matni</span>
                    <textarea
                      rows={6}
                      maxLength={3500}
                      placeholder="Farosat ahliga aytadigan gapingiz..."
                      value={form.text || ""}
                      onChange={(e) => field("text", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Auditoriya</span>
                    <select
                      value={form.audience || "groups"}
                      onChange={(e) => field("audience", e.target.value)}
                    >
                      <option value="groups">Guruhlar</option>
                      <option value="users">
                        Botning shaxsiy foydalanuvchilari
                      </option>
                      <option value="all">
                        Guruhlar va shaxsiy foydalanuvchilar
                      </option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Yuborish vaqti · bo‘sh qoldirilsa hozir</span>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt || ""}
                      onChange={(e) => field("scheduledAt", e.target.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      className="secondary"
                      disabled={actionBusy || !form.text?.trim()}
                      onClick={() =>
                        act(
                          () =>
                            post("admin/broadcasts", {
                              text: form.text,
                              test: true,
                            }),
                          "Sinov xabari navbatga qo‘yildi",
                          false,
                        )
                      }
                    >
                      Sinov yuborish
                    </button>
                    <button
                      className="primary"
                      disabled={actionBusy || !form.text?.trim()}
                      onClick={() => setModal({ kind: "broadcast" })}
                    >
                      <Send size={15} />
                      E’lon yuborish
                    </button>
                  </div>
                </section>
                <section className="panel message-preview">
                  <span className="eyebrow">OLDINDAN KO‘RISH</span>
                  <div className="telegram-message">
                    <b>Farosatxona</b>
                    <p>{form.text || "Xabar matni shu yerda ko‘rinadi."}</p>
                    <small>hozir ✓✓</small>
                  </div>
                  <p className="muted">Xabar oddiy matn sifatida yuboriladi.</p>
                </section>
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h2>Yuborish tarixi</h2>
                </div>
                {data?.items?.length ? (
                  <div className="activity-list">
                    {data.items.map((b: Row) => (
                      <div className="activity-row" key={b.id}>
                        <span className="activity-icon">
                          <Megaphone size={17} />
                        </span>
                        <div>
                          <b>{b.text.slice(0, 60)}</b>
                          <small>
                            {date(b.scheduled_at)} · Yuborildi: {b.sent}/
                            {b.total} · Xato: {b.failed}
                          </small>
                        </div>
                        <Badge status={b.status} />
                        {b.status === "scheduled" && (
                          <button
                            className="icon-btn"
                            aria-label="E’lonni bekor qilish"
                            onClick={() =>
                              act(
                                () =>
                                  api("admin/broadcasts/" + b.id, {
                                    method: "DELETE",
                                  }),
                                "Bekor qilindi",
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty detail="E’lonlar tarixi shu yerda ko‘rinadi." />
                )}
              </section>
            </>
          )}
          {admin && tab === "system" && data && (
            <>
              <div className="metrics">
                <Metric
                  title="Ishlash vaqti"
                  value={Math.floor(data.uptime / 60) + " min"}
                  icon={Clock}
                  note="Xizmat ishga tushganidan beri"
                />
                <Metric
                  title="Ma’lumotlar bazasi"
                  value={data.database === "ok" ? "Sog‘lom" : "Tekshiring"}
                  icon={Database}
                  note="SQLite yaxlitlik tekshiruvi"
                />
                <Metric
                  title="Kelgan xabarlar"
                  value={format(
                    data.inbox.reduce((s: number, r: Row) => s + r.count, 0),
                  )}
                  icon={Activity}
                  note="Saqlangan Telegram update’lar"
                />
                <Metric
                  title="Yuborish navbati"
                  value={format(
                    data.outbox.find((r: Row) => r.status === "pending")?.count,
                  )}
                  icon={Send}
                  note="Yuborilishi kutilayotgan xabarlar"
                />
              </div>
              <section className="panel form-panel">
                <h2>Ulanishlar</h2>
                <div className="today-row">
                  <span>Bot</span>
                  <b>@{data.botUsername || "sozlanmagan"}</b>
                </div>
                <div className="today-row">
                  <span>Web App</span>
                  <Badge
                    status={data.webAppConfigured ? "credited" : "pending"}
                  >
                    {data.webAppConfigured ? "Sozlangan" : "Manzil kerak"}
                  </Badge>
                </div>
                <div className="today-row">
                  <span>Oxirgi Telegram tekshiruvi</span>
                  <b>{date(data.lastUpdate)}</b>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Qayta ishlash xatolari</h2>
                </div>
                {data.errors.length ? (
                  <div className="activity-list">
                    {data.errors.map((r: Row) => (
                      <div className="activity-row" key={r.update_id}>
                        <AlertCircle size={19} />
                        <div>
                          <b>Update {r.update_id}</b>
                          <small>
                            {r.error} · {r.attempts} urinish
                          </small>
                        </div>
                        <button
                          className="secondary"
                          disabled={actionBusy}
                          onClick={() =>
                            act(
                              () =>
                                post("admin/retry", { updateId: r.update_id }),
                              "Qayta ishlashga qo‘yildi",
                            )
                          }
                        >
                          <RefreshCw size={14} />
                          Qayta urinish
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Xatoliklar yo‘q"
                    detail="Xizmatlar tartibli ishlayapti."
                  />
                )}
              </section>
            </>
          )}
          {admin && tab === "data" && (
            <>
              <section className="panel form-panel">
                <h2>Ma’lumotlarni eksport qilish</h2>
                <p className="muted">
                  Tahlil va arxiv uchun CSV formatida yuklab oling.
                </p>
                <div className="export-grid">
                  {[
                    { id: "players", title: "Foydalanuvchilar", icon: Users },
                    { id: "orders", title: "Buyurtmalar", icon: Wallet },
                    { id: "ledger", title: "Balans tarixi", icon: ScrollText },
                    { id: "audit", title: "Admin amallari", icon: ShieldCheck },
                  ].map((item) => (
                    <button
                      key={item.id}
                      className="export-card"
                      onClick={() =>
                        act(
                          () =>
                            download(
                              "admin/export/" + item.id,
                              item.id + ".csv",
                            ),
                          "Eksport tayyor",
                          false,
                        )
                      }
                    >
                      <item.icon size={22} />
                      <b>{item.title}</b>
                      <span>
                        CSV <Download size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              {can("owner") && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Zaxira nusxalar</h2>
                      <p>Joriy bazaning yaxlit nusxasini saqlash.</p>
                    </div>
                    <button
                      className="primary"
                      disabled={actionBusy}
                      onClick={() =>
                        act(
                          () => post("admin/backup", {}),
                          "Zaxira nusxa yaratildi",
                        )
                      }
                    >
                      <Plus size={16} />
                      Zaxira yaratish
                    </button>
                  </div>
                  {data?.items?.length ? (
                    <div className="activity-list">
                      {data.items.map((r: Row) => (
                        <div className="activity-row" key={r.file}>
                          <Database size={18} />
                          <div>
                            <b>{r.file}</b>
                            <small>{Math.round(r.size / 1024)} KB</small>
                          </div>
                          <button
                            className="secondary"
                            onClick={() =>
                              act(
                                () =>
                                  download("admin/backups/" + r.file, r.file),
                                "Yuklab olindi",
                                false,
                              )
                            }
                          >
                            <Download size={16} />
                            Yuklab olish
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty detail="Birinchi zaxira nusxangizni yarating." />
                  )}
                  <div className="panel-footer">
                    <p className="muted">
                      Tiklash serverda texnik xizmat rejimida bajariladi.
                      To‘lovlardan keyingi nusxalarni saqlang.
                    </p>
                  </div>
                </section>
              )}
            </>
          )}
          {!admin && data && ["home", "profile"].includes(tab) && (
            <>
              <section className="balance-hero">
                <div>
                  <span className="eyebrow">SIZNING FAROSATINGIZ</span>
                  <h2>
                    {format(data.player.grams)}
                    <span>gramm</span>
                  </h2>
                  <div className="level-chip">
                    {data.level.emoji} {data.level.name}
                    <span>daraja</span>
                  </div>
                  <div className="balance-split">
                    <span>
                      Yig‘ilgan <b>{format(data.player.earned_grams)} g</b>
                    </span>
                    <span>
                      Xarid qilingan <b>{format(data.player.paid_grams)} g</b>
                    </span>
                  </div>
                </div>
                <div className="brain-art">
                  <CaseArtwork eager />
                  <span />
                  <i />
                </div>
              </section>
              <div className="user-two-columns">
                <section className="panel daily-card">
                  <span className="eyebrow">KUNLIK LUQMA</span>
                  <h2>
                    {data.alreadyPlayed
                      ? "Bugungi nasiba olingan."
                      : "Bir luqma farosat oling."}
                  </h2>
                  <p>
                    {data.alreadyPlayed
                      ? "Ombor mudiri ertaga yana kutadi."
                      : "Taqdir bugun sizga qancha gramm ajratgan?"}
                  </p>
                  {data.alreadyPlayed ? (
                    <div className="countdown">
                      <Clock size={19} />
                      {countdown}
                      <small>keyingi urinishgacha</small>
                    </div>
                  ) : (
                    <button
                      className="primary daily-button"
                      disabled={actionBusy}
                      onClick={() =>
                        act(
                          async () => {
                            const result = await post("me/play", {
                              chatId: group,
                            });
                            notify(
                              result.alreadyPlayed
                                ? "Bugungi luqma olingan."
                                : (result.roll.delta >= 0 ? "+" : "") +
                                    result.roll.delta +
                                    " g farosat!",
                            );
                          },
                          "Hisob yangilandi",
                          false,
                        )
                      }
                    >
                      <Sparkles size={18} />
                      Bugungi farosatni olish
                      <ArrowRight size={16} />
                    </button>
                  )}
                  <div className="daily-foot">
                    <ShieldCheck size={14} />
                    Xarid grammiga kunlik minus ta’sir qilmaydi.
                  </div>
                </section>
                <section className="panel progress-card">
                  <div className="panel-head">
                    <h2>Farosat yo‘lingiz</h2>
                    <Trophy size={19} />
                  </div>
                  <div className="progress-info">
                    <span>
                      {data.level.emoji} {data.level.name}
                    </span>
                    <span>
                      {data.next
                        ? data.next.emoji + " " + data.next.name
                        : "👑 Cho‘qqi"}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width:
                          (data.next
                            ? Math.min(
                                100,
                                ((data.player.grams - data.level.min) /
                                  (data.next.min - data.level.min)) *
                                  100,
                              )
                            : 100) + "%",
                      }}
                    />
                  </div>
                  <p>
                    {data.next
                      ? "Keyingi darajagacha " +
                        format(data.next.min - data.player.grams) +
                        " g qoldi."
                      : "Afsonaviy darajadasiz. Farosatning chegarasi yo‘q."}
                  </p>
                  <div className="user-stats">
                    <div>
                      <Flame size={20} />
                      <strong>{data.player.streak}</strong>
                      <span>kunlik seriya</span>
                    </div>
                    <div>
                      <Trophy size={20} />
                      <strong>{data.player.best_streak}</strong>
                      <span>eng yaxshi seriya</span>
                    </div>
                    <div>
                      <Brain size={20} />
                      <strong>{data.player.plays}</strong>
                      <span>urinishlar</span>
                    </div>
                  </div>
                </section>
              </div>
              {tab === "home" && (
                <button
                  className="shop-banner"
                  onClick={() => changeTab("shop")}
                >
                  <span className="shop-banner-icon">
                    <ShoppingBag size={27} />
                  </span>
                  <div>
                    <span className="eyebrow">QORA BOZOR</span>
                    <h3>Farosatni kutib o‘tirmang.</h3>
                    <p>1 Star = 1 gramm. Guruhingizdagi hisobga.</p>
                  </div>
                  <ArrowUpRight size={24} />
                </button>
              )}
              {tab === "profile" && (
                <>
                  <section className="panel">
                    <div className="panel-head">
                      <h2>Balans tarixi</h2>
                      <span className="count">Oxirgi 50 amal</span>
                    </div>
                    {data.history.length ? (
                      <div className="activity-list">
                        {data.history.map((h: Row) => (
                          <div className="activity-row" key={h.id}>
                            <span className="activity-icon">
                              <Brain size={18} />
                            </span>
                            <div>
                              <b>
                                {{
                                  daily: "Kunlik farosat",
                                  payment: "Stars xaridi",
                                  admin: "Admin tuzatishi",
                                  reset: "O‘yin hisobi reset",
                                  refund: "Xarid qaytarildi",
                                  legacy: "Boshlang‘ich qoldiq",
                                }[h.source as string] || h.source}
                              </b>
                              <small>
                                {date(h.created_at)}
                                {h.reason ? " · " + h.reason : ""}
                              </small>
                            </div>
                            <strong
                              className={
                                h.delta >= 0 ? "positive" : "error-text"
                              }
                            >
                              {h.delta > 0 ? "+" : ""}
                              {h.delta} g
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty />
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <h2>Xaridlar tarixi</h2>
                    </div>
                    {data.orders.length ? (
                      <div className="activity-list">
                        {data.orders.map((o: Row) => (
                          <div className="activity-row" key={o.id}>
                            <Star className="accent-text" size={19} />
                            <div>
                              <b>
                                {o.grams} g · {o.stars} Stars
                              </b>
                              <small>
                                {o.chat_title} · {o.id.slice(0, 8)} ·{" "}
                                {date(o.created_at)}
                              </small>
                            </div>
                            <Badge status={o.status} />
                            {o.status === "pending" && (
                              <button
                                className="text-btn"
                                onClick={() => {
                                  setOrder(o);
                                  changeTab("shop");
                                }}
                              >
                                Holatini ko‘rish
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Xaridlar hali yo‘q"
                        detail="Birinchi xaridingiz Qora bozorda kutmoqda."
                      />
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {!admin && tab === "shop" && group && (
            <div className="shop-layout">
              <section className="market-card">
                <div className="market-heading">
                  <span className="market-icon">
                    <ShoppingBag size={27} />
                  </span>
                  <Badge status="credited">1 ⭐ = 1 g</Badge>
                </div>
                <CaseCatalog
                  grams={grams}
                  onChange={(amount) => {
                    setGrams(amount);
                    if (window.matchMedia?.("(max-width: 1000px)")?.matches) {
                      checkoutRef.current?.scrollIntoView({
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "auto"
                          : "smooth",
                        block: "start",
                      });
                    }
                  }}
                />
                <label className="field custom-amount">
                  <span>O‘zingiz miqdor kiriting</span>
                  <div className="amount-input">
                    <input
                      aria-label="Farosat miqdori"
                      type="number"
                      min={1}
                      max={session.settings.maxPurchase}
                      value={grams}
                      onChange={(e) => setGrams(Number(e.target.value))}
                    />
                    <span>gramm</span>
                  </div>
                </label>
                <div className="market-note">
                  <ShieldCheck size={17} />
                  <p>Xarid farosati kunlik minus va resetdan himoyalangan.</p>
                </div>
              </section>
              <section className="panel checkout-card" ref={checkoutRef}>
                <div className="checkout-preview">
                  <PackageCarousel grams={grams} onChange={setGrams} />
                </div>
                <span className="eyebrow">XARID TAFSILOTLARI</span>
                <h2>
                  {PACKAGES.find((pack) => pack.grams === grams)?.name ||
                    "Sizning tanlovingiz"}
                </h2>
                <div className="checkout-row">
                  <span>Guruh</span>
                  <b>{selectedChat?.title}</b>
                </div>
                <div className="checkout-row">
                  <span>Hisob egasi</span>
                  <b>{session.user.first_name}</b>
                </div>
                <div className="checkout-row">
                  <span>Farosat</span>
                  <b>{format(grams)} g</b>
                </div>
                <div className="checkout-row">
                  <span>Kurs</span>
                  <b>1 Star = 1 g</b>
                </div>
                <div className="checkout-total">
                  <span>To‘lov</span>
                  <strong>
                    <Star size={24} fill="currentColor" />
                    {format(grams)}
                  </strong>
                </div>
                <label className="terms-check">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  <span>
                    <button
                      className="text-btn"
                      onClick={() => setModal({ kind: "terms" })}
                    >
                      Xarid shartlari
                    </button>{" "}
                    bilan tanishdim va roziman.
                  </span>
                </label>
                <button
                  className="primary purchase-button"
                  disabled={
                    actionBusy ||
                    !terms ||
                    !Number.isInteger(grams) ||
                    grams < 1 ||
                    grams > session.settings.maxPurchase ||
                    !session.settings.shopEnabled ||
                    session.settings.maintenance
                  }
                  onClick={() => purchase()}
                >
                  <Star size={17} />
                  {actionBusy ? "Tayyorlanmoqda…" : "Sotib olish"}
                  <span className="purchase-price">{format(grams)} Stars</span>
                  <ArrowRight size={16} />
                </button>
                <p className="checkout-help">
                  To‘lov Telegram’ning rasmiy oynasida bajariladi.
                </p>
                {order && (
                  <div className="order-state">
                    <Badge status={order.status} />
                    <small>Buyurtma: {order.id.slice(0, 8)}</small>
                    {order.status === "pending" && (
                      <p>
                        Telegram tasdig‘i kutilmoqda. Hisob avtomatik
                        yangilanadi.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
          {!admin && tab === "ranking" && data && (
            <section className="panel ranking-panel">
              <div className="panel-head">
                <div>
                  <h2>Farosat peshqadamlari</h2>
                  <p>{selectedChat?.title}</p>
                </div>
                <div className="segmented">
                  <button
                    className={filter !== "earned" ? "active" : ""}
                    onClick={() => setFilter("total")}
                  >
                    Jami
                  </button>
                  <button
                    className={filter === "earned" ? "active" : ""}
                    onClick={() => setFilter("earned")}
                  >
                    Yig‘ilgan
                  </button>
                </div>
              </div>
              {data.items.length ? (
                <div className="ranking-list">
                  {data.items.map((p: Row, i: number) => (
                    <div
                      className={
                        "ranking-row " +
                        (String(session.user.id) === p.user_id ? "you" : "")
                      }
                      key={p.user_id}
                    >
                      <span className={"rank " + (i < 3 ? "medal" : "")}>
                        {["🥇", "🥈", "🥉"][i] || p.rank}
                      </span>
                      <Avatar name={p.display_name} />
                      <div>
                        <b>
                          {p.display_name}
                          {String(session.user.id) === p.user_id && (
                            <span className="you-label">SIZ</span>
                          )}
                        </b>
                        <small>{p.streak} kunlik seriya</small>
                      </div>
                      <strong>
                        {format(filter === "earned" ? p.earned_grams : p.grams)}{" "}
                        <small>g</small>
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty />
              )}
            </section>
          )}
          <footer className="footer">
            <span>
              Farosatxona <b>© {new Date().getFullYear()}</b>
            </span>
            <span>Har kuni bir luqma farosat.</span>
            {session.supportUrl && (
              <a href={session.supportUrl} target="_blank" rel="noreferrer">
                Yordam <ExternalLink size={12} />
              </a>
            )}
          </footer>
        </main>
      </div>
      {!admin && (
        <nav className="bottom-nav" aria-label="Asosiy menyu">
          {userNav.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => changeTab(item.id)}
            >
              <item.icon size={20} />
              <span>{item.title}</span>
            </button>
          ))}
        </nav>
      )}
      {toast && (
        <div className="toast" role="status">
          <AlertCircle size={18} />
          {toast}
          <button
            className="icon-btn"
            aria-label="Bildirishnomani yopish"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              group: "Guruh boshqaruvi",
              player: "Farosat pasporti",
              adjust: "Balansni o‘zgartirish",
              restriction: "Cheklov qo‘yish",
              role: "Admin vakolatlari",
              refund: "Stars qaytarish",
              reset: "Resetni tasdiqlash",
              broadcast: "E’lonni tasdiqlash",
              terms: "Xarid shartlari",
              audit: "Amal tafsiloti",
              stars: "Telegram Stars hisobi",
            }[modal.kind as string] || "Tafsilot"
          }
          close={() => setModal(null)}
        >
          {modal.kind === "group" && (
            <>
              <div className="modal-intro">
                <Building2 size={25} />
                <div>
                  <h3>{modal.group.title}</h3>
                  <small>
                    {modal.group.chat_id} · Bot: {modal.group.bot_status}
                  </small>
                </div>
              </div>
              <label className="toggle-row">
                <span>Kunlik o‘yin</span>
                <input
                  disabled={!can("manage")}
                  type="checkbox"
                  role="switch"
                  checked={form.game_enabled}
                  onChange={(e) => field("game_enabled", e.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>Stars xaridlari</span>
                <input
                  disabled={!can("manage")}
                  type="checkbox"
                  role="switch"
                  checked={form.shop_enabled}
                  onChange={(e) => field("shop_enabled", e.target.checked)}
                />
              </label>
              <div className="form-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    changeTab("players");
                    setFilter(modal.group.chat_id);
                  }}
                >
                  O‘yinchilarni ko‘rish
                </button>
                {can("manage") && (
                  <button
                    className="primary"
                    disabled={actionBusy}
                    onClick={() =>
                      act(() =>
                        patch("admin/groups/" + modal.group.chat_id, form),
                      )
                    }
                  >
                    Saqlash
                  </button>
                )}
              </div>
              {can("manage") && (
                <button
                  className="text-btn error-text"
                  onClick={() =>
                    setModal({
                      kind: "reset",
                      action: "reset-group",
                      chatId: modal.group.chat_id,
                    })
                  }
                >
                  Guruh o‘yin hisobini reset qilish
                </button>
              )}
            </>
          )}
          {modal.kind === "player" &&
            (detail ? (
              <>
                <div className="modal-intro">
                  <Avatar name={detail.player.display_name} size="large" />
                  <div>
                    <h3>{detail.player.display_name}</h3>
                    <small>
                      ID: {detail.player.user_id} ·{" "}
                      {detail.player.username
                        ? "@" + detail.player.username
                        : "Username yo‘q"}
                    </small>
                  </div>
                </div>
                <div className="mini-metrics">
                  <div>
                    <small>Jami</small>
                    <b>{format(detail.player.grams)} g</b>
                  </div>
                  <div>
                    <small>Yig‘ilgan</small>
                    <b>{format(detail.player.earned_grams)} g</b>
                  </div>
                  <div>
                    <small>Xarid</small>
                    <b>{format(detail.player.paid_grams)} g</b>
                  </div>
                </div>
                {can("manage") && (
                  <div className="form-actions">
                    <button
                      className="primary"
                      onClick={() => {
                        setModal({ kind: "adjust", player: detail.player });
                        setForm({
                          delta: 10,
                          reason: "",
                          requestId: crypto.randomUUID(),
                        });
                      }}
                    >
                      <Plus size={15} />
                      Balansni o‘zgartirish
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setModal({
                          kind: "restriction",
                          player: detail.player,
                        });
                        setForm({ kind: "game", reason: "" });
                      }}
                    >
                      Cheklov
                    </button>
                  </div>
                )}
                <h3>Oxirgi amallar</h3>
                <div className="history-mini">
                  {detail.history.slice(0, 10).map((h: Row) => (
                    <div key={h.id}>
                      <span>
                        {h.source}
                        <small>{date(h.created_at)}</small>
                      </span>
                      <b className={h.delta >= 0 ? "positive" : "error-text"}>
                        {h.delta > 0 ? "+" : ""}
                        {h.delta} g
                      </b>
                    </div>
                  ))}
                </div>
                {detail.restrictions.map((r: Row) => (
                  <div className="inline-error" key={r.kind}>
                    {r.kind}: {r.reason}
                    {can("manage") && (
                      <button
                        className="text-btn"
                        onClick={() =>
                          act(
                            () =>
                              post("admin/restrictions", {
                                chatId: detail.player.chat_id,
                                userId: detail.player.user_id,
                                kind: r.kind,
                                remove: true,
                              }),
                            "Cheklov olib tashlandi",
                          )
                        }
                      >
                        Olib tashlash
                      </button>
                    )}
                  </div>
                ))}
                {can("manage") && (
                  <button
                    className="text-btn error-text"
                    onClick={() =>
                      setModal({
                        kind: "reset",
                        action: "archive-player",
                        chatId: detail.player.chat_id,
                        userId: detail.player.user_id,
                      })
                    }
                  >
                    O‘yin hisobini arxivlash
                  </button>
                )}
              </>
            ) : (
              <div className="loading">
                <span className="spinner" />
              </div>
            ))}
          {modal.kind === "adjust" && (
            <>
              <p className="muted">
                Xarid grammiga ta’sir qilmaydi. Minus faqat yig‘ilgan balansdan
                ayriladi.
              </p>
              <label className="field">
                <span>Gramm o‘zgarishi · minus uchun manfiy son</span>
                <input
                  type="number"
                  value={form.delta}
                  onChange={(e) => field("delta", Number(e.target.value))}
                />
              </label>
              <div className="balance-preview">
                <span>Oldingi: {format(modal.player.grams)} g</span>
                <ArrowRight size={16} />
                <b>
                  Keyingi:{" "}
                  {format(
                    modal.player.paid_grams +
                      Math.max(
                        0,
                        modal.player.earned_grams + Number(form.delta || 0),
                      ),
                  )}{" "}
                  g
                </b>
              </div>
              <label className="field">
                <span>Sabab</span>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => field("reason", e.target.value)}
                  placeholder="Nima uchun o‘zgartiryapsiz?"
                />
              </label>
              <button
                className="primary full"
                disabled={actionBusy || !form.reason?.trim()}
                onClick={() =>
                  act(
                    () =>
                      post("admin/adjust", {
                        ...form,
                        chatId: modal.player.chat_id,
                        userId: modal.player.user_id,
                      }),
                    "Balans yangilandi",
                  )
                }
              >
                <Check size={16} />
                Tasdiqlash
              </button>
            </>
          )}
          {modal.kind === "restriction" && (
            <>
              <label className="field">
                <span>Cheklov turi</span>
                <select
                  value={form.kind}
                  onChange={(e) => field("kind", e.target.value)}
                >
                  <option value="game">Kunlik o‘yin</option>
                  <option value="shop">Stars xaridlari</option>
                </select>
              </label>
              <label className="field">
                <span>Sabab</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => field("reason", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Tugash vaqti · bo‘sh bo‘lsa muddatsiz</span>
                <input
                  type="datetime-local"
                  onChange={(e) =>
                    field(
                      "untilAt",
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    )
                  }
                />
              </label>
              <button
                className="primary full"
                disabled={actionBusy || !form.reason?.trim()}
                onClick={() =>
                  act(
                    () =>
                      post("admin/restrictions", {
                        ...form,
                        chatId: modal.player.chat_id,
                        userId: modal.player.user_id,
                      }),
                    "Cheklov saqlandi",
                  )
                }
              >
                Saqlash
              </button>
            </>
          )}
          {modal.kind === "role" && (
            <>
              <label className="field">
                <span>Telegram ID</span>
                <input
                  inputMode="numeric"
                  value={form.userId}
                  onChange={(e) => field("userId", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Vakolat</span>
                <select
                  value={form.role}
                  onChange={(e) => field("role", e.target.value)}
                >
                  <option value="admin">Administrator</option>
                  <option value="moderator">Guruh moderatori</option>
                  <option value="viewer">Kuzatuvchi</option>
                  <option value="user">Vakolatni olib tashlash</option>
                </select>
              </label>
              <label className="field">
                <span>Guruh ID · moderator uchun majburiy</span>
                <input
                  value={form.chatId}
                  onChange={(e) => field("chatId", e.target.value)}
                  placeholder="-100..."
                />
              </label>
              <button
                className="primary full"
                disabled={actionBusy || !form.userId}
                onClick={() =>
                  act(() => post("admin/roles", form), "Vakolat yangilandi")
                }
              >
                Saqlash
              </button>
            </>
          )}
          {modal.kind === "refund" && (
            <>
              <div className="inline-error">
                <AlertCircle size={18} />
                {modal.order.stars} Stars to‘liq qaytariladi. Tegishli xarid
                grammi hisobdan olinadi.
              </div>
              <p>
                Buyurtma: <code>{modal.order.id}</code>
              </p>
              <label className="field">
                <span>Qaytarish sababi</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => field("reason", e.target.value)}
                />
              </label>
              <button
                className="danger-btn full"
                disabled={actionBusy || !form.reason?.trim()}
                onClick={() =>
                  act(
                    () =>
                      post("admin/refund", {
                        chargeId: modal.order.charge_id,
                        reason: form.reason,
                      }),
                    "Stars qaytarildi",
                  )
                }
              >
                Qaytarishni tasdiqlash
              </button>
            </>
          )}
          {modal.kind === "reset" && (
            <>
              <div className="inline-error">
                <AlertCircle size={18} />
                Ishlab topilgan balans reset qilinadi. Xarid grammi, to‘lovlar
                va kunlik urinish tarixi saqlanadi.
              </div>
              <p className="muted">
                Bugun olingan kunlik farosatni resetdan keyin qayta olib
                bo‘lmaydi.
              </p>
              <button
                className="danger-btn full"
                disabled={actionBusy}
                onClick={() =>
                  act(async () => {
                    const result = await post("admin/confirmation", {
                      action: modal.action,
                      chatId: modal.chatId,
                      userId: modal.userId,
                    });
                    await post("admin/reset", { token: result.token });
                  }, "O‘yin hisobi reset qilindi")
                }
              >
                Ha, reset qilish
              </button>
            </>
          )}
          {modal.kind === "broadcast" && (
            <>
              <p>
                {form.audience === "users"
                  ? "Shaxsiy foydalanuvchilarga"
                  : form.audience === "all"
                    ? "Guruhlar va shaxsiy foydalanuvchilarga"
                    : "Barcha guruhlarga"}{" "}
                quyidagi xabar yuboriladi:
              </p>
              <div className="message-confirm">{form.text}</div>
              <button
                className="primary full"
                disabled={actionBusy}
                onClick={() =>
                  act(
                    () =>
                      post("admin/broadcasts", {
                        text: form.text,
                        audience: form.audience || "groups",
                        scheduledAt: form.scheduledAt
                          ? new Date(form.scheduledAt).toISOString()
                          : undefined,
                      }),
                    "E’lon navbatga qo‘yildi",
                  )
                }
              >
                <Send size={16} />
                Yuborishni tasdiqlash
              </button>
            </>
          )}
          {modal.kind === "terms" && (
            <div className="terms-copy">
              <p>
                <b>1 Star = 1 gramm farosat.</b> Xarid faqat tanlangan guruhdagi
                shaxsiy hisobingizga tushadi.
              </p>
              <p>
                Xarid grammi kunlik minus va o‘yin resetidan himoyalangan.
                Kunlik omad ishlab topilgan farosatga bog‘liq.
              </p>
              <p>
                Gramm server Telegram’dan muvaffaqiyatli to‘lov tasdig‘ini
                olgach beriladi. Ilovani yopish xaridni bekor qilmaydi.
              </p>
              <p>
                Muammo bo‘lsa botdagi /paysupport orqali buyurtma raqami bilan
                murojaat qiling. Qaytarish operator tekshiruvidan so‘ng to‘liq
                to‘lov bo‘yicha bajariladi.
              </p>
            </div>
          )}
          {modal.kind === "audit" && detail && (
            <>
              <p>
                <b>{detail.action}</b> · {date(detail.created_at)}
              </p>
              <pre>{JSON.stringify(JSON.parse(detail.details), null, 2)}</pre>
            </>
          )}
          {modal.kind === "stars" && detail && (
            <>
              <div className="mini-metrics">
                <div>
                  <small>Telegram balansi</small>
                  <b>⭐ {format(detail.balance.amount)}</b>
                </div>
                <div>
                  <small>Oxirgi tranzaksiyalar</small>
                  <b>{detail.transactions.transactions?.length || 0}</b>
                </div>
              </div>
              <div className="history-mini">
                {detail.transactions.transactions?.map((r: Row, i: number) => (
                  <div key={r.id + ":" + i}>
                    <span className="mono">
                      {r.id.slice(0, 18)}
                      <small>
                        {new Date(r.date * 1000).toLocaleDateString("uz-UZ")}
                      </small>
                    </span>
                    <b>⭐ {r.amount}</b>
                  </div>
                ))}
              </div>
              <p className="muted">
                Solishtirish Telegram tasdiqlagan, hisobga tushmagan xaridlarni
                tiklaydi va qaytarishlarni tekshiradi.
              </p>
              <button
                className="primary full"
                disabled={actionBusy || session.preview}
                onClick={() =>
                  act(
                    async () => {
                      const result = await post("admin/reconcile", {
                        offset: 0,
                      });
                      setDetail(result);
                      setModal({ kind: "reconcile" });
                    },
                    "Solishtirish bajarildi",
                    false,
                  )
                }
              >
                <RefreshCw size={16} />
                To‘lovlarni solishtirish va tiklash
              </button>
            </>
          )}
          {modal.kind === "reconcile" && detail && (
            <>
              <h3>Telegram bilan solishtirish natijasi</h3>
              <div className="mini-metrics">
                <div>
                  <small>Tekshirildi</small>
                  <b>{detail.checked}</b>
                </div>
                <div>
                  <small>Tiklandi</small>
                  <b>{detail.recovered}</b>
                </div>
                <div>
                  <small>Qaytarish</small>
                  <b>{detail.refunded}</b>
                </div>
              </div>
              {detail.issues?.length ? (
                <div className="history-mini">
                  {detail.issues.map((r: Row) => (
                    <div key={r.id}>
                      <span>
                        {r.id}
                        <small>{r.reason}</small>
                      </span>
                      <b>⭐ {r.amount}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="positive">Mos kelmagan to‘lovlar yo‘q.</p>
              )}
              {detail.nextOffset !== null && (
                <button
                  className="primary full"
                  disabled={actionBusy}
                  onClick={() =>
                    act(
                      async () =>
                        setDetail(
                          await post("admin/reconcile", {
                            offset: detail.nextOffset,
                          }),
                        ),
                      "Keyingi tranzaksiyalar tekshirildi",
                      false,
                    )
                  }
                >
                  Keyingi tranzaksiyalarni tekshirish
                </button>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
