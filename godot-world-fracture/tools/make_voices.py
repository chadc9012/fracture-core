#!/usr/bin/env python3
"""World Fracture's voice bank: every line in data/dialogue/*.json, voiced.

Sources: the owner's campaign dialogue draft (campaign_draft1.json, 257 lines, stable ids) and Mission 01's opening
(m01_opening.json: the owner's cinematic script, ten lines of it recorded by the owner, plus the lines that join it to
the game). Lines with a `provided` recording use it (from assets-src/voices-provided); everything else is voiced with
Piper (local neural TTS, voices from github.com/rhasspy/piper v0.0.2), one cast voice per speaker, then given the
speaker's treatment with ffmpeg (NOVA's synthetic shimmer, the building PA, phone and radio speakers, Vyrak's depth).

PLAYER lines are voiced three times (_m, _f, _r) so they match the body the player built.

Writes audio/voices/lines/<id>.ogg and data/dialogue/voices.json:
  { "lines": { id: { "speaker", "text", "dur", "variants": [..] } }, "by_text": { "SPEAKER|text": id } }

Usage: python3 tools/make_voices.py <piper voices dir> [--force] [--only ID_PREFIX]
Re-running skips lines whose .ogg exists (unless --force).
"""
import json, os, re, subprocess, sys, tempfile, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROVIDED = os.path.join(os.path.dirname(ROOT), "assets-src", "voices-provided")
OUT = os.path.join(ROOT, "audio", "voices", "lines")

LT = "en-us-libritts-high"
# speaker -> (model, libritts speaker id or None, treatment)
CAST = {
    "NOVA": (LT, 555, "nova"),
    "PLAYER_m": (LT, 90, "plain"),
    "PLAYER_f": (LT, 195, "plain"),
    "PLAYER_r": (LT, 90, "robot"),
    "NEWS": (LT, 15, "tv"),
    "RADIO": (LT, 330, "radio"),
    "MOM": (LT, 255, "phone"),
    "MARA": (LT, 525, "plain"),
    "NEXUS ALERT": ("en-us-amy-low", None, "phone"),
    "BUILDING": ("en-gb-alan-low", None, "pa"),
    "RESIDENT": (LT, 45, "shout"),
    "CIVILIAN": (LT, 0, "plain"),
    "CHILD": (LT, 60, "child"),
    "SURVIVOR": (LT, 45, "plain"),
    "CAPTAIN VALE": (LT, 615, "plain"),
    "VYRAK": (LT, 720, "vyrak"),
    "FIXER SABLE": (LT, 840, "plain"),
    "PILOT NERI": (LT, 180, "comms"),
    "WARDEN ILYA": (LT, 435, "plain"),
    "SCOUT MIRA": (LT, 765, "plain"),
    "MECHANIC ROOK": (LT, 135, "plain"),
    "ARCHIVIST SEN": (LT, 705, "plain"),
    "MARSHAL DRAEV": (LT, 720, "deep"),
    "WANDERER": (LT, 885, "plain"),
    "RANGER KEST": (LT, 375, "plain"),
    "CROWNKEEPER": (LT, 870, "crown"),
    "FRACTURE VOICE": (LT, 300, "fracture"),
    "RACER": (LT, 570, "plain"),
    "TRADER": (LT, 225, "plain"),
    "PEDESTRIAN": (LT, 105, "plain"),
    "SHOPKEEPER": (LT, 120, "plain"),
    "MECHANIC": (LT, 540, "plain"),
    "DIVER": (LT, 690, "comms"),
    "TRAVELER": (LT, 450, "plain"),
    "SOLDIER": (LT, 405, "comms"),
    "ELLIS": (LT, 600, "plain"),
}
FALLBACK = (LT, 885, "plain")

# ffmpeg -af chains per treatment (the input is mono 22.05 kHz)
FX = {
    "plain": "highpass=f=70,acompressor=threshold=-18dB:ratio=2.5:attack=5:release=80",
    # calm, synthetic: a hair of pitch-locked chorus, a short metallic slap, airy top, vibrato kept tiny
    "nova": "highpass=f=120,chorus=0.55:0.85:22|31:0.32|0.24:0.3|0.45:1.6|2.2,aecho=0.8:0.6:14|29:0.16|0.1,"
            "treble=g=3:f=6500,vibrato=f=5.5:d=0.04,acompressor=threshold=-20dB:ratio=3:attack=4:release=60",
    "robot": "afftfilt=real='hypot(re,im)*cos(0)':imag='0':win_size=512:overlap=0.75,chorus=0.6:0.8:18:0.4:0.3:2,"
             "highpass=f=100,acompressor=threshold=-18dB:ratio=3",
    "tv": "highpass=f=160,lowpass=f=7000,equalizer=f=2500:t=q:w=1:g=3,acompressor=threshold=-20dB:ratio=3",
    "radio": "highpass=f=250,lowpass=f=5000,equalizer=f=1800:t=q:w=1:g=4,acompressor=threshold=-22dB:ratio=4",
    "phone": "highpass=f=320,lowpass=f=3400,acrusher=bits=10:mode=log:aa=1:mix=0.35,acompressor=threshold=-20dB:ratio=4",
    "comms": "highpass=f=280,lowpass=f=4200,acrusher=bits=11:mode=log:aa=1:mix=0.25,acompressor=threshold=-20dB:ratio=3",
    "pa": "highpass=f=400,lowpass=f=3500,acrusher=bits=9:mode=log:aa=1:mix=0.3,aecho=0.8:0.7:180|360:0.35|0.2,"
          "acompressor=threshold=-20dB:ratio=4",
    "shout": "highpass=f=120,volume=1.4,aecho=0.7:0.5:60:0.2,acompressor=threshold=-14dB:ratio=5",
    "child": "asetrate=22050*1.22,aresample=22050,atempo=0.84,highpass=f=150",
    "vyrak": "asetrate=22050*0.8,aresample=22050,atempo=1.12,lowpass=f=6000,aecho=0.8:0.75:90|170:0.3|0.2,"
             "bass=g=5:f=120,acompressor=threshold=-18dB:ratio=3",
    "deep": "asetrate=22050*0.9,aresample=22050,atempo=1.08,bass=g=3:f=120",
    "crown": "asetrate=22050*0.86,aresample=22050,atempo=1.1,aecho=0.8:0.8:300|600:0.3|0.18",
    "fracture": "asetrate=22050*0.75,aresample=22050,atempo=1.2,aecho=0.6:0.9:40|90|200:0.5|0.4|0.3,"
                "chorus=0.5:0.9:50|70:0.4|0.32:0.25|0.4:2|1.3,highpass=f=90",
}
# the owner's recorded lines get a lighter touch: NOVA still gets her shimmer, the news its set speaker
PROVIDED_FX = {"NOVA": FX["nova"], "NEWS": FX["tv"], "PLAYER": "highpass=f=70"}


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def load_lines():
    lines = []
    d = json.load(open(os.path.join(ROOT, "data", "dialogue", "m01_opening.json")))
    for l in d["lines"]:
        lines.append(l)
    c = json.load(open(os.path.join(ROOT, "data", "dialogue", "campaign_draft1.json")))
    for l in c["lines"]:
        lines.append({"id": l["id"], "speaker": l["speaker"], "text": l["text"]})
    return lines


_voices = {}


def piper(model_dir, model, speaker, text, out_wav):
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    if model not in _voices:
        _voices[model] = PiperVoice.load(os.path.join(model_dir, model, model + ".onnx"))
    v = _voices[model]
    cfg = SynthesisConfig(speaker_id=speaker, length_scale=1.0, noise_scale=0.6, noise_w_scale=0.75)
    with wave.open(out_wav, "wb") as w:
        v.synthesize_wav(text, w, syn_config=cfg)


def ffmpeg(src, out, af):
    # 0.12 s of air before and after, the treatment, then evened out in two passes: measure the speech's mean level,
    # gain it to -19 dB mean, and a limiter keeps the peaks under -1.5 dB (loudnorm pumps on clips under three seconds)
    tmp = out + ".tmp.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-af", "adelay=120|120,apad=pad_dur=0.12," + af + ",aresample=22050",
                    tmp], check=True)
    r = subprocess.run(["ffmpeg", "-i", tmp, "-af", "silenceremove=stop_periods=-1:stop_threshold=-45dB,volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"mean_volume: (-?[0-9.]+) dB", r.stderr)
    gain = -19.0 - float(m.group(1)) if m else 0.0
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "volume=%.2fdB,alimiter=limit=0.84:attack=3:release=40" % gain,
                    "-c:a", "libvorbis", "-q:a", "3", out], check=True)
    os.remove(tmp)


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return round(float(r.stdout.strip() or 0), 2)


def speakable(text):
    # stage directions in parentheses are not read out; Vyrak's capitals read as words
    t = re.sub(r"\([^)]*\)", "", text).strip()
    return t.capitalize() if t.isupper() else t


def main():
    model_dir = sys.argv[1]
    force = "--force" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else ""
    os.makedirs(OUT, exist_ok=True)
    idx_path = os.path.join(ROOT, "data", "dialogue", "voices.json")
    index = {"lines": {}, "by_text": {}}
    tmp = tempfile.mkdtemp()
    for l in load_lines():
        lid, sp, text = l["id"], l["speaker"], l["text"]
        if not sp:
            continue
        variants = ["_m", "_f", "_r"] if sp == "PLAYER" else [""]
        made = []
        for var in variants:
            out = os.path.join(OUT, lid + var + ".ogg")
            key = sp + var if sp == "PLAYER" else sp
            if (force or not os.path.exists(out)) and (not only or lid.startswith(only)):
                prov = l.get("provided")
                if prov and var in ("", "_m"):
                    ffmpeg(os.path.join(PROVIDED, prov), out, PROVIDED_FX.get(sp, "highpass=f=70"))
                elif prov and var == "_r":
                    ffmpeg(os.path.join(PROVIDED, prov), out, FX["robot"])
                else:
                    model, spk, fx = CAST.get(key, FALLBACK)
                    wav = os.path.join(tmp, "x.wav")
                    piper(model_dir, model, spk, speakable(text), wav)
                    ffmpeg(wav, out, FX[fx])
                print("voiced", lid + var, flush=True)
            if os.path.exists(out):
                made.append(var)
        if made:
            first = os.path.join(OUT, lid + made[0] + ".ogg")
            index["lines"][lid] = {"speaker": sp, "text": text, "dur": duration(first), "variants": made}
            index["by_text"].setdefault(sp + "|" + text, lid)
    json.dump(index, open(idx_path, "w"), indent=0, ensure_ascii=False)
    print("lines", len(index["lines"]))


if __name__ == "__main__":
    main()
