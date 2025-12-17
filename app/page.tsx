"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* =====================
   Supabase
===================== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* =====================
   定数
===================== */
const MAX = 75;
const FREE_INDEX = 12;

/* =====================
   util
===================== */
const playSound = (src: string) => {
  const audio = new Audio(src);
  audio.play();
};

const generateCard = () => {
  const nums = Array.from({ length: MAX }, (_, i) => i + 1);
  nums.sort(() => Math.random() - 0.5);
  nums[FREE_INDEX] = 0;
  return nums.slice(0, 25);
};

const isBingo = (opened: boolean[]) => {
  const lines = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];
  return lines.some((line) => line.every((i) => opened[i]));
};

type ConnectionStatus = "connecting" | "connected" | "error";

/* =====================
   Component
===================== */
export default function BingoPage() {
  const role =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("role") ?? "player"
      : "player";

  const playerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?role=player`
      : "";

  /* ---- shared state ---- */
  const [drawn, setDrawn] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  /* ---- player local state ---- */
  const [card, setCard] = useState<number[]>([]);
  const [opened, setOpened] = useState<boolean[]>([]);
  const [bingo, setBingo] = useState(false);

  /* ---- ui ---- */
  const [showQR, setShowQR] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  /* =====================
     初期ロード + Realtime
  ===================== */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("bingo_state")
        .select("*")
        .eq("id", 1)
        .single();

      if (data) {
        setDrawn(data.drawn ?? []);
        setCurrent(data.current);
      }
    };
    load();

    const channel = supabase
      .channel("bingo-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bingo_state" },
        (payload) => {
          setDrawn(payload.new.drawn ?? []);
          setCurrent(payload.new.current);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionStatus("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setConnectionStatus("error");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* =====================
     Player: card restore
  ===================== */
  useEffect(() => {
    if (role !== "player") return;

    const savedCard = localStorage.getItem("bingo-card");
    const savedOpened = localStorage.getItem("bingo-opened");

    if (savedCard) {
      setCard(JSON.parse(savedCard));
    } else {
      const newCard = generateCard();
      setCard(newCard);
      localStorage.setItem("bingo-card", JSON.stringify(newCard));
    }

    if (savedOpened) {
      setOpened(JSON.parse(savedOpened));
    } else {
      const initial = Array(25)
        .fill(false)
        .map((_, i) => i === FREE_INDEX);
      setOpened(initial);
      localStorage.setItem("bingo-opened", JSON.stringify(initial));
    }
  }, [role]);

  /* =====================
     Host: draw
  ===================== */
  const draw = async () => {
    if (isRolling) return;

    const remaining = Array.from({ length: MAX }, (_, i) => i + 1).filter(
      (n) => !drawn.includes(n)
    );
    if (remaining.length === 0) return;

    setIsRolling(true);
    playSound("/draw.mp3");

    const shuffle = setInterval(() => {
      setCurrent(remaining[Math.floor(Math.random() * remaining.length)]);
    }, 80);

    setTimeout(async () => {
      clearInterval(shuffle);
      const final = remaining[Math.floor(Math.random() * remaining.length)];
      const next = [...drawn, final];

      await supabase
        .from("bingo_state")
        .update({ drawn: next, current: final })
        .eq("id", 1);

      setIsRolling(false);
    }, 3000);
  };

  /* =====================
     Host: reset
  ===================== */
  const resetGame = async () => {
    if (role !== "host") return;

    await supabase
      .from("bingo_state")
      .update({ drawn: [], current: null })
      .eq("id", 1);

    setDrawn([]);
    setCurrent(null);
    setIsRolling(false);
  };

  /* =====================
     Player: tap
  ===================== */
  const onTap = (i: number) => {
    if (opened[i]) return;
    const num = card[i];
    if (num !== 0 && !drawn.includes(num)) return;

    const next = [...opened];
    next[i] = true;
    setOpened(next);
    localStorage.setItem("bingo-opened", JSON.stringify(next));

    playSound("/open.mp3");

    if (!bingo && isBingo(next)) {
      setBingo(true);
      playSound("/bingo.mp3");
    }
  };

  /* =====================
     Render
  ===================== */
  return (
    <main style={styles.main}>
      <h1 style={styles.title}>🎄 Christmas Bingo</h1>
      <div style={styles.subtitle}>
        {role === "host" ? "Host Screen" : "Player Card"}
      </div>

      {role === "player" && (
        <div style={styles.connection}>
          {connectionStatus === "connecting" && "🟡 Connecting…"}
          {connectionStatus === "connected" && "🟢 Connected"}
          {connectionStatus === "error" && "🔴 Not connected"}
        </div>
      )}

      {role === "host" && (
        <>
          <div style={styles.bigNumber}>{current ?? "―"}</div>

          <div style={styles.hostButtons}>
            <button
              onClick={draw}
              disabled={isRolling}
              style={{
                ...styles.drawButton,
                opacity: isRolling ? 0.6 : 1,
              }}
            >
              {isRolling ? "Rolling… 🥁" : "DRAW"}
            </button>

            <button onClick={() => setShowQR(true)} style={styles.qrButton}>
              QR
            </button>

            <button onClick={resetGame} style={styles.resetButton}>
              RESET
            </button>
          </div>
        </>
      )}

      {role === "player" && card.length > 0 && (
        <>
          <div style={styles.grid}>
            {card.map((num, i) => (
              <div
                key={i}
                onClick={() => onTap(i)}
                style={{
                  ...styles.cell,
                  background: opened[i]
                    ? "#020617"
                    : num === 0 || drawn.includes(num)
                    ? "#334155"
                    : "#0f172a",
                }}
              >
                {num === 0 ? "FREE" : num}
                {opened[i] && <div style={styles.hole} />}
              </div>
            ))}
          </div>

          {bingo && (
            <>
              <div style={styles.bingo}>🎉 BINGO!! 🎉</div>
              <div className="confetti" />
            </>
          )}
        </>
      )}

      {showQR && (
        <div style={styles.modalBg} onClick={() => setShowQR(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Join Bingo</h3>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                playerUrl
              )}`}
            />
            <p>{playerUrl}</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes holeOpen {
          from {
            transform: scale(0.2);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .confetti::before {
          content: "🎉 🎊 🎉 🎊 🎉 🎊 🎉 🎊";
          font-size: 36px;
          animation: fall 1.2s linear infinite;
          display: block;
        }
        @keyframes fall {
          from {
            transform: translateY(-20px);
            opacity: 1;
          }
          to {
            transform: translateY(120px);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}

/* =====================
   styles
===================== */
const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: 24,
    background: "radial-gradient(circle at top, #1e293b, #020617)",
    color: "#f8fafc",
    textAlign: "center",
  },
  title: { fontSize: 28 },
  subtitle: { fontSize: 14, opacity: 0.7, marginBottom: 16 },

  connection: {
    position: "fixed",
    top: 12,
    right: 12,
    fontSize: 12,
    background: "rgba(0,0,0,0.4)",
    padding: "4px 8px",
    borderRadius: 8,
  },

  bigNumber: {
    fontSize: 160,
    fontWeight: 700,
    color: "#facc15",
    marginBottom: 16,
  },

  hostButtons: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },

  drawButton: {
    fontSize: 22,
    fontWeight: 700,
    padding: "14px 36px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    color: "#020617",
    background: "linear-gradient(135deg, #facc15, #fde047)",
    boxShadow: "0 10px 30px rgba(250,204,21,0.4)",
  },

  qrButton: {
    fontSize: 16,
    padding: "12px 20px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "transparent",
    color: "#f8fafc",
    cursor: "pointer",
  },

  resetButton: {
    fontSize: 12,
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(5,1fr)",
    gap: 10,
    maxWidth: 340,
    margin: "24px auto",
  },

  cell: {
    position: "relative",
    aspectRatio: "1",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    overflow: "hidden",
  },

  hole: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle,#020617 0%,#020617 40%,transparent 45%)",
    animation: "holeOpen 0.35s ease-out forwards",
  },

  bingo: {
    fontSize: 40,
    color: "#facc15",
    marginTop: 16,
  },

  modalBg: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modal: {
    background: "#020617",
    padding: 24,
    borderRadius: 12,
  },
};
