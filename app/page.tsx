"use client";
import { useEffect, useMemo, useState } from "react";

const MAX = 75;
const FREE_INDEX = 12;

const playSound = (src: string) => {
  const audio = new Audio(src);
  audio.play();
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

const generateCard = () => {
  const nums = Array.from({ length: MAX }, (_, i) => i + 1);
  nums.sort(() => Math.random() - 0.5);
  nums[FREE_INDEX] = 0;
  return nums.slice(0, 25);
};

export default function BingoPage() {
  const role =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("role") ?? "player"
      : "player";

  const playerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?role=player`
      : "";

  const channel = useMemo(
    () =>
      typeof window !== "undefined"
        ? new BroadcastChannel("bingo-channel")
        : null,
    []
  );

  const [drawn, setDrawn] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [card] = useState<number[]>(generateCard());
  const [opened, setOpened] = useState<boolean[]>(
    Array(25)
      .fill(false)
      .map((_, i) => i === FREE_INDEX)
  );
  const [bingo, setBingo] = useState(false);

  useEffect(() => {
    if (!channel) return;
    channel.onmessage = (e) => {
      setDrawn(e.data.drawn);
      setCurrent(e.data.current);
    };
  }, [channel]);

  const draw = () => {
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

    setTimeout(() => {
      clearInterval(shuffle);
      const final = remaining[Math.floor(Math.random() * remaining.length)];
      const next = [...drawn, final];

      setDrawn(next);
      setCurrent(final);
      setIsRolling(false);

      channel?.postMessage({ drawn: next, current: final });
    }, 3000);
  };

  const onTap = (i: number) => {
    if (opened[i]) return;
    const num = card[i];
    if (num !== 0 && !drawn.includes(num)) return;

    const next = [...opened];
    next[i] = true;
    setOpened(next);
    playSound("/open.mp3");

    if (!bingo && isBingo(next)) {
      setBingo(true);
      playSound("/bingo.mp3");
    }
  };

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>🎄 Christmas Bingo</h1>
      <div style={styles.subtitle}>
        {role === "host" ? "Host Screen" : "Player Card"}
      </div>

      {/* HOST */}
      {role === "host" && (
        <>
          <div style={styles.bigNumber}>{current ?? "―"}</div>

          <div style={styles.hostButtons}>
            <button style={styles.button} onClick={draw} disabled={isRolling}>
              {isRolling ? "Rolling… 🥁" : "Draw 🎯"}
            </button>

            <button style={styles.qrButton} onClick={() => setShowQR(true)}>
              Show QR 📱
            </button>
          </div>

          <div style={styles.hostGrid}>
            {Array.from({ length: MAX }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                style={{
                  ...styles.hostCell,
                  background: drawn.includes(n) ? "#22c55e" : "#334155",
                }}
              >
                {n}
              </div>
            ))}
          </div>
        </>
      )}

      {/* PLAYER */}
      {role === "player" && (
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

      {/* QR MODAL */}
      {showQR && (
        <div style={styles.modalBg} onClick={() => setShowQR(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Join Bingo</h3>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                playerUrl
              )}`}
              alt="QR Code"
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
          content: "🎉 🎊 🎉 🎊 🎉 🎊";
          font-size: 40px;
          animation: fall 1.5s linear infinite;
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

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: 24,
    background: "radial-gradient(circle at top, #1e293b, #020617)",
    color: "#f8fafc",
    textAlign: "center",
  },
  title: { fontSize: 28 },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  bigNumber: {
    fontSize: 160,
    fontWeight: 700,
    color: "#facc15",
  },
  hostButtons: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
  },
  button: { fontSize: 18, padding: "10px 20px" },
  qrButton: { fontSize: 16, padding: "10px 16px" },
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
    overflow: "hidden",
  },
  hole: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle,#020617 0%,#020617 40%,transparent 45%)",
    animation: "holeOpen 0.35s ease-out forwards",
  },
  bingo: { fontSize: 40, color: "#facc15" },
  hostGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(15,1fr)",
    gap: 4,
    maxWidth: 600,
    margin: "24px auto",
  },
  hostCell: {
    fontSize: 12,
    padding: 4,
    borderRadius: 4,
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
