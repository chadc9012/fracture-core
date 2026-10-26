import { Canvas } from "@react-three/fiber";
import { Armchair, FastForward, Gauge, Monitor, Plane, Ship } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { boardingProgress, journeyPhase, journeyProgress, phaseLabel, serviceNumber, type JourneyKind } from "@/game/flight-journey";
import {
  ENTERTAINMENT_CHANNELS, SEAT_THEMES, assignedSeat, boardedCount, boardingLabel, cabinManifest, clampCabinPoint, clampRecline, entertainmentLabel, lightingFor,
  makeSeats, pickSeat, seatEye, seatScreenColor, styleFor, type CabinMode, type EntertainmentChannel, type SeatStyle,
} from "@/game/passenger-cabin";
import { JET_LIGHTS, PHANTOM_JET, clampJetPosition, flightReadout, type JetLighting } from "@/game/phantom-jet";
import { AirlinerCabin, CabinWalker, PHANTOM_SEAT_EYE, PhantomCabin, newCabinInput, phantomRoomLabel, type CabinInput, type SkyKind } from "./CabinScenes";
import type { DeployTarget } from "./StarMap";

/** A trip in progress (GameCanvas): which cabin, where to, and the clock. The cabin shows until the trip ends or you skip;
 * then GameCanvas runs the ordinary transit (startTransit) to `target`. */
export type FlightRide = {
  kind: JourneyKind; target: DeployTarget; fromId: string; toId: string; fromName: string; toName: string;
  seatStyle: SeatStyle; durationS: number; startedAt: number; cabinLight: JetLighting; cleanliness: number;
  dayPhase: "day" | "dusk" | "night"; headingDeg: number;
};

/** keys the cabin takes while it is open (so the operator in the world doesn't walk, shoot or open menus) */
const CAPTURED = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "KeyE", "Space", "KeyF", "KeyR", "KeyQ", "Tab", "KeyM", "KeyI", "KeyY", "KeyG", "Escape", "Enter"]);

/**
 * The cabin you ride in during a trip, over the world (which keeps running underneath, covered): an airliner cabin in the
 * ticket's seat style for scheduled flights, a ferry passenger deck for ferries, and the Phantom's private cabin for your
 * own jet. Walk the aisle (WASD, drag or arrows to look), take your seat (E), recline, switch on the seat-back screen;
 * in the Phantom, the flight-deck readout shows the trip. Skip (Enter / Esc) goes straight to arrival.
 */
export function FlightCabinOverlay({ ride, onArrive }: { ride: FlightRide; onArrive: () => void }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const t = window.setInterval(() => setNow(performance.now()), 200); return () => window.clearInterval(t); }, []);
  const elapsed = (now - ride.startedAt) / 1000;
  const phase = journeyPhase(elapsed, ride.durationS), progress = journeyProgress(elapsed, ride.durationS);
  const arrived = useRef(false);
  const arrive = () => { if (arrived.current) return; arrived.current = true; onArrive(); };
  const arriveRef = useRef(arrive); arriveRef.current = arrive;
  useEffect(() => { if (phase === "complete") arriveRef.current(); }, [phase]);

  const phantom = ride.kind === "phantom", mode: CabinMode = ride.kind === "ferry" ? "sea" : "air";
  const style = styleFor(mode, ride.seatStyle);
  const seats = useMemo(() => makeSeats(mode, style), [mode, style]);
  const service = serviceNumber(ride.kind, ride.fromId, ride.toId);
  const manifest = useMemo(() => cabinManifest(seats, service), [seats, service]);
  const [seatId, setSeatId] = useState<string | null>(() => assignedSeat(seats, manifest)?.id ?? null);
  const [seated, setSeated] = useState(false);
  const [recline, setRecline] = useState(0);
  const [screenOn, setScreenOn] = useState(false);
  const [channel, setChannel] = useState<EntertainmentChannel>("route");
  const [room, setRoom] = useState(phantomRoomLabel(PHANTOM_JET.zones[0]!.centerZ));
  const [notice, setNotice] = useState("");
  const boarded = manifest.slice(0, boardedCount(manifest.length, boardingProgress(elapsed, ride.durationS)));
  const seat = seats.find((s) => s.id === seatId) ?? null;

  const input = useRef<CabinInput>(newCabinInput());
  const seatedRef = useRef(seated); seatedRef.current = seated;
  const toggleSit = () => { if (!phantom && !seat) return; setSeated((v) => !v); if (seatedRef.current) { setScreenOn(false); setRecline(0); } };
  const sitRef = useRef(toggleSit); sitRef.current = toggleSit;
  useEffect(() => {
    const inp = input.current;
    const down = (e: KeyboardEvent) => {
      if (!CAPTURED.has(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === "KeyE" || e.code === "Space") sitRef.current();
      else if (e.code === "Enter" || e.code === "Escape") arriveRef.current();
      else inp.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => inp.keys.delete(e.code); // never swallowed: the world must see every key come back up
    const blur = () => inp.keys.clear();
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    if (document.pointerLockElement) document.exitPointerLock();
    return () => { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); window.removeEventListener("blur", blur); };
  }, []);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const inp = input.current;
    inp.yaw += (e.clientX - drag.current.x) * 0.005;
    inp.pitch = Math.max(-1.1, Math.min(0.9, inp.pitch - (e.clientY - drag.current.y) * 0.004));
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => { drag.current = null; };

  // the view and the lights follow the trip
  const outside: SkyKind = phase === "boarding" || phase === "complete" ? "apron" : ride.dayPhase === "night" ? "night" : ride.dayPhase === "dusk" ? "dusk" : "day";
  const moving = phase === "departing" || phase === "enroute" || phase === "arriving";
  const readout = flightReadout(progress, ride.headingDeg, ride.durationS);
  const eta = Math.max(0, Math.ceil(ride.durationS - elapsed));
  const start = phantom ? { x: 0, z: PHANTOM_JET.zones[0]!.centerZ + 1.5 } : { x: 0, z: (seat?.z ?? 0) + 1.2 };
  const clamp = phantom ? (p: { x: number; z: number }) => clampJetPosition(p.x, p.z) : (p: { x: number; z: number }) => clampCabinPoint(p, mode);
  const eye = !seated ? null : phantom ? PHANTOM_SEAT_EYE : seat ? seatEye(seat, recline) : null;
  useEffect(() => { if (seated) input.current.yaw = phantom ? Math.PI / 2 : 0; }, [seated, phantom]);
  const choose = (id: string) => { const r = pickSeat(seats, manifest, id); if (r.ok) { setSeatId(r.seatId); setSeated(false); setNotice(""); } else setNotice(r.reason); };
  const Icon = mode === "sea" ? Ship : Plane;
  const freeSeats = seats.filter((s) => !manifest.includes(s.id));
  const perSide = seats.filter((s) => s.row === 1 && s.side === "L").length;

  return (
    <div className="fixed inset-0 z-[85] select-none bg-black" role="dialog" aria-label={phantom ? "Phantom Stealth Jet cabin" : mode === "sea" ? "Ferry cabin" : "Aircraft cabin"}>
      <div className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "low-power" }} camera={{ fov: 72, near: 0.04, far: 80, position: [0, 1.62, start.z] }}>
          {phantom
            ? <PhantomCabin lighting={ride.cabinLight} sky={outside} moving={moving} clutter={Math.max(0, (60 - ride.cleanliness) / 60)} />
            : <AirlinerCabin mode={mode} style={style} seats={seats} passengers={boarded} mySeat={seatId} recline={recline} screen={screenOn && seated ? seatScreenColor(channel) : null} lighting={lightingFor(phase, ride.dayPhase)} sky={outside} moving={moving} />}
          <CabinWalker input={input} start={start} clamp={clamp} seated={eye} onMove={phantom ? (p) => { const r = phantomRoomLabel(p.z); setRoom((cur) => (cur === r ? cur : r)); } : undefined} />
        </Canvas>
      </div>

      {/* trip header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4 pb-10">
        <div className="mx-auto flex max-w-3xl items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary"><Icon className="mr-1 inline size-3" />{phantom ? "Phantom Stealth Jet · private flight" : `${service} · ${SEAT_THEMES[style].label}`}</p>
            <h3 className="mt-1 truncate text-base font-semibold uppercase tracking-wider text-white">{ride.fromName} → {ride.toName}</h3>
          </div>
          <div className="shrink-0 text-right font-mono text-[11px] uppercase tracking-wider text-white/80">
            <p>{phaseLabel(ride.kind, phase)}</p>
            <p className="text-white/50">{phase === "boarding" && !phantom ? `${boardingLabel(boardingProgress(elapsed, ride.durationS))} · ` : ""}Arrival in {eta}s</p>
          </div>
        </div>
        <div className="mx-auto mt-2 h-1 max-w-3xl overflow-hidden bg-white/15"><div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      </div>

      {/* Phantom: the flight deck readout */}
      {phantom && (
        <div className="pointer-events-none absolute right-4 top-24 w-52 border border-white/15 bg-black/70 p-3 font-mono text-[11px] text-white/85">
          <p className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.3em] text-primary"><Gauge className="size-3" /> Flight deck</p>
          <p className="flex justify-between"><span>Phase</span><span>{readout.phase}</span></p>
          <p className="flex justify-between"><span>Speed</span><span>{readout.speedKph} km/h</span></p>
          <p className="flex justify-between"><span>Mach</span><span>{readout.mach.toFixed(2)}</span></p>
          <p className="flex justify-between"><span>Altitude</span><span>{readout.altitudeM.toLocaleString("en-US")} m</span></p>
          <p className="flex justify-between"><span>Heading</span><span>{String(readout.headingDeg).padStart(3, "0")}°</span></p>
          <p className="flex justify-between"><span>Autopilot</span><span>{readout.autopilot ? "ON" : "OFF"}</span></p>
          <p className="mt-2 border-t border-white/10 pt-1 text-white/60">{room} · {JET_LIGHTS[ride.cabinLight].label} lighting</p>
        </div>
      )}

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/85">
            {!phantom && (
              <label className="flex items-center gap-1">Seat
                <select aria-label="Choose your seat" value={seatId ?? ""} onChange={(e) => choose(e.target.value)} className="border border-white/20 bg-black/70 px-1.5 py-1 text-white">
                  {freeSeats.map((s) => <option key={s.id} value={s.id}>{s.id}{s.k === 0 ? " · aisle" : s.k === perSide - 1 ? " · window" : ""}</option>)}
                </select>
              </label>
            )}
            <Button size="sm" variant="outline" onClick={toggleSit} disabled={!phantom && !seat}><Armchair className="size-3.5" /> {seated ? "Stand up" : phantom ? "Sit on the sofa" : "Take your seat"} [E]</Button>
            {seated && !phantom && (
              <>
                <label className="flex items-center gap-1">Recline {recline}°
                  <input aria-label="Seat recline" type="range" min={0} max={clampRecline(style, 180)} value={recline} onChange={(e) => setRecline(clampRecline(style, Number(e.target.value)))} />
                </label>
                <Button size="sm" variant="outline" onClick={() => setScreenOn((v) => !v)}><Monitor className="size-3.5" /> {screenOn ? "Screen off" : "Screen on"}</Button>
                {screenOn && (
                  <select aria-label="Entertainment channel" value={channel} onChange={(e) => setChannel(e.target.value as EntertainmentChannel)} className="border border-white/20 bg-black/70 px-1.5 py-1 text-white">
                    {ENTERTAINMENT_CHANNELS.map((c) => <option key={c} value={c}>{entertainmentLabel(c)}</option>)}
                  </select>
                )}
              </>
            )}
            {notice && <span role="alert" className="text-amber-300">{notice}</span>}
          </div>
          <Button size="sm" onClick={arrive}><FastForward className="size-3.5" /> Skip to arrival [Enter]</Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl font-mono text-[10px] uppercase tracking-wider text-white/45">WASD walk · drag or ←→ to look · E sit / stand{phantom ? ` · ${PHANTOM_JET.zones.map((z) => z.id).join(" · ")}` : ""}</p>
      </div>
    </div>
  );
}
