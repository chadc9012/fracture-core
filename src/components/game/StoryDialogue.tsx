import { useCallback, useEffect, useRef, useState } from "react";
import { choose, enterNode, visibleChoices, type DialogueGraph, type StoryState } from "@/game/story";
import { useVoiceLine } from "./useVoiceLine";

/** Branching dialogue for the story scenarios (story.ts graphs). Never blocks play: the world keeps running behind it, Esc / pad B
 * skips (a skipped conversation applies nothing and can be reopened), and every effect is applied through the pure reducers so a
 * choice always changes real state. Keyboard: E/Enter/Space advance or confirm, W/S/arrows or 1-3 pick. Pad: A confirm, B skip, D-pad/stick pick. */
export function StoryDialogue({ graph, story, onStory, onDone }: { graph: DialogueGraph; story: StoryState; onStory: (s: StoryState) => void; onDone: (completed: boolean, story: StoryState) => void }) {
  const storyRef = useRef(story);
  const onStoryRef = useRef(onStory); onStoryRef.current = onStory;
  const [nodeId, setNodeId] = useState(graph.start);
  const [shown, setShown] = useState(0);
  const [sel, setSel] = useState(0);
  const entered = enterNode(storyRef.current, graph, nodeId);
  const node = entered?.node;
  const choices = node ? visibleChoices(entered!.story, node) : [];

  // apply the node's entry effects exactly once per visit (they are also once-keyed inside the reducer)
  useEffect(() => { const e = enterNode(storyRef.current, graph, nodeId); if (e && e.story !== storyRef.current) { storyRef.current = e.story; onStoryRef.current(e.story); } setShown(0); setSel(0); }, [nodeId, graph]);
  useVoiceLine(`story-${graph.id}-${nodeId}`, node?.speaker ?? "NPC", node?.text, "story");
  useEffect(() => {
    if (!node || shown >= node.text.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 20);
    return () => clearTimeout(t);
  }, [shown, node]);

  const confirm = useCallback(() => {
    if (!node) { onDone(false, storyRef.current); return; }
    if (shown < node.text.length) { setShown(node.text.length); return; }
    if (choices.length) {
      const c = choices[Math.min(sel, choices.length - 1)]!;
      const r = choose(storyRef.current, graph, node.id, c.id);
      if (!r.ok) return;
      storyRef.current = r.story; onStoryRef.current(r.story);
      if (r.next) setNodeId(r.next); else onDone(true, storyRef.current);
      return;
    }
    if (node.next) setNodeId(node.next); else onDone(true, storyRef.current);
  }, [node, shown, choices, sel, graph, onDone]);
  const move = useCallback((d: number) => setSel((i) => (choices.length ? (i + d + choices.length) % choices.length : 0)), [choices.length]);
  const skip = useCallback(() => onDone(false, storyRef.current), [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { skip(); return; }
      if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") { e.preventDefault(); confirm(); return; }
      if (e.code === "ArrowUp" || e.code === "KeyW") { move(-1); return; }
      if (e.code === "ArrowDown" || e.code === "KeyS") { move(1); return; }
      const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (n && choices.length >= Number(n[1])) setSel(Number(n[1]) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, move, skip, choices.length]);

  // standard-mapping gamepad, edge-triggered
  useEffect(() => {
    let raf = 0; let prev = { a: false, b: false, up: false, down: false };
    const tick = () => {
      const pad = typeof navigator !== "undefined" && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.mapping === "standard") : null;
      if (pad) {
        const cur = { a: !!pad.buttons[0]?.pressed, b: !!pad.buttons[1]?.pressed, up: !!pad.buttons[12]?.pressed || (pad.axes[1] ?? 0) < -0.6, down: !!pad.buttons[13]?.pressed || (pad.axes[1] ?? 0) > 0.6 };
        if (cur.a && !prev.a) confirm();
        if (cur.b && !prev.b) skip();
        if (cur.up && !prev.up) move(-1);
        if (cur.down && !prev.down) move(1);
        prev = cur;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [confirm, move, skip]);

  if (!node) return null;
  const done = shown >= node.text.length;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-30 mx-auto w-[min(92vw,560px)] border border-border bg-background/90 p-4" role="dialog" aria-label="Story dialogue">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">{node.speaker}</p>
      <p className="mt-1 min-h-10 text-sm text-foreground">{node.text.slice(0, shown)}</p>
      {done && choices.length > 0 && (
        <ul className="mt-2 space-y-1">
          {choices.map((c, i) => (
            <li key={c.id} className={`text-sm ${i === sel ? "text-primary" : "text-muted-foreground"}`}>{i === sel ? "▸ " : "  "}{i + 1}. {c.text}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {!done ? "E / A to skip text" : choices.length ? "W/S or 1-3 to pick · E / A to choose" : node.next ? "E / A to continue" : "E / A to close"} · Esc / B to leave
      </p>
    </div>
  );
}
