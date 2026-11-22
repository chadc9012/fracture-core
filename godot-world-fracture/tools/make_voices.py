#!/usr/bin/env python3
"""World Fracture's voice bank: every line in data/dialogue/*.json, voiced.

Sources: the owner's campaign dialogue draft (campaign_draft1.json, 257 lines, stable ids), the campaign's playable
chapters (campaign_full.json, the lead's draft lines M<nn>_D<nn>), the people's talk (people.json) and Mission 01's opening
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
    "NOVA": (LT, 723, "nova"),       # closest cast voice to the owner's NOVA recordings (was 555)
    "PLAYER_m": (LT, 90, "plain"),
    "PLAYER_f": (LT, 195, "plain"),
    "PLAYER_r": (LT, 90, "robot"),
    "NEWS": (LT, 764, "tv"),         # closest to the owner's news anchor (was 15)
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
    # Chapter 1 — The Aftershock (data/dialogue/aftershock.json, the owner's Nov 22 screenplays)
    "VOSS": (LT, 660, "plain"),
    "SERAPHINE": (LT, 450, "plain"),
    "RAINER": (LT, 780, "deep"),
    "WARD": (LT, 735, "plain"),
    "KAEL": (LT, 270, "plain"),
    "COLE": (LT, 495, "plain"),
    "BOY": (LT, 60, "child"),
    "DANIEL": (LT, 60, "child"),
    "MAN": (LT, 105, "plain"),
    "OFFICER": (LT, 405, "plain"),
    "MILITARY RADIO": (LT, 330, "radio"),
    "SCIENTIST": (LT, 346, "tv"),
    "DR. CROSS": (LT, 346, "tv"),
    "UNKNOWN VOICE": (LT, 300, "fracture"),
    "UNKNOWN FIGURE": (LT, 870, "crown"),
    "SECOND FIGURE": (LT, 885, "crown"),
    "UNKNOWN RULER": (LT, 840, "vyrak"),
    "THE HARBINGER": (LT, 720, "vyrak"),
    "ENEMY COMMANDER": (LT, 30, "fracture"),
    "FRACTURE INFILTRATOR": (LT, 75, "fracture"),
    "ARCHIVE WARDEN": (LT, 600, "crown"),
    "ARCHIVE RECORDING": (LT, 225, "crown"),
    "GLOBAL BROADCAST": (LT, 764, "tv"),
    # the main story from Mission 8 (tools/campaign/story/ch*.py)
    "CRANE": (LT, 540, "plain"),
    "THE ARCHITECT": (LT, 870, "crown"),
    "COUNCILLOR": (LT, 870, "plain"),
    "OREN VASQ": (LT, 885, "plain"),
    "VAEL TUROG": (LT, 840, "vyrak"),
    "TUROG (MEMORY)": (LT, 840, "plain"),
    "ILYRA SEN": (LT, 240, "plain"),
    "AUREN THALE": (LT, 180, "deep"),
    "AUREN (MEMORY)": (LT, 180, "plain"),
    "THE ECHO": (LT, 585, "crown"),
    "VEILED SOVEREIGN": (LT, 450, "crown"),
    "FIRST WITNESS": ("en-gb-alan-low", None, "crown"),
    "GOLIATH": (LT, 150, "deep"),
    "NYX": (LT, 345, "plain"),
    "CIPHER": (LT, 420, "plain"),
    "VESPER": (LT, 480, "plain"),
    "CHIEF ODA": (LT, 510, "plain"),
    "HIEROPHANT": (LT, 630, "deep"),
    "DR. HALVARD": (LT, 555, "plain"),
    "TALLIS": (LT, 210, "fracture"),
    "RAIDER": (LT, 165, "shout"),
    "ELDER MAREN": (LT, 810, "plain"),
    "COLLECTOR": (LT, 30, "comms"),
    "EXECUTOR": (LT, 360, "comms"),
    "ASTRYAN MAKER": (LT, 520, "tv"),
    "PHANTOM CHILD": (LT, 60, "child"),
    "UNBOUND ELDER": (LT, 700, "plain"),
    "CHOIR VOICE": (LT, 630, "fracture"),
    "ENGINE VOICE": ("en-us-amy-low", None, "pa"),
    "SEVENTH PROTOCOL": ("en-gb-alan-low", None, "fracture"),
    "MEMORY": (LT, 395, "crown"),
    # the side missions (tools/campaign/side_missions.py)
    "SERGEANT IMANI": (LT, 465, "plain"),
    "RESEARCHER LUNE": (LT, 285, "plain"),
    "FREE OPERATOR": (LT, 225, "plain"),
    "RADIO FREE NEXUS": (LT, 615, "radio"),
    "MRS. REYES": (LT, 690, "plain"),
    "ANNA VOLK": (LT, 735, "plain"),
    "LIGHTHOUSE KEEPER": (LT, 780, "plain"),
    "RANGER": (LT, 375, "plain"),
    "MEDIC": (LT, 300, "plain"),
}
FALLBACK = (LT, 885, "plain")

# the named people (people.json): a LibriTTS speaker per person, fixed by their id, from pools that sound their body
# and age (young / grown / older), so Rosa always sounds like Rosa
VOICE_POOLS = {
    "female": {"young": [15, 60, 240, 345, 480], "grown": [120, 225, 300, 450, 585], "older": [690, 735, 810, 885]},
    "male": {"young": [30, 75, 195, 405, 495], "grown": [105, 180, 270, 540, 600], "older": [346, 660, 780, 840]},
}


def person_voice(l):
    body = "female" if str(l.get("body", "")).startswith("f") else "male"
    age = int(l.get("age", 35))
    band = "young" if age < 28 else ("older" if age >= 50 else "grown")
    pool = VOICE_POOLS[body][band]
    spk = pool[sum(ord(c) for c in str(l.get("person", l["id"]))) % len(pool)]
    return (LT, spk, "plain")


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
    # the campaign's playable chapters (tools/campaign/build.py): the lead's draft lines around the owner's
    full = os.path.join(ROOT, "data", "dialogue", "campaign_full.json")
    if os.path.exists(full):
        for l in json.load(open(full))["lines"]:
            lines.append({"id": l["id"], "speaker": l["speaker"], "text": l["text"]})
    # Chapter 1 — The Aftershock (tools/campaign/aftershock.py)
    aft = os.path.join(ROOT, "data", "dialogue", "aftershock.json")
    if os.path.exists(aft):
        for l in json.load(open(aft))["lines"]:
            lines.append({"id": l["id"], "speaker": l["speaker"], "text": l["text"]})
    # the side missions (tools/campaign/side_missions.py)
    side = os.path.join(ROOT, "data", "dialogue", "side_missions.json")
    if os.path.exists(side):
        for l in json.load(open(side))["lines"]:
            lines.append({"id": l["id"], "speaker": l["speaker"], "text": l["text"]})
    # the people's talk lines (tools/people_lines.py → data/dialogue/people.json), one voice per job
    people = os.path.join(ROOT, "data", "dialogue", "people.json")
    if os.path.exists(people):
        for l in json.load(open(people))["lines"]:
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


# NOVA and the news anchor have lines the owner recorded (the opening cinematic) and lines voiced here: the voiced ones
# take the cast speaker closest to the recordings (tools/match_voice.py picked them by pitch and timbre) and are then
# equalised to the recordings' long-term spectrum, so the two kinds sound like one person (owner, Nov 15: "Fix NOVA
# dialogue and voice same for the news reporter")
MATCH = {"NOVA": ["04.ogg", "06.ogg", "08.ogg", "09.ogg"], "NEWS": ["00.ogg", "02.ogg"]}
_ltas = {}


def _spectrum(y):
    import numpy as np, librosa
    m = np.abs(librosa.stft(y, n_fft=1024, hop_length=256))
    e = (m ** 2).sum(axis=0)
    keep = e > e.max() * 0.01
    return np.sqrt((m[:, keep] ** 2).mean(axis=1)) + 1e-9


def eq_match(model_dir, model, spk, sp, wav):
    import numpy as np, librosa, soundfile as sf
    from scipy.ndimage import uniform_filter1d
    if sp not in _ltas:
        ref = np.concatenate([librosa.load(os.path.join(PROVIDED, f), sr=22050)[0] for f in MATCH[sp]])
        probe = os.path.join(tempfile.mkdtemp(), "probe.wav")
        piper(model_dir, model, spk, "My designation is NOVA. Your reality is collapsing. Good morning, Nexus City. "
              "We are receiving reports of an unidentified phenomenon above the central district. Move. Now.", probe)
        src = librosa.load(probe, sr=22050)[0]
        g = _spectrum(ref) / _spectrum(src)
        g = g / np.median(g[20:200])
        g = np.exp(uniform_filter1d(np.log(g), 9))
        _ltas[sp] = np.clip(g, 10 ** (-9 / 20), 10 ** (9 / 20))
    y, sr = librosa.load(wav, sr=22050)
    S = librosa.stft(y, n_fft=1024, hop_length=256)
    out = librosa.istft(S * _ltas[sp][:, None], hop_length=256, length=len(y))
    sf.write(wav, out / max(1e-6, np.abs(out).max()) * 0.9, sr)


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


def audible(path):
    import soundfile as sf, numpy as np
    try:
        y, _ = sf.read(path)
    except Exception:
        return False
    return len(y) > 0 and float(np.abs(y).max()) >= 0.05


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
    # --speakers NOVA,NEWS: re-voice only those speakers' lines (with --force)
    speakers = sys.argv[sys.argv.index("--speakers") + 1].split(",") if "--speakers" in sys.argv else []
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
            if (force or not os.path.exists(out)) and (not only or lid.startswith(only)) and (not speakers or sp in speakers):
                prov = l.get("provided")
                if prov and var in ("", "_m"):
                    ffmpeg(os.path.join(PROVIDED, prov), out, PROVIDED_FX.get(sp, "highpass=f=70"))
                elif prov and var == "_r":
                    ffmpeg(os.path.join(PROVIDED, prov), out, FX["robot"])
                else:
                    model, spk, fx = CAST.get(key, person_voice(l) if l.get("body") else FALLBACK)
                    # the same cast voice saying the same words (PLAYER_m and the robot PLAYER_r share one) is spoken once
                    wav = os.path.join(tmp, "%s-%s-%d.wav" % (model, spk, abs(hash(text))))
                    if not os.path.exists(wav):
                        piper(model_dir, model, spk, speakable(text), wav)
                        if sp in MATCH:
                            eq_match(model_dir, model, spk, sp, wav)
                    ffmpeg(wav, out, FX[fx])
                    # a take came out silent now and then on long runs (eleven NOVA lines, Nov 22): check every take
                    # and voice it again from scratch until it is audible
                    for attempt in range(3):
                        if audible(out):
                            break
                        print("silent take, again:", lid + var, flush=True)
                        os.remove(wav)
                        piper(model_dir, model, spk, speakable(text), wav)
                        if sp in MATCH:
                            eq_match(model_dir, model, spk, sp, wav)
                        ffmpeg(wav, out, FX[fx])
                    if not audible(out):
                        print("STILL SILENT", lid + var, flush=True)
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
