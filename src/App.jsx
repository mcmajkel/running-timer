import { useState, useEffect, useRef, useCallback } from "react";

const PLAN = [
  { week: "1–2", runMin: 2, walkMin: 1, rounds: 6, label: "2min bieg / 1min marsz × 6" },
  { week: "3–4", runMin: 5, walkMin: 1, rounds: 4, label: "5min bieg / 1min marsz × 4" },
  { week: "5–6", runMin: 8, walkMin: 1, rounds: 3, label: "8min bieg / 1min marsz × 3" },
  { week: "7–8", runMin: 12, walkMin: 1, rounds: 2, label: "12min bieg / 1min marsz × 2" },
  { week: "9–10", runMin: 20, walkMin: 0, rounds: 1, label: "20 min ciągły bieg" },
  { week: "11", runMin: 25, walkMin: 0, rounds: 1, label: "25 min ciągły bieg" },
  { week: "12 🎯", runMin: 35, walkMin: 0, rounds: 1, label: "5 km — cel!" },
];

const WARMUP_SEC = 5 * 60;
const COOLDOWN_SEC = 4 * 60;

const THEME = {
  run:      { bg: "#030a03", accent: "#00ff88", timer: "#00ff88", label: "#00ff88", dim: "#00803c", next: "#00cc6a", glow: "#00ff8844" },
  walk:     { bg: "#020512", accent: "#00cfff", timer: "#00cfff", label: "#00cfff", dim: "#006680", next: "#00a8d4", glow: "#00cfff44" },
  warmup:   { bg: "#110800", accent: "#ff8c00", timer: "#ff8c00", label: "#ff8c00", dim: "#804400", next: "#ffaa33", glow: "#ff8c0044" },
  cooldown: { bg: "#08010f", accent: "#cc66ff", timer: "#cc66ff", label: "#cc66ff", dim: "#660099", next: "#aa44dd", glow: "#cc66ff44" },
  idle:     { bg: "#080808", accent: "#e5e5e5", timer: "#e5e5e5", label: "#e5e5e5", dim: "#303030", next: "#aaa",    glow: "transparent" },
  done:     { bg: "#0a0600", accent: "#ffd700", timer: "#ffd700", label: "#ffd700", dim: "#806800", next: "#ffc000", glow: "#ffd70044" },
};

function beep(ctx, freq, dur, vol = 0.5) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.value = freq; o.type = "sine";
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.start(); o.stop(ctx.currentTime + dur);
}

function signal(ctx, type) {
  if (!ctx) return;
  if (type === "run")    { beep(ctx, 880, 0.12); setTimeout(() => beep(ctx, 1100, 0.2), 150); }
  if (type === "walk")   { beep(ctx, 660, 0.15); setTimeout(() => beep(ctx, 440, 0.25), 160); }
  if (type === "start")  { [440, 660, 880].forEach((f, i) => setTimeout(() => beep(ctx, f, 0.15), i * 130)); }
  if (type === "finish") { [880, 1100, 1320, 1100, 1320].forEach((f, i) => setTimeout(() => beep(ctx, f, 0.18), i * 140)); }
  if (type === "tick")   { beep(ctx, 700, 0.07, 0.3); }
}

function fmt(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtKm(m) {
  return (m / 1000).toFixed(2);
}

function fmtPace(mPerSec) {
  if (!mPerSec || mPerSec < 0.5) return "--:--";
  const secPerKm = 1000 / mPerSec;
  return fmt(Math.round(secPerKm));
}

// Haversine distance between two GPS coords (returns meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildSegments(plan) {
  const segs = [{ type: "warmup", duration: WARMUP_SEC, label: "ROZGRZEWKA" }];
  for (let r = 0; r < plan.rounds; r++) {
    segs.push({ type: "run", duration: plan.runMin * 60, label: "BIEGNIJ", round: r + 1 });
    if (plan.walkMin > 0 && r < plan.rounds - 1)
      segs.push({ type: "walk", duration: plan.walkMin * 60, label: "MARSZ", round: r + 1 });
  }
  segs.push({ type: "cooldown", duration: COOLDOWN_SEC, label: "SCHŁADZANIE" });
  return segs;
}

function labelFontSize(label) {
  const len = label.length;
  if (len <= 5)  return "clamp(44px, 15vw, 76px)";
  if (len <= 8)  return "clamp(36px, 12vw, 64px)";
  if (len <= 10) return "clamp(28px, 9.5vw, 52px)";
  return                 "clamp(22px, 7.5vw, 42px)";
}

export default function App() {
  const [weekIdx, setWeekIdx] = useState(() =>
    parseInt(localStorage.getItem("lastWeekIdx") || "0")
  );
  const [phase, setPhase] = useState("idle");
  const [segIdx, setSegIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showPlan, setShowPlan] = useState(true);  // domyślnie pokazuj picker na idle
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenPlans, setHiddenPlans] = useState(() =>
    new Set(JSON.parse(localStorage.getItem("hiddenPlans") || "[]"))
  );

  // GPS state
  const [totalDist, setTotalDist] = useState(0);      // all meters
  const [runDist, setRunDist] = useState(0);           // only during run segments
  const [curSpeed, setCurSpeed] = useState(0);         // m/s
  const [gpsStatus, setGpsStatus] = useState("off");   // off | waiting | active | denied
  const [totalSteps, setTotalSteps] = useState(0);     // all steps during workout

  const audioRef = useRef(null);
  const segsRef = useRef([]);
  const segIdxRef = useRef(0);
  const timeLeftRef = useRef(0);
  const tickRef = useRef(null);
  const wakeLockRef = useRef(null);
  const geoWatchRef = useRef(null);
  const lastPosRef = useRef(null);
  const isRunSegRef = useRef(false);

  const plan = PLAN[weekIdx];

  const initAudio = () => {
    if (!audioRef.current)
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioRef.current.state === "suspended") audioRef.current.resume();
  };

  // Wake Lock
  const acquireWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (_) {}
    }
  };
  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  };

  // GPS watch
  const startGps = () => {
    if (!navigator.geolocation) return;
    setGpsStatus("waiting");
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        const { latitude: lat, longitude: lon, speed } = pos.coords;
        if (speed !== null && speed !== undefined) setCurSpeed(speed);
        if (lastPosRef.current) {
          const d = haversine(lastPosRef.current.lat, lastPosRef.current.lon, lat, lon);
          // Filter out GPS noise: ignore jumps > 50m in one update (~180km/h)
          if (d < 50) {
            setTotalDist(prev => prev + d);
            if (isRunSegRef.current) setRunDist(prev => prev + d);
            // Estimate steps from distance (avg step ≈ 0.7m)
            const steps = Math.round(d / 0.7);
            setTotalSteps(prev => prev + steps);
            // Smooth speed from distance if device doesn't provide it
            if (speed === null || speed === undefined) {
              const dt = (pos.timestamp - lastPosRef.current.ts) / 1000;
              if (dt > 0) setCurSpeed(d / dt);
            }
          }
        }
        lastPosRef.current = { lat, lon, ts: pos.timestamp };
      },
      (err) => {
        if (err.code === 1) setGpsStatus("denied");
        else setGpsStatus("off");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

  const stopGps = () => {
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
    lastPosRef.current = null;
    setGpsStatus("off");
  };

  const stop = useCallback(() => clearInterval(tickRef.current), []);

  const toggleHidden = (i) => {
    setHiddenPlans(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      localStorage.setItem("hiddenPlans", JSON.stringify([...next]));
      return next;
    });
  };

  const goToSeg = useCallback((segs, idx, ctx) => {
    segIdxRef.current = idx;
    setSegIdx(idx);
    const seg = segs[idx];
    timeLeftRef.current = seg.duration;
    setTimeLeft(seg.duration);
    isRunSegRef.current = seg.type === "run";
    if (seg.type === "run")  signal(ctx, "run");
    if (seg.type === "walk") signal(ctx, "walk");
    navigator.vibrate?.(600);  // długi impuls na zmianę
  }, []);

  const skipSeg = useCallback(() => {
    const segs = segsRef.current;
    const next = segIdxRef.current + 1;
    const ctx = audioRef.current;
    if (next >= segs.length) {
      clearInterval(tickRef.current);
      setPhase("done");
      signal(ctx, "finish");
      isRunSegRef.current = false;
      releaseWakeLock();
      stopGps();
      navigator.vibrate?.([300, 100, 300, 100, 500]);
    } else {
      goToSeg(segs, next, ctx);
    }
  }, [goToSeg, releaseWakeLock, stopGps]);

  const startTimer = useCallback(async () => {
    initAudio();
    const ctx = audioRef.current;
    const segs = buildSegments(plan);
    segsRef.current = segs;
    setTotalDist(0); setRunDist(0); setCurSpeed(0); setTotalSteps(0);
    signal(ctx, "start");
    setPhase("active");
    setElapsed(0);
    goToSeg(segs, 0, ctx);
    startGps();
    await acquireWakeLock();
  }, [plan, goToSeg]);

  useEffect(() => {
    if (phase !== "active") return;
    tickRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      setElapsed(e => e + 1);
      const ctx = audioRef.current;
      if (timeLeftRef.current <= 5 && timeLeftRef.current > 0) {
        signal(ctx, "tick");
        navigator.vibrate?.(80);  // krótki bzz co sekundę
      }
      if (timeLeftRef.current <= 0) {
        const segs = segsRef.current;
        const next = segIdxRef.current + 1;
        if (next >= segs.length) {
          clearInterval(tickRef.current);
          setPhase("done");
          signal(ctx, "finish");
          isRunSegRef.current = false;
          releaseWakeLock();
          stopGps();
          navigator.vibrate?.([300, 100, 300, 100, 500]);
        } else {
          goToSeg(segs, next, ctx);
        }
      }
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [phase, goToSeg]);

  const pause  = () => { stop(); setPhase("paused"); releaseWakeLock(); };
  const resume = async () => { initAudio(); setPhase("active"); await acquireWakeLock(); };
  const reset  = () => {
    stop(); stopGps(); releaseWakeLock();
    setPhase("idle"); setSegIdx(0); setTimeLeft(0); setElapsed(0);
    setTotalDist(0); setRunDist(0); setCurSpeed(0); setTotalSteps(0);
    isRunSegRef.current = false;
  };

  const segs = segsRef.current;
  const cur  = segs[segIdx] || { type: "idle", label: "", duration: 1 };
  const next = segs[segIdx + 1];
  const themeKey = phase === "done" ? "done" : phase === "idle" ? "idle" : cur.type;
  const t = THEME[themeKey] || THEME.idle;

  const segProgress   = cur.duration > 0 ? 1 - timeLeft / cur.duration : 0;
  const totalDurSegs  = segs.reduce((a, s) => a + s.duration, 0);
  const totalProgress = totalDurSegs > 0 ? Math.min(elapsed / totalDurSegs, 1) : 0;
  const runSegsTotal  = segs.filter(s => s.type === "run").length;
  const runSegsComplete = segs.slice(0, segIdx + 1).filter(s => s.type === "run").length;
  const isActive = phase === "active" || phase === "paused";

  // Avg pace over run segments only
  const runElapsed = segs.slice(0, segIdx + 1)
    .filter(s => s.type === "run")
    .reduce((a, s) => a + (s.duration - (cur.type === "run" ? timeLeft : 0)), 0);
  const avgPace = runDist > 10 && runElapsed > 0 ? runDist / runElapsed : 0;

  const gpsIcon = { off: "📍", waiting: "⌛", active: "🛰", denied: "⚠️" }[gpsStatus];
  const gpsLabel = { off: "GPS wyłączony", waiting: "Szukam sygnału…", active: "GPS aktywny", denied: "Brak zgody GPS" }[gpsStatus];

  return (
    <div style={{
      minHeight: "100vh", background: t.bg,
      display: "flex", flexDirection: "column",
      transition: "background 0.5s ease",
      fontFamily: "'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
      WebkitTapHighlightColor: "transparent",
      userSelect: "none",
      maxWidth: 430, margin: "0 auto",
      position: "relative", overflow: "hidden",
    }}>
      {isActive && (
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse at 50% 35%, ${t.glow} 0%, transparent 65%)`,
          transition: "background 0.5s ease", zIndex: 0,
        }} />
      )}

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>

        {/* Top bar */}
        <div style={{
          padding: "18px 20px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${t.accent}20`,
        }}>
          <span style={{ fontSize: 11, letterSpacing: 3, color: t.dim, textTransform: "uppercase", fontWeight: 700 }}>
            TYG {plan.week}
          </span>
          {!isActive && phase !== "done" && showHidden && (
            <button onClick={() => setShowHidden(false)} style={{
              background: "none", border: "none", color: t.dim, fontSize: 11,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", padding: 0,
            }}>
              ✕ POKAŻ AKTYWNE
            </button>
          )}
          {isActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: gpsStatus === "active" ? t.accent : t.dim, letterSpacing: 1 }}>
                {gpsIcon} {gpsStatus === "active" ? "GPS" : gpsLabel}
              </span>
              <span style={{ fontSize: 11, color: t.accent, letterSpacing: 2, opacity: 0.6 }}>
                {fmt(elapsed)} / {fmt(totalDurSegs)}
              </span>
            </div>
          )}
        </div>

        {/* Plan picker */}
        {!isActive && phase !== "done" && (
          <div style={{ padding: "14px 20px", flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 12, letterSpacing: 3, color: t.accent, marginBottom: 12, textTransform: "uppercase", fontWeight: 700 }}>
              Wybierz tydzień planu
            </div>
            {PLAN.map((p, i) => {
              const isHidden = hiddenPlans.has(i);
              const shouldShow = !isHidden || showHidden;
              return shouldShow ? (
                <button key={i} onClick={() => { setWeekIdx(i); localStorage.setItem("lastWeekIdx", i); }} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", padding: "12px 16px", marginBottom: 8, borderRadius: 10,
                  border: weekIdx === i && !isHidden ? `1.5px solid ${t.accent}` : "1.5px solid #1c1c1c",
                  background: weekIdx === i && !isHidden ? t.accent + "12" : "#0d0d0d",
                  cursor: "pointer", textAlign: "left",
                  opacity: isHidden ? 0.4 : 1,
                }}>
                  <div>
                    <div style={{ fontSize: 16, color: weekIdx === i && !isHidden ? t.accent : "#888", fontWeight: 700 }}>
                      Tydzień {p.week}
                    </div>
                    <div style={{ fontSize: 14, color: "#666", marginTop: 3 }}>{p.label}</div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 14, color: "#888", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(buildSegments(p).reduce((a, s) => a + s.duration, 0))}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleHidden(i); }} style={{
                      background: "none", border: "none", color: t.dim, fontSize: 16,
                      cursor: "pointer", padding: 0, display: "flex", alignItems: "center",
                    }}>
                      {isHidden ? "👁" : "✓"}
                    </button>
                  </div>
                </button>
              ) : null;
            })}
            {hiddenPlans.size > 0 && !showHidden && (
              <button onClick={() => setShowHidden(true)} style={{
                width: "100%", padding: "12px 16px", marginTop: 16,
                background: "#0d0d0d", border: "1px solid #1c1c1c",
                color: t.dim, fontSize: 12, borderRadius: 10,
                cursor: "pointer", textTransform: "uppercase", letterSpacing: 1,
              }}>
                Pokaż {hiddenPlans.size} ukończone{hiddenPlans.size !== 1 ? "" : ""}
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        {(!showPlan || isActive) && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "12px 20px",
          }}>

            {/* DONE */}
            {phase === "done" && (
              <div style={{ textAlign: "center", width: "100%" }}>
                <div style={{ fontSize: 56, marginBottom: 6 }}>🏅</div>
                <div style={{
                  fontSize: "clamp(28px, 9vw, 44px)", fontWeight: 900,
                  color: t.accent, letterSpacing: -1, marginBottom: 6,
                  textShadow: `0 0 20px ${t.glow}`,
                }}>BRAWO!</div>
                <div style={{ fontSize: 12, color: t.dim, letterSpacing: 2, marginBottom: 20 }}>TRENING UKOŃCZONY</div>

                {/* Summary stats */}
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "CZAS", value: fmt(elapsed) },
                    { label: "DYSTANS", value: `${fmtKm(totalDist)} km` },
                    { label: "KROKI", value: `${totalSteps}` },
                    { label: "BIEG", value: `${fmtKm(runDist)} km` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: "#0f0f0f", borderRadius: 10,
                      border: `1px solid ${t.accent}22`,
                      padding: "12px 14px", textAlign: "center", flex: 1,
                    }}>
                      <div style={{ fontSize: 9, color: t.dim, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 18, color: t.accent, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {runDist > 10 && (
                  <div style={{ fontSize: 12, color: t.dim, letterSpacing: 2, marginTop: 8 }}>
                    Śr. tempo biegu: {fmtPace(avgPace)} /km
                  </div>
                )}
              </div>
            )}

            {/* IDLE */}
            {phase === "idle" && (
              <div style={{ textAlign: "center", width: "100%" }}>
                <div style={{ fontSize: 12, color: "#333", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
                  {plan.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", marginBottom: 28 }}>
                  {buildSegments(plan).map((s, i) => {
                    const st = THEME[s.type] || THEME.idle;
                    return (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "8px 14px", borderRadius: 8,
                        background: "#0d0d0d",
                        borderLeft: `3px solid ${st.accent}`,
                      }}>
                        <span style={{ fontSize: 12, color: st.accent, fontWeight: 700, letterSpacing: 1 }}>
                          {s.label}{s.round ? ` #${s.round}` : ""}
                        </span>
                        <span style={{ fontSize: 12, color: "#333", fontVariantNumeric: "tabular-nums" }}>{fmt(s.duration)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: "#222", letterSpacing: 2 }}>
                  📍 GPS uruchomi się automatycznie po starcie
                </div>
              </div>
            )}

            {/* ACTIVE / PAUSED */}
            {(phase === "active" || phase === "paused") && (
              <>
                {/* Phase label */}
                <div style={{
                  fontSize: labelFontSize(cur.label),
                  fontWeight: 900, letterSpacing: "-0.03em",
                  color: t.label, lineHeight: 1, marginBottom: 4,
                  textAlign: "center", whiteSpace: "nowrap",
                  textShadow: `0 0 20px ${t.glow}, 0 0 40px ${t.glow}`,
                  transition: "color 0.4s, text-shadow 0.4s",
                }}>
                  {cur.label}
                </div>

                {runSegsTotal > 1 && (
                  <div style={{ fontSize: 11, color: t.dim, letterSpacing: 3, marginBottom: 10, fontWeight: 700 }}>
                    RUNDA {cur.type === "run" ? cur.round : runSegsComplete}/{runSegsTotal}
                  </div>
                )}

                {/* Big timer */}
                <div style={{
                  fontSize: "clamp(68px, 22vw, 96px)",
                  fontWeight: 700, letterSpacing: "-0.04em",
                  color: t.timer, lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  marginBottom: 16,
                  textShadow: `0 0 20px ${t.glow}, 0 0 40px ${t.glow}`,
                  opacity: timeLeft <= 3 ? (timeLeft % 2 === 0 ? 1 : 0.3) : 1,
                  transition: timeLeft <= 3 ? "opacity 0.25s" : "none",
                }}>
                  {fmt(timeLeft)}
                </div>

                {/* Stats row — always show when active */}
                {(phase === "active" || phase === "paused") && (
                  <div style={{
                    display: "flex", gap: 10, marginBottom: 14, width: "100%", maxWidth: 320,
                  }}>
                    {[
                      { label: "DYSTANS", value: `${fmtKm(totalDist)} km` },
                      { label: "KROKI", value: `${totalSteps}` },
                      ...(gpsStatus === "active" ? [{ label: "TEMPO", value: `${fmtPace(curSpeed)}/km` }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        flex: 1, textAlign: "center",
                        background: t.dim + "15",
                        border: `1px solid ${t.dim}30`,
                        borderRadius: 8, padding: "8px 4px",
                      }}>
                        <div style={{ fontSize: 8, color: t.dim, letterSpacing: 2, marginBottom: 3 }}>{label}</div>
                        <div style={{
                          fontSize: 14, color: t.accent, fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          textShadow: `0 0 10px ${t.glow}`,
                        }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* GPS waiting indicator */}
                {(gpsStatus === "waiting" || gpsStatus === "denied") && (
                  <div style={{
                    fontSize: 10, color: t.dim, letterSpacing: 2,
                    marginBottom: 14, opacity: 0.7,
                  }}>
                    {gpsStatus === "waiting" ? "⌛ Szukam sygnału GPS…" : "⚠️ Brak dostępu do GPS"}
                  </div>
                )}

                {/* Segment progress */}
                <div style={{ width: "100%", maxWidth: 300, marginBottom: 20 }}>
                  <div style={{ height: 5, background: t.dim + "33", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${segProgress * 100}%`,
                      background: t.accent, borderRadius: 3,
                      boxShadow: `0 0 8px ${t.accent}`,
                      transition: "width 0.9s linear",
                    }} />
                  </div>
                </div>

                {/* Next up */}
                {next && (
                  <div style={{
                    padding: "9px 18px", borderRadius: 10,
                    background: t.dim + "18", border: `1px solid ${t.dim}33`,
                    textAlign: "center", marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 10, color: t.dim, letterSpacing: 3, textTransform: "uppercase" }}>Następnie </span>
                    <span style={{ fontSize: 13, color: THEME[next.type]?.accent || t.dim, fontWeight: 700, letterSpacing: 1 }}>
                      {next.label}
                    </span>
                    <span style={{ fontSize: 11, color: t.dim }}> · {fmt(next.duration)}</span>
                  </div>
                )}

                {/* Overall progress */}
                <div style={{ width: "100%", maxWidth: 300 }}>
                  <div style={{ height: 2, background: "#181818", borderRadius: 1 }}>
                    <div style={{
                      height: "100%", width: `${totalProgress * 100}%`,
                      background: t.dim + "88", borderRadius: 1, transition: "width 1s linear",
                    }} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{
          padding: "14px 24px 44px",
          display: "flex", justifyContent: "center", alignItems: "center", gap: 20,
        }}>
          {phase === "idle" && (
            <button onClick={startTimer} style={{
              width: 76, height: 76, borderRadius: "50%",
              background: t.accent, border: "none", color: "#000",
              fontSize: 28, cursor: "pointer", fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 24px ${t.accent}, 0 0 48px ${t.glow}`,
            }}>▶</button>
          )}
          {phase === "active" && (
            <>
              <button onClick={pause} style={{
                width: 76, height: 76, borderRadius: "50%",
                background: "#111", border: "2px solid #222",
                color: "#555", fontSize: 26, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>⏸</button>
              <button onClick={skipSeg} style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "transparent", border: "1px solid #1a1a1a",
                color: "#2a2a2a", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>⏭</button>
              <button onClick={reset} style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "transparent", border: "1px solid #1a1a1a",
                color: "#2a2a2a", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>↺</button>
            </>
          )}
          {phase === "paused" && (
            <>
              <button onClick={resume} style={{
                width: 76, height: 76, borderRadius: "50%",
                background: t.accent, border: "none", color: "#000",
                fontSize: 28, cursor: "pointer", fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 24px ${t.accent}, 0 0 48px ${t.glow}`,
              }}>▶</button>
              <button onClick={reset} style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "transparent", border: "1px solid #1a1a1a",
                color: "#2a2a2a", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>↺</button>
            </>
          )}
          {phase === "done" && (
            <button onClick={reset} style={{
              padding: "15px 44px", borderRadius: 50,
              background: t.accent, border: "none", color: "#000",
              fontSize: 13, fontWeight: 800, letterSpacing: 2,
              textTransform: "uppercase", cursor: "pointer",
              boxShadow: `0 0 24px ${t.accent}`,
            }}>NOWY TRENING</button>
          )}
        </div>
      </div>
    </div>
  );
}
