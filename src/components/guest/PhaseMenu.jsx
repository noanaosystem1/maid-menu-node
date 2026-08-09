import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/api/client";
import { GUEST_TEXT } from "@/lib/constants";

const CATEGORY_LABELS = GUEST_TEXT.MENU_OPEN.categoryLabels;
const CATEGORY_STYLES = {
  food: { icon: "🍳", gradient: "from-orange-200 to-amber-100", ring: "ring-orange-300", badge: "bg-orange-400" },
  drink: { icon: "☕", gradient: "from-sky-200 to-blue-100", ring: "ring-sky-300", badge: "bg-sky-400" },
  dessert: { icon: "🍰", gradient: "from-fuchsia-200 to-pink-100", ring: "ring-fuchsia-300", badge: "bg-fuchsia-400" },
  special: { icon: "✨", gradient: "from-violet-200 to-purple-100", ring: "ring-violet-300", badge: "bg-violet-400" },
};

const SCARY_CATEGORY_STYLES = {
  food: { icon: "🥩", gradient: "from-red-950 to-gray-900 text-red-100", ring: "ring-red-900 border border-red-800/50", badge: "bg-red-800" },
  drink: { icon: "🍷", gradient: "from-purple-950 to-gray-900 text-purple-100", ring: "ring-purple-900 border border-purple-800/50", badge: "bg-purple-800" },
  dessert: { icon: "👁", gradient: "from-rose-950 to-gray-900 text-rose-100", ring: "ring-rose-900 border border-rose-800/50", badge: "bg-rose-800" },
  special: { icon: "🔮", gradient: "from-violet-950 to-gray-950 text-violet-100", ring: "ring-violet-900 border border-violet-800/50", badge: "bg-violet-800" },
};

const PLACEHOLDER_IMAGES = {
  food: "https://images.unsplash.com/photo-1582896911227-cdba54fbc5ef?w=400&h=300&fit=crop",
  drink: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
  dessert: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop",
  special: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop",
};

const FLOATING_EMOJIS = ["♡", "✧", "🎀", "⭐", "♡", "🌸", "✦", "💕"];
const SCARY_FLOATING_EMOJIS = ["👻", "💀", "🦇", "🕷", "🩸", "🕯", "👁", "✦"];

function FloatingDecor({ isNightMode }) {
  const emojis = isNightMode ? SCARY_FLOATING_EMOJIS : FLOATING_EMOJIS;
  const [particles] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      left: `${(i * 17 + 5) % 95}%`,
      delay: i * 0.4,
      duration: 6 + (i % 4),
      size: 12 + (i % 3) * 6,
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <span
          key={p.id}
          className="menu-float-particle absolute opacity-30"
          style={{
            left: p.left,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function SparkleBurst({ show, isNightMode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        >
          <span className="text-4xl">{isNightMode ? "🦇🩸🦇" : "✨💖✨"}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BrainwaveMeter({ isNightMode }) {
  const [value, setValue] = useState(isNightMode ? 73 : 12);
  useEffect(() => {
    const i = setInterval(
      () => setValue((v) => Math.max(isNightMode ? 60 : 8, Math.min(isNightMode ? 95 : 22, v + (Math.random() - 0.5) * 4))),
      1500
    );
    return () => clearInterval(i);
  }, [isNightMode]);
  return (
    <div className="flex items-center gap-1 opacity-40">
      <span className={isNightMode ? "text-red-500 text-[9px] font-mono" : "text-pink-400 text-[9px]"}>
        {isNightMode ? "狂気同調率" : "脳波同調率"}
      </span>
      <div className="w-14 h-1.5 bg-black/50 border border-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isNightMode ? "bg-gradient-to-r from-red-800 to-red-500 animate-pulse" : "bg-gradient-to-r from-pink-400 to-rose-400"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={isNightMode ? "text-red-500 text-[9px] font-mono" : "text-pink-400 text-[9px]"}>{value.toFixed(1)}%</span>
    </div>
  );
}

function MenuCard({ item, onAdd, isNightMode }) {
  const [added, setAdded] = useState(false);
  const [burst, setBurst] = useState(false);
  const style = isNightMode
    ? (SCARY_CATEGORY_STYLES[item.category] || SCARY_CATEGORY_STYLES.food)
    : (CATEGORY_STYLES[item.category] || CATEGORY_STYLES.food);
  const imgSrc = item.imageUrl || PLACEHOLDER_IMAGES[item.category] || PLACEHOLDER_IMAGES.food;

  const handleAdd = () => {
    setAdded(true);
    setBurst(true);
    onAdd(item);
    if (typeof window.playSuccessFanfare === "function") {
      window.playSuccessFanfare();
    }
    setTimeout(() => setAdded(false), 1200);
    setTimeout(() => setBurst(false), 600);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative menu-card-lace overflow-hidden shadow-lg rounded-3xl ${
        isNightMode
          ? `bg-gradient-to-br ${style.gradient} border border-red-900/60 shadow-red-950/20`
          : `bg-gradient-to-br ${style.gradient} shadow-pink-200/50 ring-2 ${style.ring} ring-offset-2 ring-offset-pink-50`
      }`}
    >
      <SparkleBurst show={burst} isNightMode={isNightMode} />
      <div className={`absolute top-0 left-0 right-0 h-3 menu-lace-strip opacity-80 ${isNightMode ? "bg-red-900/40" : ""}`} />

      <div className={`relative mx-2 mt-3 rounded-2xl overflow-hidden shadow-inner ${isNightMode ? "border border-red-950/40" : "border-2 border-white/80"}`}>
        <img
          src={imgSrc}
          alt={item.name}
          className="w-full h-32 object-cover filter grayscale-[40%] contrast-[110%]"
          onError={(e) => { e.target.src = PLACEHOLDER_IMAGES.food; }}
        />
        <div className={`absolute top-2 right-2 ${style.badge} text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md`}>
          ¥{item.price.toLocaleString()}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="p-3 pt-2">
        <div className="flex items-start gap-1.5">
          <span className="text-lg leading-none">{style.icon}</span>
          <h3 className={`font-bold text-sm leading-tight flex-1 ${isNightMode ? "text-red-400 font-mono" : "text-pink-900"}`}>{item.name}</h3>
        </div>
        {item.description && (
          <p className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${isNightMode ? "text-gray-400/80" : "text-pink-700/70"}`}>{item.description}</p>
        )}
        <motion.button
          onClick={handleAdd}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          className={`w-full mt-3 py-2.5 rounded-2xl text-xs font-bold transition-all relative overflow-hidden ${
            added
              ? isNightMode
                ? "bg-gradient-to-r from-red-800 to-rose-950 text-red-200 border border-red-500 shadow-lg shadow-red-950"
                : "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300"
              : isNightMode
                ? "bg-black/80 text-red-500 border border-red-900 hover:bg-red-950/40 hover:text-red-400"
                : "bg-white/90 text-pink-600 border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50"
          }`}
        >
          {added ? isNightMode ? "☠ 契約を結びました" : "♡ 追加しました！" : isNightMode ? "☠ 魂の追加" : "♡ カートに入れる"}
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function PhaseMenu({ guestName, phase }) {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);

  const isNightMode = phase === "NIGHT_MODE";

  useEffect(() => {
    api.menuItems.list(50).then(setItems).catch(() => {});
  }, []);

  const addToCart = useCallback((item) => {
    setCart((prev) => [...prev, item]);
  }, []);

  const categories = ["all", ...new Set(items.map((i) => i.category))];
  const filtered = activeCategory === "all" ? items : items.filter((i) => i.category === activeCategory);

  const greeting = isNightMode
    ? guestName ? `${guestName}様、闇の契約（メニュー）を完了してください……🩸` : "生贄様、闇の契約（メニュー）を完了してください……🩸"
    : guestName ? `${guestName}様、ご注文をお選びください♡` : GUEST_TEXT.MENU_OPEN.greeting("お客");

  return (
    <div className={`min-h-screen relative overflow-x-hidden pb-24 ${isNightMode ? "bg-gradient-to-br from-indigo-950 via-purple-950 to-black text-white" : "menu-dream-bg"}`}>
      <FloatingDecor isNightMode={isNightMode} />

      {/* Ribbon header */}
      <div className={`sticky top-0 z-30 border-b-2 px-4 pt-3 pb-4 ${isNightMode ? "bg-black/80 border-red-950/80 backdrop-blur-md" : "menu-header-glass border-pink-200/60"}`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-2">
            <div className={`px-6 py-1 text-[10px] font-bold tracking-widest uppercase rounded ${isNightMode ? "bg-red-950 text-red-500 border border-red-900 font-mono" : "menu-ribbon text-white"}`}>
              {isNightMode ? "DARK MAID CONTRACT SYSTEM" : "Maid Café Système"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.div
              animate={isNightMode ? { scale: [1, 1.1, 0.9, 1] } : { rotate: [0, -8, 8, 0] }}
              transition={{ repeat: Infinity, duration: isNightMode ? 1.5 : 3, ease: "easeInOut" }}
              className="text-4xl drop-shadow-md"
            >
              {isNightMode ? "👁" : "🎀"}
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1
                className={`text-lg font-bold ${
                  isNightMode
                    ? "text-red-500 font-mono tracking-wider text-shadow-red"
                    : "bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent"
                }`}
                style={isNightMode ? { textShadow: "0 0 10px #FF0000" } : { fontFamily: "var(--font-heading)" }}
              >
                {greeting}
              </h1>
              <p className={`text-xs mt-0.5 flex items-center gap-1 ${isNightMode ? "text-gray-500 font-mono" : "text-pink-400"}`}>
                <span className="animate-pulse">{isNightMode ? "☠" : "♡"}</span>
                {isNightMode ? "ようこそ、闇のメイド喫茶へ……" : GUEST_TEXT.MENU_OPEN.subtitle}
                <span className="animate-pulse">{isNightMode ? "☠" : "♡"}</span>
              </p>
            </div>
          </div>

          {/* Today's special banner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`mt-3 rounded-2xl px-4 py-2 text-center text-xs font-semibold shadow-md ${
              isNightMode
                ? "bg-gradient-to-r from-red-950 via-red-900 to-red-950 text-red-200 border border-red-800/40 shadow-red-950/60"
                : "bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400 text-white shadow-pink-300/40"
            }`}
          >
            {isNightMode ? "🔮 深夜の刻限 — 欲望の契約をタップしてください 🔮" : "✨ 本日のスペシャル — お好みのメニューをタップしてね ♡ ✨"}
          </motion.div>

          {categories.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                const catStyle = cat !== "all"
                  ? (isNightMode ? SCARY_CATEGORY_STYLES[cat] : CATEGORY_STYLES[cat])
                  : null;
                return (
                  <motion.button
                    key={cat}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      active
                        ? isNightMode
                          ? "bg-red-800 text-white shadow-lg shadow-red-950 border border-red-500 scale-105"
                          : "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300/50 scale-105"
                        : isNightMode
                          ? "bg-black/60 text-red-500 border border-red-950 hover:border-red-800"
                          : "bg-white/80 text-pink-500 border-2 border-pink-200 hover:border-pink-300"
                    }`}
                  >
                    {cat !== "all" && <span>{catStyle?.icon || "👁"}</span>}
                    {cat === "all" ? isNightMode ? "☠ すべて" : "♡ すべて" : CATEGORY_LABELS[cat] || cat}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Menu grid */}
      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-6xl mb-4"
            >
              {isNightMode ? "👁☠" : "🍽♡"}
            </motion.div>
            <p className={isNightMode ? "text-red-500 font-mono" : "text-pink-400 font-medium"}>
              {isNightMode ? "儀式の手順を構成中……" : "メニューを準備中です…♡"}
            </p>
            <p className={isNightMode ? "text-red-700/80 text-xs mt-2 font-mono" : "text-pink-300 text-xs mt-2"}>
              {isNightMode ? "逃げることはできません" : "しばらくお待ちくださいね"}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((item, i) => (
              <MenuCard key={item.id} item={item} onAdd={addToCart} isNightMode={isNightMode} />
            ))}
          </div>
        )}
      </div>

      {/* Cart FAB */}
      <motion.button
        onClick={() => setShowCart((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center text-xl border-2 ${
          isNightMode
            ? "bg-red-950 text-red-500 border-red-700 shadow-xl shadow-red-950"
            : "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-xl shadow-pink-400/50 border-white"
        }`}
      >
        {isNightMode ? "🔮" : "🛒"}
        {cart.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
              isNightMode
                ? "bg-black text-red-500 border-red-900 text-xs font-mono font-bold"
                : "bg-white text-pink-600 border-pink-400 text-xs font-bold"
            }`}
          >
            {cart.length}
          </motion.span>
        )}
      </motion.button>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-h-[50vh] overflow-y-auto shadow-2xl border-t-2 ${
              isNightMode
                ? "bg-gray-950/95 border-red-900 text-red-100"
                : "bg-white/90 backdrop-blur-xl border-pink-200"
            }`}
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-bold flex items-center gap-2 ${isNightMode ? "text-red-500 font-mono" : "text-pink-600"}`}>
                  {isNightMode ? "☠ 契約された魂のリスト" : "♡ ご注文リスト"}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isNightMode ? "bg-red-950 text-red-400 font-mono" : "bg-pink-100 text-pink-500"}`}>{cart.length}点</span>
                </h3>
                <button onClick={() => setShowCart(false)} className={isNightMode ? "text-red-800 hover:text-red-500 text-sm font-mono" : "text-pink-300 hover:text-pink-500 text-sm"}>閉じる</button>
              </div>
              {cart.length === 0 ? (
                <p className={isNightMode ? "text-red-950 text-sm text-center py-6 font-mono animate-pulse" : "text-pink-300 text-sm text-center py-6"}>
                  {isNightMode ? "まだ契約は結ばれていません……" : "まだ何も選ばれていません♡"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((item, i) => (
                    <li key={`${item.id}-${i}`} className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${
                      isNightMode
                        ? "text-red-300 bg-red-950/40 border border-red-950 font-mono"
                        : "text-pink-800 bg-pink-50"
                    }`}>
                      <span>{isNightMode ? (SCARY_CATEGORY_STYLES[item.category]?.icon || "☠") : (CATEGORY_STYLES[item.category]?.icon || "🍽")}</span>
                      <span className="flex-1 font-medium">{item.name}</span>
                      <span className={isNightMode ? "text-red-500 font-bold" : "text-pink-500 font-bold"}>¥{item.price.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              {cart.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className={`w-full mt-4 py-3 rounded-2xl font-bold text-sm shadow-lg ${
                    isNightMode
                      ? "bg-red-900 hover:bg-red-800 text-red-200 border border-red-600 shadow-red-950"
                      : "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-300/40"
                  }`}
                >
                  {isNightMode ? "☠ 魂の生贄を確定する ☠" : "♡ ご注文する（デモ）"}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className={`fixed bottom-0 left-0 right-0 px-4 py-2 z-20 border-t ${
        isNightMode ? "bg-black/95 border-red-950 text-red-700/60" : "menu-footer-glass border-pink-100"
      }`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between font-mono">
          <p className="text-[10px] font-medium tracking-wide">
            {isNightMode ? "DARK SYSTEM ENGAGED — NO ESCAPE" : "Café Système Digital Menu ♡"}
          </p>
          <BrainwaveMeter isNightMode={isNightMode} />
        </div>
      </div>

      <div className={`fixed top-0 left-0 w-full h-1.5 z-40 pointer-events-none ${isNightMode ? "bg-red-900" : "bg-gradient-to-r from-pink-300 via-rose-400 to-fuchsia-300"}`} />
      <div className="fixed bottom-16 left-0 w-full h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent z-10 pointer-events-none" />
    </div>
  );
}
