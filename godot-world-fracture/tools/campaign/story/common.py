"""Shared names for the main story's chapter files (tools/campaign/story/ch*.py), read by tools/campaign/aftershock.py.

Each chapter file defines CHAPTER (its number and title), MISSIONS (the same shape as aftershock.py's: missions of
chapters, each chapter a gameplay kind with its opening and closing lines), STAGES (chapter id -> stage.gd set) and
ACTS (chapter id -> {spoken text: staged moment}). Speakers are UPPER CASE; the operator speaks as PLAYER.
"""
N, O = "NOVA", "PLAYER"
VOSS, SERA, RAINER, WARD, KAEL, COLE = "VOSS", "SERAPHINE", "RAINER", "WARD", "KAEL", "COLE"
CRANE = "CRANE"                      # Prefect Lysander Crane, the Ascendancy
ARCH = "THE ARCHITECT"               # the first of the two figures, named from Mission 13
VASQ = "OREN VASQ"                   # the second figure, the Architect's Second, named from Mission 13
TUROG = "VAEL TUROG"                 # the Severant, the ruler the Harbinger answers to, named from Mission 9
HARB = "THE HARBINGER"
ILYRA = "ILYRA SEN"
AUREN = "AUREN THALE"
ECHO = "THE ECHO"
VEIL = "VEILED SOVEREIGN"
WITNESS = "FIRST WITNESS"
GOL, NYX, CIPH = "GOLIATH", "NYX", "CIPHER"
DANIEL = "DANIEL"


def L(sp, *texts):
    return [(sp, t) for t in texts]
