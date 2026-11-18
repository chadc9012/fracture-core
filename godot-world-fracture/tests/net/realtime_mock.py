#!/usr/bin/env python3
"""A local stand-in for Supabase Realtime (the Phoenix channel protocol subset realtime.gd speaks), for the online tests.
   python3 tests/net/realtime_mock.py [port]     (pip install websockets)
Joins reply ok and send the room's presence_state; presence track sends presence_diff joins to the room; broadcasts fan
out to the room's other sockets; a socket closing sends presence_diff leaves; heartbeats reply ok."""
import asyncio, json, sys
import websockets

rooms = {}      # topic -> {ws: (key, meta)}

async def send(ws, topic, event, payload, ref=None, join_ref=None):
    try:
        await ws.send(json.dumps({"topic": topic, "event": event, "payload": payload, "ref": ref, "join_ref": join_ref}))
    except Exception:
        pass

def state(topic, skip=None):
    out = {}
    for w, (k, meta) in rooms.get(topic, {}).items():
        if meta is not None and w is not skip:
            out[k] = {"metas": [dict(meta, phx_ref="r")]}
    return out

async def handler(ws):
    joined = {}
    try:
        async for txt in ws:
            m = json.loads(txt)
            t, ev, p = m.get("topic"), m.get("event"), m.get("payload") or {}
            if t == "phoenix":
                await send(ws, "phoenix", "phx_reply", {"status": "ok", "response": {}}, m.get("ref"))
            elif ev == "phx_join":
                key = p.get("config", {}).get("presence", {}).get("key", "")
                rooms.setdefault(t, {})[ws] = (key, None)
                joined[t] = key
                await send(ws, t, "phx_reply", {"status": "ok", "response": {}}, m.get("ref"), m.get("join_ref"))
                await send(ws, t, "presence_state", state(t))
            elif ev == "phx_leave":
                await leave(ws, t)
                joined.pop(t, None)
            elif ev == "presence":
                key = rooms[t][ws][0]
                rooms[t][ws] = (key, p.get("payload", {}))
                for w in list(rooms[t]):
                    await send(w, t, "presence_diff", {"joins": {key: {"metas": [p.get("payload", {})]}}, "leaves": {}})
            elif ev == "broadcast":
                for w in list(rooms.get(t, {})):
                    if w is not ws:
                        await send(w, t, "broadcast", p)
    except Exception:
        pass
    finally:
        for t in list(joined):
            await leave(ws, t)

async def leave(ws, t):
    r = rooms.get(t, {})
    if ws in r:
        key, meta = r.pop(ws)
        for w in list(r):
            await send(w, t, "presence_diff", {"joins": {}, "leaves": {key: {"metas": [meta or {}]}}})

async def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4501
    async with websockets.serve(handler, "127.0.0.1", port):
        print("mock realtime on", port, flush=True)
        await asyncio.Future()

asyncio.run(main())
