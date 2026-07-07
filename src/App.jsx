import React, { useState, useEffect, useRef } from "react";
import {
  Home, Wallet, Trophy, Users, User, Coins, ChevronRight,
  Gamepad2, ClipboardList, Smartphone, CreditCard, Gift,
  CheckCircle2, Clock, TrendingUp, Copy, Check, X, Sparkles
} from "lucide-react";

// ---------------------------------------------------------------------------
// LootLoop — a get-paid-to (GPT) rewards app.
// This is a fully wired FRONT-END prototype. Offers, verification, and
// payouts are mocked in-memory + persisted per-browser via window.storage.
// See the "INTEGRATION POINTS" comments for exactly where real offerwall
// network APIs (CPX Research, AdGate Media, BitLabs, OfferToro, etc.) and a
// real payments backend need to be plugged in before this can pay real money.
// ---------------------------------------------------------------------------

const COINS_PER_DOLLAR = 1000;
const MIN_WITHDRAW_COINS = 5000; // $5

// Real CPX Research app credentials (from your CPX dashboard -> INFO tab).
// This builds the live offerwall iframe URL. Note: {secure_hash} is only
// required if you've asked CPX support to activate "Security Check" on
// your account (General Settings tab mentions this). Until then, CPX
// accepts requests without it, so we omit it here.
const CPX_APP_ID = "34261";
function buildCpxOfferwallUrl(userId) {
  return `https://offers.cpx-research.com/index.php?app_id=${CPX_APP_ID}&ext_user_id=${encodeURIComponent(userId)}&subid_1=&subid_2=`;
}

// Your deployed postback server (Render). The app calls its /balance
// endpoint to show real coins earned from completed surveys — it never
// talks to Supabase directly, so no database key is ever exposed here.
const POSTBACK_SERVER_URL = "https://lootloop-postback.onrender.com";
async function fetchRealBalance(userId) {
  try {
    const res = await fetch(`${POSTBACK_SERVER_URL}/balance/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.balance === "number" ? data.balance : null;
  } catch (e) {
    console.warn("Could not reach postback server for real balance:", e);
    return null;
  }
}

// INTEGRATION POINT: replace this with a live pull from your offerwall
// network SDK/API (e.g. CPX Research API, AdGate postback feed). Each
// network gives you a JSON list of live offers with payouts that change
// constantly — never hardcode real payouts in production.
const SEED_OFFERS = [
  { id: "o1", category: "survey", title: "Household Shopping Habits Survey", provider: "PulseInsights", reward: 850, minutes: 12, difficulty: "Easy" },
  { id: "o2", category: "game", title: "Reach Level 15 in Kingdom Raid", provider: "Nova Games", reward: 4200, minutes: 90, difficulty: "Medium" },
  { id: "o3", category: "app", title: "Install & open Bloom Budget for 3 days", provider: "Bloom", reward: 620, minutes: 5, difficulty: "Easy" },
  { id: "o4", category: "trial", title: "Start a free trial of NordVault VPN", provider: "NordVault", reward: 1500, minutes: 3, difficulty: "Easy" },
  { id: "o5", category: "survey", title: "Tech Gadgets Opinion Panel", provider: "PulseInsights", reward: 300, minutes: 6, difficulty: "Easy" },
  { id: "o6", category: "game", title: "Complete Tutorial in Starforge", provider: "Nova Games", reward: 950, minutes: 15, difficulty: "Easy" },
  { id: "o7", category: "app", title: "Try Recipe Radar for a week", provider: "Radar Labs", reward: 1100, minutes: 5, difficulty: "Medium" },
  { id: "o8", category: "survey", title: "Streaming Habits Deep Dive", provider: "OpinionWorks", reward: 1250, minutes: 20, difficulty: "Medium" },
  { id: "o9", category: "game", title: "Win 3 Ranked Matches in Clash Arena", provider: "Fablegate", reward: 2600, minutes: 60, difficulty: "Hard" },
  { id: "o10", category: "trial", title: "Sign up for a FreshBox meal box", provider: "FreshBox", reward: 3800, minutes: 4, difficulty: "Easy" },
];

const CATEGORY_META = {
  survey: { label: "Surveys", icon: ClipboardList, color: "#7DD3C0" },
  game: { label: "Games", icon: Gamepad2, color: "#F5B740" },
  app: { label: "Apps", icon: Smartphone, color: "#8FA6FF" },
  trial: { label: "Free trials", icon: Gift, color: "#FF8B6B" },
};

function formatCoins(n) {
  return n.toLocaleString("en-US");
}
function coinsToUSD(n) {
  return (n / COINS_PER_DOLLAR).toFixed(2);
}
function randomReferralCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 7; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

// ---- persistence -----------------------------------------------------
const STORAGE_KEY = "lootloop:profile:v1";

async function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // storage unavailable or corrupted — fall through to default
  }
  return null;
}

async function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("LootLoop: failed to save profile", e);
  }
}

function randomUserId() {
  // A stable per-user ID we pass to CPX as ext_user_id, so completed
  // surveys can be matched back to this exact person in the postback.
  return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultProfile() {
  return {
    balance: 0,
    completedOfferIds: [],
    referralCode: randomReferralCode(),
    userId: randomUserId(),
    joined: new Date().toISOString(),
  };
}

// ---- coin-flip signature animation ------------------------------------
function CoinBurst({ amount, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={styles.coinBurstOverlay}>
      <div style={styles.coinBurstCard}>
        <div style={styles.coinFlip}>
          <div style={styles.coinFace}>
            <Coins size={28} color="#12122B" />
          </div>
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: "#F1EFEA", marginTop: 14 }}>
          +{formatCoins(amount)} coins
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#9491B8", marginTop: 4 }}>
          ${coinsToUSD(amount)} added to your balance
        </div>
      </div>
      <style>{`
        @keyframes flipCoin {
          0%   { transform: rotateY(0deg) translateY(0); }
          45%  { transform: rotateY(900deg) translateY(-40px); }
          70%  { transform: rotateY(1080deg) translateY(0); }
          100% { transform: rotateY(1080deg) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .coin-anim { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ---- top balance ticker ------------------------------------------------
function BalanceTicker({ balance }) {
  return (
    <div style={styles.ticker}>
      <div style={styles.tickerLeft}>
        <div style={styles.tickerCoinDot}><Coins size={14} color="#12122B" /></div>
        <span style={styles.tickerCoins}>{formatCoins(balance)}</span>
        <span style={styles.tickerUsd}>${coinsToUSD(balance)}</span>
      </div>
      <div style={styles.tickerBrand}>LOOT<span style={{ color: "#F5B740" }}>LOOP</span></div>
    </div>
  );
}

// ---- offer card ----------------------------------------------------
function OfferCard({ offer, completed, onComplete }) {
  const meta = CATEGORY_META[offer.category];
  const Icon = meta.icon;
  return (
    <div style={{ ...styles.offerCard, opacity: completed ? 0.55 : 1 }}>
      <div style={{ ...styles.offerIconWrap, background: meta.color + "22", color: meta.color }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.offerTitle}>{offer.title}</div>
        <div style={styles.offerMeta}>
          <span>{offer.provider}</span>
          <span style={styles.dot}>•</span>
          <span><Clock size={11} style={{ verticalAlign: "-1px" }} /> {offer.minutes} min</span>
          <span style={styles.dot}>•</span>
          <span>{offer.difficulty}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={styles.offerReward}>{formatCoins(offer.reward)}</div>
        <div style={styles.offerRewardUsd}>${coinsToUSD(offer.reward)}</div>
        {completed ? (
          <div style={styles.doneBadge}><CheckCircle2 size={12} /> Done</div>
        ) : (
          <button style={styles.offerBtn} onClick={() => onComplete(offer)}>Start</button>
        )}
      </div>
    </div>
  );
}

// ---- Offers (Home) view -----------------------------------------------
function OffersView({ offers, completedOfferIds, onComplete, onOpenSurveyWall }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? offers : offers.filter((o) => o.category === filter);

  return (
    <div style={styles.screenPad}>
      <div style={styles.heroBlock}>
        <div style={styles.heroEyebrow}>TODAY'S LOOP</div>
        <div style={styles.heroTitle}>Turn 10 minutes into coins.</div>
        <div style={styles.heroSub}>Pick a task below — surveys, quick app trials, and game milestones. Coins land the moment a partner confirms it.</div>
      </div>

      <button style={styles.surveyWallBtn} onClick={onOpenSurveyWall}>
        <ClipboardList size={17} />
        <span style={{ flex: 1, textAlign: "left" }}>Open live survey wall</span>
        <ChevronRight size={17} />
      </button>

      <div style={styles.chipRow}>
        <button onClick={() => setFilter("all")} style={filter === "all" ? styles.chipActive : styles.chip}>All</button>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <button key={key} onClick={() => setFilter(key)} style={filter === key ? { ...styles.chipActive, borderColor: meta.color } : styles.chip}>
            {meta.label}
          </button>
        ))}
      </div>

      <div style={styles.offerList}>
        {filtered.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            completed={completedOfferIds.includes(offer.id)}
            onComplete={onComplete}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Live CPX Research survey wall (real integration) -------------------
function SurveyWallModal({ userId, onClose }) {
  const src = buildCpxOfferwallUrl(userId);
  return (
    <div style={styles.surveyModalOverlay}>
      <div style={styles.surveyModalHeader}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15 }}>Live surveys</span>
        <button style={styles.modalClose} onClick={onClose}><X size={18} /></button>
      </div>
      <iframe
        title="CPX Research offerwall"
        src={src}
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ flex: 1, border: "none", background: "#fff" }}
      />
    </div>
  );
}

// ---- Wallet view --------------------------------------------------------
function WalletView({ balance, completedOfferIds, offers, onWithdraw, userId }) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [realBalance, setRealBalance] = useState(null); // null = not loaded yet
  const [realLoading, setRealLoading] = useState(false);
  const canWithdraw = balance >= MIN_WITHDRAW_COINS;
  const history = offers.filter((o) => completedOfferIds.includes(o.id));

  async function refreshRealBalance() {
    setRealLoading(true);
    const val = await fetchRealBalance(userId);
    setRealBalance(val);
    setRealLoading(false);
  }

  useEffect(() => {
    refreshRealBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.screenPad}>
      <div style={styles.walletCard}>
        <div style={styles.walletLabel}>Available balance</div>
        <div style={styles.walletBig}>{formatCoins(balance)} <span style={styles.walletBigUnit}>coins</span></div>
        <div style={styles.walletUsd}>${coinsToUSD(balance)} USD</div>
        <button
          style={canWithdraw ? styles.withdrawBtn : styles.withdrawBtnDisabled}
          disabled={!canWithdraw}
          onClick={() => setShowWithdraw(true)}
        >
          <CreditCard size={16} /> Cash out
        </button>
        {!canWithdraw && (
          <div style={styles.withdrawHint}>Reach {formatCoins(MIN_WITHDRAW_COINS)} coins ($5) to cash out</div>
        )}
      </div>

      <div style={styles.realEarningsCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={styles.sectionLabel2}>Real survey earnings (live)</div>
          <button style={styles.refreshBtn} onClick={refreshRealBalance} disabled={realLoading}>
            {realLoading ? "…" : "Refresh"}
          </button>
        </div>
        {realBalance === null && !realLoading ? (
          <div style={styles.realEarningsHint}>Could not reach the server yet — free servers can take ~50s to wake up. Tap Refresh.</div>
        ) : (
          <div style={styles.realEarningsAmount}>
            {formatCoins(realBalance || 0)} <span style={styles.walletBigUnit}>coins</span>
            <span style={styles.realEarningsUsd}>${coinsToUSD(realBalance || 0)}</span>
          </div>
        )}
        <div style={styles.realEarningsHint}>This comes from CPX Research surveys you've actually completed — confirmed by your postback server, not this browser.</div>
      </div>

      <div style={styles.sectionLabel}>Completed tasks</div>
      {history.length === 0 ? (
        <div style={styles.emptyState}>Nothing completed yet — head to the loop and start your first task.</div>
      ) : (
        <div style={styles.offerList}>
          {history.map((o) => (
            <div key={o.id} style={styles.historyRow}>
              <CheckCircle2 size={16} color="#4ADE9C" />
              <div style={{ flex: 1 }}>
                <div style={styles.historyTitle}>{o.title}</div>
                <div style={styles.historyProvider}>{o.provider}</div>
              </div>
              <div style={styles.historyReward}>+{formatCoins(o.reward)}</div>
            </div>
          ))}
        </div>
      )}

      {showWithdraw && (
        <WithdrawModal
          balance={balance}
          onClose={() => setShowWithdraw(false)}
          onConfirm={(method, amount) => {
            onWithdraw(method, amount);
            setShowWithdraw(false);
          }}
        />
      )}
    </div>
  );
}

function WithdrawModal({ balance, onClose, onConfirm }) {
  const [method, setMethod] = useState("paypal");
  const maxUsd = (balance / COINS_PER_DOLLAR).toFixed(2);
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span>Cash out</span>
          <button style={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={styles.modalSub}>Withdraw up to ${maxUsd} from your {formatCoins(balance)} coin balance.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {[
            { id: "paypal", label: "PayPal", note: "5% fee · 24–72h" },
            { id: "crypto", label: "Crypto (USDC)", note: "No fee · minutes" },
            { id: "giftcard", label: "Gift card", note: "No fee · instant" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              style={method === m.id ? styles.methodRowActive : styles.methodRow}
            >
              <span>{m.label}</span>
              <span style={styles.methodNote}>{m.note}</span>
            </button>
          ))}
        </div>
        <button style={styles.confirmBtn} onClick={() => onConfirm(method, balance)}>
          Confirm cash out
        </button>
        <div style={styles.modalFootnote}>
          Demo only — no real payout is sent. In production this calls your payments backend after verifying identity.
        </div>
      </div>
    </div>
  );
}

// ---- Leaderboard (mock, illustrative only) -----------------------------
function LeaderboardView({ balance }) {
  const mockLeaders = [
    { name: "quietfalcon22", coins: 48200 },
    { name: "marina_ok", coins: 39750 },
    { name: "j.rivers", coins: 31120 },
    { name: "nadaa", coins: 27400 },
    { name: "kepler9", coins: 21990 },
  ];
  return (
    <div style={styles.screenPad}>
      <div style={styles.heroBlock}>
        <div style={styles.heroEyebrow}>THIS MONTH</div>
        <div style={styles.heroTitle}>Top earners</div>
        <div style={styles.heroSub}>Illustrative leaderboard — wire this to your real user database and update on a cron job.</div>
      </div>
      <div style={styles.offerList}>
        {mockLeaders.map((l, i) => (
          <div key={l.name} style={styles.leaderRow}>
            <div style={styles.leaderRank}>{i + 1}</div>
            <div style={{ flex: 1 }}>{l.name}</div>
            <div style={styles.leaderCoins}><Trophy size={13} color="#F5B740" /> {formatCoins(l.coins)}</div>
          </div>
        ))}
        <div style={{ ...styles.leaderRow, background: "#22224a", border: "1px solid #F5B74055" }}>
          <div style={styles.leaderRank}>—</div>
          <div style={{ flex: 1 }}>You</div>
          <div style={styles.leaderCoins}><Trophy size={13} color="#F5B740" /> {formatCoins(balance)}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Referral view -------------------------------------------------
function ReferralView({ referralCode }) {
  const [copied, setCopied] = useState(false);
  const link = `https://lootloop.app/r/${referralCode}`;
  return (
    <div style={styles.screenPad}>
      <div style={styles.heroBlock}>
        <div style={styles.heroEyebrow}>INVITE & EARN</div>
        <div style={styles.heroTitle}>Get 10% of what friends earn.</div>
        <div style={styles.heroSub}>Share your code. When a friend completes tasks, you get a cut for their first 90 days.</div>
      </div>
      <div style={styles.referralCard}>
        <div style={styles.referralCode}>{referralCode}</div>
        <button
          style={styles.copyBtn}
          onClick={() => {
            navigator.clipboard?.writeText(link).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div style={styles.emptyState}>You haven't invited anyone yet. Once real referrals are wired to a backend, they'll show up here.</div>
    </div>
  );
}

// ---- Profile view ---------------------------------------------------
function ProfileView({ profile, offers }) {
  const joinedDate = new Date(profile.joined).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div style={styles.screenPad}>
      <div style={styles.profileHeader}>
        <div style={styles.avatar}><User size={26} color="#12122B" /></div>
        <div>
          <div style={styles.profileName}>Your account</div>
          <div style={styles.profileJoined}>Member since {joinedDate}</div>
        </div>
      </div>
      <div style={styles.statGrid}>
        <div style={styles.statBox}>
          <TrendingUp size={16} color="#4ADE9C" />
          <div style={styles.statNum}>{profile.completedOfferIds.length}</div>
          <div style={styles.statLabel}>Tasks done</div>
        </div>
        <div style={styles.statBox}>
          <Coins size={16} color="#F5B740" />
          <div style={styles.statNum}>{formatCoins(profile.balance)}</div>
          <div style={styles.statLabel}>Coin balance</div>
        </div>
      </div>
      <div style={styles.sectionLabel}>Integration checklist</div>
      <div style={styles.checklist}>
        {[
          "Sign up as a publisher with an offerwall network (CPX Research, AdGate Media, BitLabs)",
          "Replace SEED_OFFERS with a live API pull from that network",
          "Add a postback endpoint so the network can confirm real task completion",
          "Add identity verification before first withdrawal",
          "Connect a real payments backend for PayPal / crypto / gift cards",
        ].map((step, i) => (
          <div key={i} style={styles.checkItem}>
            <div style={styles.checkNum}>{i + 1}</div>
            <div>{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- App shell -------------------------------------------------------
const TABS = [
  { id: "offers", label: "Loop", icon: Home },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "leaderboard", label: "Ranks", icon: Trophy },
  { id: "referral", label: "Invite", icon: Users },
  { id: "profile", label: "You", icon: User },
];

export default function LootLoopApp() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("offers");
  const [burst, setBurst] = useState(null); // { amount }
  const [showSurveyWall, setShowSurveyWall] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await loadProfile();
      // backward-compat: older saved profiles won't have a userId yet
      const ready = loaded ? { ...loaded, userId: loaded.userId || randomUserId() } : defaultProfile();
      setProfile(ready);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (profile && !loading) saveProfile(profile);
  }, [profile, loading]);

  if (loading || !profile) {
    return (
      <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9491B8", fontFamily: "'Space Grotesk', sans-serif" }}>Loading LootLoop…</div>
      </div>
    );
  }

  function handleComplete(offer) {
    if (profile.completedOfferIds.includes(offer.id)) return;
    // INTEGRATION POINT: in production you don't credit coins on click.
    // The user is redirected to the advertiser/offer, and coins are only
    // credited when the offerwall network sends a signed postback
    // confirming the task was genuinely completed (this is how Freecash-
    // style platforms prevent fraud).
    setProfile((p) => ({
      ...p,
      balance: p.balance + offer.reward,
      completedOfferIds: [...p.completedOfferIds, offer.id],
    }));
    setBurst({ amount: offer.reward });
  }

  function handleWithdraw(method, amount) {
    // INTEGRATION POINT: call your real payments backend here, then only
    // deduct the balance after it confirms the payout was sent.
    setProfile((p) => ({ ...p, balance: p.balance - amount }));
  }

  return (
    <div style={styles.app}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font-family: inherit; cursor: pointer; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
      `}</style>

      <BalanceTicker balance={profile.balance} />

      <div style={styles.screenScroll}>
        {tab === "offers" && (
          <OffersView
            offers={SEED_OFFERS}
            completedOfferIds={profile.completedOfferIds}
            onComplete={handleComplete}
            onOpenSurveyWall={() => setShowSurveyWall(true)}
          />
        )}
        {tab === "wallet" && (
          <WalletView
            balance={profile.balance}
            completedOfferIds={profile.completedOfferIds}
            offers={SEED_OFFERS}
            onWithdraw={handleWithdraw}
            userId={profile.userId}
          />
        )}
        {tab === "leaderboard" && <LeaderboardView balance={profile.balance} />}
        {tab === "referral" && <ReferralView referralCode={profile.referralCode} />}
        {tab === "profile" && <ProfileView profile={profile} offers={SEED_OFFERS} />}
      </div>

      <nav style={styles.navBar}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={styles.navBtn}>
              <Icon size={20} color={active ? "#F5B740" : "#6E6B94"} />
              <span style={{ ...styles.navLabel, color: active ? "#F1EFEA" : "#6E6B94" }}>{t.label}</span>
              {active && <div style={styles.navDot} />}
            </button>
          );
        })}
      </nav>

      {burst && <CoinBurst amount={burst.amount} onDone={() => setBurst(null)} />}
      {showSurveyWall && <SurveyWallModal userId={profile.userId} onClose={() => setShowSurveyWall(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------
// styles — deep indigo / coin-gold token system, no localStorage used.
// ---------------------------------------------------------------------
const styles = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
    background: "#12122B",
    color: "#F1EFEA",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  ticker: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid #23234a",
    background: "#15152F",
    flexShrink: 0,
  },
  tickerLeft: { display: "flex", alignItems: "center", gap: 8 },
  tickerCoinDot: { width: 22, height: 22, borderRadius: "50%", background: "#F5B740", display: "flex", alignItems: "center", justifyContent: "center" },
  tickerCoins: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 15 },
  tickerUsd: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#9491B8" },
  tickerBrand: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 0.5 },

  screenScroll: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  screenPad: { padding: "20px 18px 100px" },

  heroBlock: { marginBottom: 18 },
  heroEyebrow: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: "#F5B740", marginBottom: 8 },
  heroTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, lineHeight: 1.15, marginBottom: 8 },
  heroSub: { fontSize: 13.5, color: "#9491B8", lineHeight: 1.5 },

  surveyWallBtn: { width: "100%", display: "flex", alignItems: "center", gap: 10, background: "#7DD3C022", border: "1px solid #7DD3C0", color: "#7DD3C0", borderRadius: 14, padding: "13px 14px", fontSize: 13.5, fontWeight: 700, marginBottom: 18 },
  surveyModalOverlay: { position: "absolute", inset: 0, background: "#12122B", display: "flex", flexDirection: "column", zIndex: 25 },
  surveyModalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #23234a", background: "#15152F", flexShrink: 0 },

  chipRow: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 },
  chip: { flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: "1px solid #2C2C56", background: "transparent", color: "#9491B8", fontSize: 12.5, fontWeight: 500 },
  chipActive: { flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: "1px solid #F5B740", background: "#F5B74022", color: "#F5B740", fontSize: 12.5, fontWeight: 600 },

  offerList: { display: "flex", flexDirection: "column", gap: 10 },
  offerCard: { display: "flex", alignItems: "center", gap: 12, background: "#181834", border: "1px solid #232350", borderRadius: 16, padding: 14 },
  offerIconWrap: { width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  offerTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 },
  offerMeta: { fontSize: 11.5, color: "#7C79A0", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" },
  dot: { color: "#44417A" },
  offerReward: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: "#F5B740" },
  offerRewardUsd: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#7C79A0", marginBottom: 6 },
  offerBtn: { background: "#F5B740", color: "#12122B", border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700 },
  doneBadge: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#4ADE9C", fontWeight: 600 },

  walletCard: { background: "linear-gradient(160deg, #1E1E48, #15152F)", border: "1px solid #2C2C56", borderRadius: 20, padding: "24px 20px", textAlign: "center", marginBottom: 24 },
  walletLabel: { fontSize: 12, color: "#9491B8", marginBottom: 6 },
  walletBig: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700 },
  walletBigUnit: { fontSize: 16, color: "#9491B8", fontWeight: 500 },
  walletUsd: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#F5B740", marginTop: 4, marginBottom: 18 },
  withdrawBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "#F5B740", color: "#12122B", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13.5 },
  withdrawBtnDisabled: { display: "inline-flex", alignItems: "center", gap: 7, background: "#2C2C56", color: "#6E6B94", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13.5, cursor: "not-allowed" },
  withdrawHint: { fontSize: 11, color: "#7C79A0", marginTop: 8 },

  sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "#7C79A0", marginBottom: 10, textTransform: "uppercase" },
  sectionLabel2: { fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, color: "#7DD3C0", textTransform: "uppercase" },
  realEarningsCard: { background: "#181834", border: "1px solid #7DD3C055", borderRadius: 16, padding: 16, marginBottom: 22 },
  realEarningsAmount: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 },
  realEarningsUsd: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#7DD3C0", fontWeight: 500 },
  realEarningsHint: { fontSize: 11, color: "#7C79A0", marginTop: 8, lineHeight: 1.4 },
  refreshBtn: { background: "#2C2C56", color: "#F1EFEA", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600 },
  emptyState: { fontSize: 13, color: "#7C79A0", background: "#181834", borderRadius: 14, padding: 18, textAlign: "center", lineHeight: 1.5 },

  historyRow: { display: "flex", alignItems: "center", gap: 10, background: "#181834", border: "1px solid #232350", borderRadius: 14, padding: "10px 14px" },
  historyTitle: { fontSize: 13, fontWeight: 600 },
  historyProvider: { fontSize: 11, color: "#7C79A0" },
  historyReward: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#4ADE9C", fontWeight: 700 },

  leaderRow: { display: "flex", alignItems: "center", gap: 12, background: "#181834", border: "1px solid #232350", borderRadius: 14, padding: "12px 14px", fontSize: 13.5 },
  leaderRank: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#7C79A0", width: 20 },
  leaderCoins: { display: "flex", alignItems: "center", gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600 },

  referralCard: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#181834", border: "1px dashed #F5B740", borderRadius: 16, padding: "16px 18px", marginBottom: 20 },
  referralCode: { fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#F5B740" },
  copyBtn: { display: "flex", alignItems: "center", gap: 6, background: "#2C2C56", color: "#F1EFEA", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600 },

  profileHeader: { display: "flex", alignItems: "center", gap: 14, marginBottom: 22 },
  avatar: { width: 52, height: 52, borderRadius: "50%", background: "#F5B740", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  profileName: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 },
  profileJoined: { fontSize: 12, color: "#7C79A0" },
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 26 },
  statBox: { background: "#181834", border: "1px solid #232350", borderRadius: 14, padding: 16 },
  statNum: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginTop: 8 },
  statLabel: { fontSize: 11, color: "#7C79A0", marginTop: 2 },

  checklist: { display: "flex", flexDirection: "column", gap: 10 },
  checkItem: { display: "flex", gap: 10, background: "#181834", border: "1px solid #232350", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, color: "#C4C1E0", lineHeight: 1.4 },
  checkNum: { fontFamily: "'JetBrains Mono', monospace", color: "#F5B740", fontWeight: 700, flexShrink: 0 },

  navBar: { display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 6px 14px", borderTop: "1px solid #23234a", background: "#15152F", flexShrink: 0 },
  navBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", padding: "4px 8px", position: "relative" },
  navLabel: { fontSize: 10.5, fontWeight: 600 },
  navDot: { position: "absolute", bottom: -8, width: 4, height: 4, borderRadius: "50%", background: "#F5B740" },

  modalOverlay: { position: "absolute", inset: 0, background: "rgba(10,10,24,0.7)", display: "flex", alignItems: "flex-end", zIndex: 20 },
  modalCard: { width: "100%", background: "#181834", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px 26px", border: "1px solid #2C2C56" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 },
  modalClose: { background: "#2C2C56", border: "none", borderRadius: 8, padding: 6, color: "#F1EFEA" },
  modalSub: { fontSize: 12.5, color: "#9491B8", marginTop: 6 },
  methodRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#12122B", border: "1px solid #2C2C56", borderRadius: 12, padding: "12px 14px", color: "#F1EFEA", fontSize: 13.5 },
  methodRowActive: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F5B74022", border: "1px solid #F5B740", borderRadius: 12, padding: "12px 14px", color: "#F1EFEA", fontSize: 13.5, fontWeight: 600 },
  methodNote: { fontSize: 11, color: "#7C79A0" },
  confirmBtn: { width: "100%", background: "#F5B740", color: "#12122B", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14, marginTop: 18 },
  modalFootnote: { fontSize: 10.5, color: "#6E6B94", marginTop: 10, textAlign: "center", lineHeight: 1.4 },

  coinBurstOverlay: { position: "absolute", inset: 0, background: "rgba(10,10,24,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30 },
  coinBurstCard: { display: "flex", flexDirection: "column", alignItems: "center" },
  coinFlip: { width: 64, height: 64, animation: "flipCoin 1.1s ease-out" },
  coinFace: { width: 64, height: 64, borderRadius: "50%", background: "#F5B740", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px #F5B74088" },
};
