import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/api/client";
import { STORAGE_KEYS } from "@/lib/constants";
import PhaseWaiting from "@/components/guest/PhaseWaiting";
import PhaseMenu from "@/components/guest/PhaseMenu";
import PhaseHacking from "@/components/guest/PhaseHacking";
import PhaseBlackout from "@/components/guest/PhaseBlackout";

// ==========================================
// SYNTHETIC PHASE AUDIO ENGINE (Web Audio API)
// ==========================================
let normalBgmInterval = null;
let bgmOscs = [];

function startNormalBGM() {
  const ctx = window.audioCtx;
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Play a gentle, soothing ambient pentatonic arpeggio (C - D - E - G - A)
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    let noteIndex = 0;

    const playNote = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const freq = notes[noteIndex % notes.length];
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.3);

      bgmOscs.push(osc);
      // Clean up reference after note ends
      setTimeout(() => {
        bgmOscs = bgmOscs.filter(o => o !== osc);
      }, 1500);

      noteIndex = (noteIndex + Math.floor(Math.random() * 3) + 1) % notes.length;
    };

    playNote();
    normalBgmInterval = setInterval(playNote, 400); // Gentle 150 BPM pulse
    console.log("[Audio] Normal BGM started.");
  } catch (err) {
    console.error("[Audio] Failed to start normal BGM:", err);
  }
}

function stopNormalBGM() {
  if (normalBgmInterval) {
    clearInterval(normalBgmInterval);
    normalBgmInterval = null;
  }
  bgmOscs.forEach(osc => {
    try { osc.stop(); } catch {}
  });
  bgmOscs = [];
  console.log("[Audio] Normal BGM stopped.");
}

// Global alarm state trackers for Hacking Phase
let alarmIntervalId = null;
let droneOsc = null;
let droneGain = null;

function startCyberAlarm() {
  const ctx = window.audioCtx;
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // 1. Low Drone Vibration
    droneOsc = ctx.createOscillator();
    droneGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    droneOsc.type = "sawtooth";
    droneOsc.frequency.setValueAtTime(60, ctx.currentTime); // Deep Low C

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(150, ctx.currentTime);

    droneGain.gain.setValueAtTime(0.10, ctx.currentTime);

    droneOsc.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(ctx.destination);

    droneOsc.start();

    // 2. High Pulsing Cyber Alarm
    const playBeep = () => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(950, ctx.currentTime + 0.25);
      osc.frequency.linearRampToValueAtTime(750, ctx.currentTime + 0.5);

      oscGain.gain.setValueAtTime(0, ctx.currentTime);
      oscGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      oscGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.45);
      oscGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    };

    playBeep();
    alarmIntervalId = setInterval(playBeep, 600);
    console.log("[Audio] Cyber Alarm started.");
  } catch (err) {
    console.error("[Audio] Failed to start cyber alarm:", err);
  }
}

function stopCyberAlarm() {
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  if (droneOsc) {
    try {
      droneOsc.stop();
    } catch {}
    droneOsc = null;
  }
  if (droneGain) {
    droneGain.disconnect();
    droneGain = null;
  }
  console.log("[Audio] Cyber Alarm stopped.");
}

// Success Fanfare
export function playSuccessFanfare() {
  const ctx = window.audioCtx;
  if (!ctx || ctx.state === "suspended") return;

  try {
    const now = ctx.currentTime;
    const freqs = [261.63, 329.63, 392.00, 523.25];
    freqs.forEach((f, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + index * 0.12);

      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.08, now + index * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.6);
    });
    console.log("[Audio] Success Fanfare played.");
  } catch (err) {
    console.error("[Audio] Fanfare failed:", err);
  }
}

// Attach to window so PhaseMenu component can trigger it on ordering
window.playSuccessFanfare = playSuccessFanfare;

export default function Guest() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guestUser, setGuestUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [token, setToken] = useState(null);
  const [timeStr, setTimeStr] = useState("");

  const socketRef = useRef(null);

  // Initialize and warm up the AudioContext on the first user interaction (Autoplay compliance)
  useEffect(() => {
    const initAudio = () => {
      try {
        if (!window.audioCtx) {
          window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          console.log("[Audio] AudioContext initialized successfully via user gesture!");
        }
        if (window.audioCtx && window.audioCtx.state === "suspended") {
          window.audioCtx.resume().then(() => {
            console.log("[Audio] AudioContext resumed!");
          });
        }
      } catch (err) {
        console.error("[Audio] Failed to initialize AudioContext:", err);
      }
    };

    window.addEventListener("click", initAudio);
    window.addEventListener("touchstart", initAudio);

    return () => {
      window.removeEventListener("click", initAudio);
      window.removeEventListener("touchstart", initAudio);
    };
  }, []);

  // Live Digital Clock (Date & Time) at the top of guest screens
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const dayPart = now.toLocaleDateString('ja-JP', { weekday: 'short' });
      const timePart = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setTimeStr(`${datePart} (${dayPart}) ${timePart}`);
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  const checkBlackoutLock = useCallback((tok) => {
    if (!tok) return false;
    return localStorage.getItem(STORAGE_KEYS.BLACKOUT_LOCK(tok)) === "true";
  }, []);

  const loadRoomPhase = useCallback((roomId) => {
    api.rooms.get(roomId)
      .then((r) => {
        if (!r) {
          setError("招待リンクが無効か、部屋が見つかりません。画面を更新してください。");
          setLoading(false);
          return;
        }
        setRoom(r);
        setLoading(false);
      })
      .catch(() => {
        setError("通信エラーが発生しました。画面を更新して再接続してください。");
        setLoading(false);
      });
  }, []);

  // Initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("token");
    if (!tok) {
      setError("招待リンクが無効です。正しいURLをお使いください。");
      setLoading(false);
      return;
    }
    setToken(tok);

    if (checkBlackoutLock(tok)) {
      setRoom({ phase: "BLACKOUT" });
      setGuestUser({ sessionToken: tok });
      setLoading(false);
      return;
    }

    const cached = sessionStorage.getItem(STORAGE_KEYS.GUEST_DATA);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.sessionToken === tok) {
          setGuestUser(parsed);
          loadRoomPhase(parsed.roomId);
          return;
        }
      } catch {}
    }

    api.guests.list({ sessionToken: tok })
      .then((users) => {
        if (!users || users.length === 0) {
          setError("招待リンクが無効か、お部屋が見つかりません。画面を更新してください。");
          setLoading(false);
          return;
        }
        const user = users[0];
        if (!user.isActive) {
          setError("あなたのセッションは終了しました。");
          setLoading(false);
          return;
        }
        sessionStorage.setItem(STORAGE_KEYS.GUEST_DATA, JSON.stringify(user));
        setGuestUser(user);
        loadRoomPhase(user.roomId);
      })
      .catch(() => {
        setError("通信エラーが発生しました。画面を更新して再接続してください。");
        setLoading(false);
      });
  }, [checkBlackoutLock, loadRoomPhase]);

  // WebSocket connection & lifecycle management
  useEffect(() => {
    if (!guestUser?.roomId || !room) return;

    const currentPhase = room.phase || "WAITING";
    const isInteractive = currentPhase !== "BLACKOUT"; // Keep WS alive in all phases except BLACKOUT

    if (!isInteractive) {
      if (socketRef.current) {
        console.log("[WebSocket] Phase is static blackout. Closing active connection.");
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    // Connect to WebSocket Server if interactive and not already connected
    if (!socketRef.current) {
      console.log(`[WebSocket] Connecting to WebSocket Server (Current Phase: ${currentPhase}).`);

      let wsUrl = "";
      const wsUrlEnv = import.meta.env.VITE_WS_URL;
      const apiUrlEnv = import.meta.env.VITE_API_URL;

      if (wsUrlEnv) {
        wsUrl = `${wsUrlEnv}?roomId=${guestUser.roomId}&guestId=${guestUser.id}`;
      } else if (apiUrlEnv && apiUrlEnv.startsWith("http")) {
        const parsedUrl = new URL(apiUrlEnv);
        const wsProtocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${parsedUrl.host}${parsedUrl.pathname}/ws?roomId=${guestUser.roomId}&guestId=${guestUser.id}`;
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${protocol}//${window.location.host}/api/ws?roomId=${guestUser.roomId}&guestId=${guestUser.id}`;
      }

      console.log(`[WebSocket] Resolved WebSocket URL: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "PHASE_UPDATE") {
            console.log(`[WebSocket] Real-time Phase Broadcast: ${data.phase}`);

            // Online Synchronization / Reset Blackout Lock if we receive a non-blackout state
            if (data.phase !== "BLACKOUT" && token) {
              console.log("[WebSocket] Active phase sync reset. Clearing local blackout lock.");
              localStorage.removeItem(STORAGE_KEYS.BLACKOUT_LOCK(token));
            }

            setRoom(prev => {
              if (prev && prev.phase !== data.phase) {
                return { ...prev, phase: data.phase };
              }
              return prev;
            });
          }
        } catch (e) {
          console.error("[WebSocket] Failed to parse broadcast message:", e);
        }
      };

      ws.onclose = () => {
        console.log("[WebSocket] Connection closed.");
        socketRef.current = null;
      };

      ws.onerror = (e) => {
        console.error("[WebSocket] Error occurred:", e);
        socketRef.current = null;
      };
    }

    return () => {
      // Cleanup on unmount
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [guestUser, room?.phase, token]);

  // Strict Phase BGM & Cyber Alarm management
  useEffect(() => {
    const currentPhase = room?.phase || "WAITING";

    // Stop all current sounds first
    stopNormalBGM();
    stopCyberAlarm();

    // Start sound based on current phase (Autoplay compliant)
    if (currentPhase === "MENU_OPEN" || currentPhase === "MENU_OPEN_2") {
      startNormalBGM();
    } else if (currentPhase === "HACKING") {
      startCyberAlarm();
    }
    // WAITING / BLACKOUT remains completely quiet

    return () => {
      stopNormalBGM();
      stopCyberAlarm();
    };
  }, [room?.phase]);

  const handleCountdownEnd = useCallback(() => {
    if (token) localStorage.setItem(STORAGE_KEYS.BLACKOUT_LOCK(token), "true");
    setRoom((r) => ({ ...r, phase: "BLACKOUT" }));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen cute-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-pink-300 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-pink-400 text-sm" style={{ fontFamily: "var(--font-heading)" }}>
            接続中…♡
          </p>
        </div>
      </div>
    );
  }

  // Beautiful Reload Prompt Screen if Room/Guest are not found or communication fails
  if (error) {
    return (
      <div className="min-h-screen cute-gradient flex items-center justify-center p-6 text-center">
        <div className="bg-white/90 backdrop-blur-md border-2 border-pink-200 rounded-3xl p-8 max-w-sm shadow-xl">
          <span className="text-5xl">🥺</span>
          <h2 className="text-xl font-bold text-pink-900 mt-4 leading-tight">接続エラー</h2>
          <p className="text-pink-700/80 text-xs mt-3 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-md"
          >
            画面を更新する (リロード)
          </button>
        </div>
      </div>
    );
  }

  const phase = room?.phase || "WAITING";

  if (phase === "BLACKOUT") {
    return <PhaseBlackout token={token} />;
  }

  return (
    <div className="min-h-screen relative pt-10">
      {/* Top Live Clock Header */}
      {phase !== "BLACKOUT" && (
        <div className="fixed top-0 left-0 right-0 bg-black/60 backdrop-blur-md border-b border-pink-500/20 py-2 px-4 flex items-center justify-between z-50 text-[10px] sm:text-xs text-pink-300 font-mono tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
            <span>CONNECTING LIVE SYSTEM</span>
          </div>
          <div className="font-semibold">{timeStr}</div>
        </div>
      )}

      {phase === "HACKING" ? (
        <PhaseHacking
          guestName={guestUser?.name}
          onCountdownEnd={handleCountdownEnd}
        />
      ) : (phase === "MENU_OPEN" || phase === "MENU_OPEN_2") ? (
        <PhaseMenu guestName={guestUser?.name} />
      ) : (
        <PhaseWaiting
          guestName={guestUser?.name}
          onReload={() => window.location.reload()}
        />
      )}
    </div>
  );
}