import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

let emergencyAlarmId = null;
let emergencyOscs = [];

function playEmergencySiren() {
  const ctx = window.audioCtx;
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const playSiren = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      // Sweeping pitch between 660Hz and 880Hz (standard high-urgency siren)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.26);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      emergencyOscs.push(osc);
    };

    playSiren();
    emergencyAlarmId = setInterval(playSiren, 350); // Fast high-intensity alarm
  } catch (err) {
    console.error(err);
  }
}

function stopEmergencySiren() {
  if (emergencyAlarmId) {
    clearInterval(emergencyAlarmId);
    emergencyAlarmId = null;
  }
  emergencyOscs.forEach(osc => {
    try { osc.stop(); } catch {}
  });
  emergencyOscs = [];
}

export default function PhaseEmergency({ token, onCountdownEnd }) {
  const [countdown, setCountdown] = useState(20);
  const [hazardFlash, setHazardFlash] = useState(false);

  useEffect(() => {
    playEmergencySiren();
    return () => {
      stopEmergencySiren();
    };
  }, []);

  useEffect(() => {
    const flashInterval = setInterval(() => {
      setHazardFlash((f) => !f);
    }, 400);
    return () => clearInterval(flashInterval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          if (token) {
            localStorage.setItem(STORAGE_KEYS.BLACKOUT_LOCK(token), "true");
          }
          onCountdownEnd?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [token, onCountdownEnd]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center font-mono select-none ${
      hazardFlash ? "bg-red-950 text-yellow-500" : "bg-black text-red-600"
    } transition-colors duration-200 overflow-hidden`}>

      {/* Top and Bottom Hazard Stripes */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-repeat-x flex items-center justify-center pointer-events-none" style={{
        backgroundImage: "linear-gradient(45deg, #f59e0b 25%, #000 25%, #000 50%, #f59e0b 50%, #f59e0b 75%, #000 75%, #000)",
        backgroundSize: "40px 40px"
      }} />

      <div className="absolute bottom-0 left-0 right-0 h-10 bg-repeat-x flex items-center justify-center pointer-events-none" style={{
        backgroundImage: "linear-gradient(45deg, #f59e0b 25%, #000 25%, #000 50%, #f59e0b 50%, #f59e0b 75%, #000 75%, #000)",
        backgroundSize: "40px 40px"
      }} />

      <div className="relative z-10 max-w-sm space-y-6">
        <div className="text-6xl animate-bounce">🚨</div>
        <h2 className="text-3xl font-extrabold tracking-widest uppercase animate-pulse" style={{ textShadow: "0 0 20px currentColor" }}>
          緊急事態発生
        </h2>
        <div className="w-full h-1 bg-current opacity-30 my-4" />
        <p className="text-sm font-bold uppercase tracking-wider leading-relaxed">
          システムに致命的なエラーが検出されました。
          直ちにすべての操作を停止してください。
        </p>
        <div className="p-4 bg-black/60 border border-current rounded-2xl flex flex-col items-center justify-center min-w-[200px] shadow-2xl">
          <span className="text-[10px] opacity-60 uppercase mb-2">AUTO REBOOT IMINENT</span>
          <div className="text-6xl font-black font-sans tabular-nums animate-pulse">
            {countdown}
          </div>
          <span className="text-xs opacity-80 mt-2">SYSTEM SHUTDOWN IN SECONDS</span>
        </div>
        <p className="text-[10px] opacity-40 uppercase">
          DO NOT REBOOT. CRITICAL KERNEL LOCK IN PROCESS.
        </p>
      </div>
    </div>
  );
}
