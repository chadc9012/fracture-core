extends RefCounted
## Combat animation library (owner, Nov 21: "full GOLIATH, NYX and CIPHER character combat animations; running, jumping and
## dodging; weapon-specific reloads"). The bodies ship four clips (idle / walk / run / combat), so every other move is
## authored here as key poses on the shared Mixamo skeleton, built the way stand_idle.gd and work_idle.gd build theirs:
## skeleton-space turns on top of each bone's rest. action_layer.gd plays a clip over whatever the AnimationPlayer is
## doing — an "upper" clip (a reload, a block) leaves the legs to the walk or run underneath, a "full" clip (a dodge, a
## combo, a death) takes the whole body.
##
## A pose is a Dictionary of named parameters, degrees unless noted:
##   lean / twist / side      the spine bent forward, turned to its own left, leant to its left (split over the three spines)
##   head / head_turn         the head nodded down / turned left
##   hp / hr / hy             the whole body pitched forward / rolled to its left / turned left, at the hips
##   drop / fwd               the hips lowered / moved forward, metres
##   ra / la = [fwd, across, out]   an upper arm swung forward, across the body, raised out to the side
##   re / le                  the elbow bent
##   rt / lt = [fwd, out]     a thigh swung forward, out to the side
##   rk / lk                  the knee bent
## A clip is { len, mask ("upper" | "full"), loop, hold (stay on the last pose until stopped), keys: [[t 0..1, pose], ...],
## events: [[t 0..1, name], ...] }. Each parameter is interpolated between the keys that set it (smoothstep); a bone no
## parameter of the clip touches is left to the clip underneath.
## Clips by class: CLASS[frame][name] first, then SHARED[name]. `variant(frame, name)` picks; `RELOADS[frame]` per gun.

const ARMS := ["ra", "la"]
const LEGS := ["rt", "lt"]

# ---------------------------------------------------------------------------------------------------- shared moves
const READY := { "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "lean": 4 }

const SHARED := {
	# locomotion extras: the take-off and the air (held until landing), the landing, a sprint lean over the run
	"jump": { "len": 0.42, "mask": "full", "hold": true, "keys": [
		[0.0, { "drop": 0.0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [10, 0, 10], "la": [10, 0, 10], "re": 20, "le": 20 }],
		[0.25, { "drop": 0.16, "lean": 18, "rt": [34, 0], "lt": [34, 0], "rk": 58, "lk": 58, "ra": [-25, 0, 12], "la": [-25, 0, 12], "re": 30, "le": 30 }],
		[0.55, { "drop": -0.04, "lean": 2, "rt": [8, 0], "lt": [-6, 0], "rk": 10, "lk": 24, "ra": [55, 0, 25], "la": [40, 0, 25], "re": 40, "le": 40 }],
		[1.0, { "drop": 0.0, "lean": 8, "rt": [52, 4], "lt": [28, 4], "rk": 78, "lk": 64, "ra": [30, 0, 38], "la": [24, 0, 38], "re": 50, "le": 50 }]] },
	"land": { "len": 0.34, "mask": "full", "keys": [
		[0.0, { "drop": 0.0, "lean": 8, "rt": [52, 4], "lt": [28, 4], "rk": 78, "lk": 64, "ra": [30, 0, 38], "la": [24, 0, 38], "re": 50, "le": 50 }],
		[0.3, { "drop": 0.24, "lean": 22, "rt": [48, 6], "lt": [48, 6], "rk": 86, "lk": 86, "ra": [20, 0, 30], "la": [20, 0, 30], "re": 40, "le": 40 }],
		[1.0, { "drop": 0.0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [8, 0, 0], "la": [8, 0, 0], "re": 15, "le": 15 }]] },
	"sprint_lean": { "len": 1.0, "mask": "spine", "loop": true, "keys": [[0.0, { "lean": 13, "head": -8 }], [1.0, { "lean": 13, "head": -8 }]] },
	# hit reactions: a flinch, a stagger (stumbles back, arms thrown out), a knockdown that ends on the ground, the get-up
	"hit": { "len": 0.32, "mask": "upper", "keys": [
		[0.0, {}], [0.25, { "lean": -14, "head": -16, "twist": 8, "ra": [20, 0, 22], "la": [20, 0, 22], "re": 45, "le": 45 }], [1.0, {}]] },
	"hit_back": { "len": 0.32, "mask": "upper", "keys": [
		[0.0, {}], [0.25, { "lean": 16, "head": 12, "ra": [-10, 0, 26], "la": [-10, 0, 26], "re": 30, "le": 30 }], [1.0, {}]] },
	"stagger": { "len": 0.85, "mask": "full", "keys": [
		[0.0, { "hp": 0, "drop": 0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0 }],
		[0.2, { "hp": -14, "drop": 0.08, "lean": -18, "head": -22, "rt": [-18, 8], "lt": [22, 6], "rk": 20, "lk": 34, "ra": [40, -10, 55], "la": [30, -10, 60], "re": 30, "le": 40 }],
		[0.55, { "hp": -6, "drop": 0.14, "lean": 18, "head": 10, "rt": [30, 6], "lt": [-10, 6], "rk": 50, "lk": 18, "ra": [25, 0, 35], "la": [25, 0, 35], "re": 50, "le": 50 }],
		[1.0, { "hp": 0, "drop": 0, "lean": 0, "head": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [10, 0, 5], "la": [10, 0, 5], "re": 20, "le": 20 }]] },
	"knockdown": { "len": 1.1, "mask": "full", "hold": true, "keys": [
		[0.0, { "hp": 0, "drop": 0.0, "fwd": 0.0, "lean": 0, "head": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [10, 0, 5], "la": [10, 0, 5], "re": 20, "le": 20 }],
		[0.25, { "hp": -25, "drop": 0.2, "fwd": -0.2, "lean": -10, "head": -20, "rt": [30, 10], "lt": [10, 8], "rk": 40, "lk": 30, "ra": [60, -10, 60], "la": [50, -10, 60], "re": 30, "le": 30 }],
		[0.6, { "hp": -78, "drop": 0.78, "fwd": -0.55, "lean": 10, "head": 18, "rt": [55, 12], "lt": [35, 12], "rk": 30, "lk": 50, "ra": [80, -20, 70], "la": [70, -20, 75], "re": 20, "le": 25 }],
		[1.0, { "hp": -86, "drop": 0.86, "fwd": -0.7, "lean": 4, "head": 8, "rt": [18, 14], "lt": [8, 12], "rk": 10, "lk": 22, "ra": [100, -10, 80], "la": [95, -10, 82], "re": 15, "le": 10 }]] },
	"death": { "len": 1.3, "mask": "full", "hold": true, "keys": [
		[0.0, { "hp": 0, "hr": 0, "drop": 0.0, "fwd": 0.0, "lean": 0, "head": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [10, 0, 5], "la": [10, 0, 5], "re": 20, "le": 20 }],
		[0.3, { "hp": 12, "hr": 6, "drop": 0.35, "fwd": 0.05, "lean": 30, "head": 20, "rt": [40, 6], "lt": [20, 6], "rk": 90, "lk": 70, "ra": [20, 10, 10], "la": [30, 10, 10], "re": 60, "le": 50 }],
		[0.7, { "hp": 60, "hr": 14, "drop": 0.78, "fwd": 0.35, "lean": 20, "head": 10, "rt": [70, 10], "lt": [40, 8], "rk": 110, "lk": 80, "ra": [70, 20, 20], "la": [60, 10, 30], "re": 40, "le": 30 }],
		[1.0, { "hp": 86, "hr": 18, "drop": 0.84, "fwd": 0.55, "lean": 6, "head": -10, "rt": [20, 12], "lt": [10, 10], "rk": 20, "lk": 40, "ra": [150, 10, 40], "la": [110, 0, 60], "re": 20, "le": 30 }]] },
	"get_up": { "len": 0.9, "mask": "full", "keys": [
		[0.0, { "hp": -86, "drop": 0.86, "fwd": -0.7, "lean": 4, "head": 8, "rt": [18, 14], "lt": [8, 12], "rk": 10, "lk": 22, "ra": [100, -10, 80], "la": [95, -10, 82], "re": 15, "le": 10 }],
		[0.45, { "hp": -10, "drop": 0.5, "fwd": -0.2, "lean": 40, "head": 0, "rt": [90, 10], "lt": [70, 10], "rk": 120, "lk": 110, "ra": [30, 0, 30], "la": [30, 0, 30], "re": 40, "le": 40 }],
		[1.0, { "hp": 0, "drop": 0.0, "fwd": 0.0, "lean": 0, "head": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [10, 0, 5], "la": [10, 0, 5], "re": 20, "le": 20 }]] },
	# defence: the guard held, the parry's deflect, the counter that follows a parry
	"block": { "len": 0.5, "mask": "upper", "loop": true, "keys": [
		[0.0, { "lean": 8, "head": 6, "ra": [78, 42, 10], "re": 108, "la": [82, 46, 10], "le": 112 }],
		[1.0, { "lean": 8, "head": 6, "ra": [78, 42, 10], "re": 108, "la": [82, 46, 10], "le": 112 }]] },
	"parry": { "len": 0.32, "mask": "upper", "events": [[0.35, "deflect"]], "keys": [
		[0.0, { "twist": 0, "ra": [78, 42, 10], "re": 108, "la": [82, 46, 10], "le": 112 }],
		[0.35, { "twist": -28, "lean": 6, "ra": [95, -30, 30], "re": 40, "la": [60, 50, 10], "le": 100 }],
		[1.0, { "twist": 0, "lean": 0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65 }]] },
	# the gun at the ready while the combat stance holds: both hands on it, the body squared up
	"aim": { "len": 1.0, "mask": "arms", "loop": true, "keys": [[0.0, READY], [1.0, READY]] },
	"aim_sights": { "len": 1.0, "mask": "upper", "loop": true, "keys": [
		[0.0, { "ra": [72, 26, 4], "re": 82, "la": [66, 40, 0], "le": 78, "head": 8, "head_turn": 6, "lean": 6 }],
		[1.0, { "ra": [72, 26, 4], "re": 82, "la": [66, 40, 0], "le": 78, "head": 8, "head_turn": 6, "lean": 6 }]] },
}

# ---------------------------------------------------------------------------------------------------- the three classes
## GOLIATH: a heavy brawler — straight right, left hook, a two-fisted hammer; the heavy is a ground pound, the finisher a
## lift and slam; it shoulder-charges where the others roll, and its guard is crossed forearms behind its plating.
## NYX: a blade dancer — fast slashes, a back-hand, a spinning kick; the heavy is a lunging stab, the finisher a leap and a
## downward stab; it rolls and flips.
## CIPHER: an energy caster — palm strikes, a double-palm push; the heavy a charged palm, the finisher a palm to the chest
## and a burst; it blink-steps (a low glide) and holds a palm out as a barrier.
const CLASS := {
	"goliath": {
		"speed": 0.85,
		"melee_1": { "len": 0.5, "mask": "full", "events": [[0.42, "hit"]], "keys": [
			[0.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "drop": 0.04 }],
			[0.3, { "twist": -26, "lean": 6, "ra": [30, -10, 20], "re": 120, "la": [60, 40, 0], "le": 100, "rt": [-8, 4], "lt": [18, 4], "rk": 20, "lk": 16, "drop": 0.08 }],
			[0.45, { "twist": 30, "lean": 14, "ra": [88, 18, 8], "re": 8, "la": [40, 46, 0], "le": 115, "rt": [-14, 4], "lt": [26, 4], "rk": 14, "lk": 24, "drop": 0.12, "fwd": 0.18 }],
			[1.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "drop": 0.04, "fwd": 0.0 }]] },
		"melee_2": { "len": 0.55, "mask": "full", "events": [[0.45, "hit"]], "keys": [
			[0.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.3, { "twist": 28, "lean": 6, "la": [40, -20, 40], "le": 100, "ra": [60, 40, 0], "re": 110, "rt": [16, 4], "lt": [-6, 4], "rk": 18, "lk": 20 }],
			[0.48, { "twist": -36, "lean": 10, "la": [82, 58, 26], "le": 92, "ra": [50, 30, 0], "re": 115, "rt": [22, 4], "lt": [-12, 4], "rk": 22, "lk": 14, "fwd": 0.15 }],
			[1.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "fwd": 0.0 }]] },
		"melee_3": { "len": 0.78, "mask": "full", "events": [[0.62, "hit"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "head": 0 }],
			[0.4, { "lean": -18, "drop": -0.03, "ra": [168, 14, 8], "re": 70, "la": [168, 14, 8], "le": 70, "rt": [6, 6], "lt": [6, 6], "rk": 10, "lk": 10, "head": -18 }],
			[0.62, { "lean": 42, "drop": 0.32, "ra": [52, 18, 0], "re": 20, "la": [52, 18, 0], "le": 20, "rt": [42, 8], "lt": [-14, 8], "rk": 70, "lk": 40, "head": 18, "fwd": 0.22 }],
			[1.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "head": 0, "fwd": 0.0 }]] },
		"heavy": { "len": 0.95, "mask": "full", "events": [[0.66, "hit"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.45, { "lean": -10, "drop": -0.1, "ra": [175, 0, 20], "re": 30, "la": [175, 0, 20], "le": 30, "rt": [40, 10], "lt": [-6, 10], "rk": 50, "lk": 12, "head": -14 }],
			[0.66, { "lean": 58, "drop": 0.55, "ra": [70, 10, 10], "re": 10, "la": [70, 10, 10], "le": 10, "rt": [70, 14], "lt": [-20, 14], "rk": 100, "lk": 70, "head": 20 }],
			[0.82, { "lean": 52, "drop": 0.52, "ra": [68, 10, 12], "re": 14, "la": [68, 10, 12], "le": 14, "rt": [70, 14], "lt": [-20, 14], "rk": 100, "lk": 70, "head": 18 }],
			[1.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "head": 0 }]] },
		"finisher": { "len": 1.35, "mask": "full", "events": [[0.35, "grab"], [0.75, "hit"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "head": 0 }],
			[0.3, { "lean": 22, "drop": 0.2, "ra": [85, 30, 0], "re": 40, "la": [85, 30, 0], "le": 40, "rt": [30, 8], "lt": [10, 8], "rk": 40, "lk": 30, "head": 8 }],
			[0.55, { "lean": -24, "drop": -0.04, "ra": [175, 10, 0], "re": 50, "la": [175, 10, 0], "le": 50, "rt": [0, 8], "lt": [0, 8], "rk": 10, "lk": 10, "head": -26 }],
			[0.75, { "lean": 55, "drop": 0.5, "ra": [60, 20, 0], "re": 10, "la": [60, 20, 0], "le": 10, "rt": [64, 12], "lt": [-14, 12], "rk": 96, "lk": 60, "head": 24 }],
			[1.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "head": 0 }]] },
		"block": { "len": 0.5, "mask": "upper", "loop": true, "keys": [
			[0.0, { "lean": 12, "head": 10, "ra": [84, 48, 12], "re": 118, "la": [88, 52, 12], "le": 120 }],
			[1.0, { "lean": 12, "head": 10, "ra": [84, 48, 12], "re": 118, "la": [88, 52, 12], "le": 120 }]] },
		# the dodge is a low shoulder charge in the stick's direction (the body leans into it; dir picks the variant)
		"dodge_f": { "len": 0.42, "mask": "full", "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "ra": [55, 22, 0], "la": [48, 38, 0], "re": 75, "le": 65, "twist": 0 }],
			[0.35, { "lean": 38, "drop": 0.28, "rt": [55, 6], "lt": [-25, 6], "rk": 70, "lk": 30, "ra": [70, 50, 20], "la": [30, 20, 10], "re": 110, "le": 70, "twist": 22 }],
			[1.0, { "lean": 4, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "ra": [55, 22, 0], "la": [48, 38, 0], "re": 75, "le": 65, "twist": 0 }]] },
		"dodge_b": { "len": 0.42, "mask": "full", "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.35, { "lean": 20, "drop": 0.22, "rt": [50, 6], "lt": [-20, 6], "rk": 80, "lk": 40, "hp": -6 }],
			[1.0, { "lean": 4, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "hp": 0 }]] },
		"dodge_l": { "len": 0.42, "mask": "full", "keys": [
			[0.0, { "side": 0, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.35, { "side": 20, "drop": 0.24, "rt": [10, -6], "lt": [10, 34], "rk": 60, "lk": 30, "lean": 18 }],
			[1.0, { "side": 0, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "lean": 4 }]] },
		"dodge_r": { "len": 0.42, "mask": "full", "keys": [
			[0.0, { "side": 0, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.35, { "side": -20, "drop": 0.24, "rt": [10, 34], "lt": [10, -6], "rk": 30, "lk": 60, "lean": 18 }],
			[1.0, { "side": 0, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "lean": 4 }]] },
		"cast": { "len": 0.8, "mask": "full", "events": [[0.6, "cast"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.4, { "lean": -14, "drop": -0.05, "ra": [150, -10, 40], "re": 70, "la": [150, -10, 40], "le": 70, "head": -16, "rt": [10, 8], "lt": [10, 8], "rk": 14, "lk": 14 }],
			[0.6, { "lean": 46, "drop": 0.45, "ra": [70, 0, 30], "re": 0, "la": [70, 0, 30], "le": 0, "head": 18, "rt": [60, 12], "lt": [-10, 12], "rk": 90, "lk": 50 }],
			[1.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "head": 0, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }]] },
	},
	"nyx": {
		"speed": 1.2,
		"melee_1": { "len": 0.38, "mask": "full", "events": [[0.45, "hit"]], "keys": [
			[0.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.25, { "twist": 30, "lean": 6, "ra": [70, 60, 30], "re": 60, "la": [40, 10, 20], "le": 80, "rt": [10, 4], "lt": [-6, 4], "rk": 16, "lk": 10 }],
			[0.5, { "twist": -34, "lean": 12, "ra": [86, -24, 18], "re": 12, "la": [34, 24, 10], "le": 80, "rt": [24, 4], "lt": [-14, 4], "rk": 24, "lk": 10, "fwd": 0.2 }],
			[1.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "fwd": 0.0 }]] },
		"melee_2": { "len": 0.4, "mask": "full", "events": [[0.45, "hit"]], "keys": [
			[0.0, { "twist": -34, "lean": 10, "ra": [86, -24, 18], "re": 12, "la": [34, 24, 10], "le": 80, "rt": [10, 4], "lt": [0, 4], "rk": 16, "lk": 10 }],
			[0.2, { "twist": -40, "lean": 8, "ra": [70, -34, 26], "re": 40, "la": [40, 24, 10], "le": 80 }],
			[0.48, { "twist": 36, "lean": 14, "ra": [85, 55, 25], "re": 5, "la": [20, -10, 40], "le": 60, "rt": [-10, 4], "lt": [28, 4], "rk": 10, "lk": 26, "fwd": 0.2 }],
			[1.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "fwd": 0.0 }]] },
		"melee_3": { "len": 0.62, "mask": "full", "events": [[0.55, "hit"]], "keys": [
			[0.0, { "hy": 0, "lean": 4, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "ra": [55, 22, 0], "la": [48, 38, 0], "re": 75, "le": 65, "side": 0 }],
			[0.25, { "hy": 120, "lean": -6, "rt": [20, 10], "lt": [0, 4], "rk": 70, "lk": 10, "ra": [30, -20, 70], "la": [30, -20, 70], "re": 20, "le": 20, "side": -8 }],
			[0.55, { "hy": 300, "lean": -16, "rt": [88, 34], "lt": [0, 4], "rk": 4, "lk": 14, "ra": [20, -30, 80], "la": [20, -30, 80], "re": 10, "le": 10, "side": -20 }],
			[1.0, { "hy": 360, "lean": 4, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "ra": [55, 22, 0], "la": [48, 38, 0], "re": 75, "le": 65, "side": 0 }]] },
		"heavy": { "len": 0.7, "mask": "full", "events": [[0.55, "hit"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "fwd": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "twist": 0 }],
			[0.4, { "lean": 10, "drop": 0.2, "fwd": -0.15, "ra": [20, -10, 30], "re": 120, "la": [70, 30, 10], "le": 40, "rt": [40, 6], "lt": [-10, 6], "rk": 80, "lk": 30, "twist": -30 }],
			[0.55, { "lean": 30, "drop": 0.3, "fwd": 0.45, "ra": [92, 10, 6], "re": 0, "la": [-10, 0, 30], "le": 20, "rt": [60, 6], "lt": [-40, 6], "rk": 60, "lk": 10, "twist": 24 }],
			[1.0, { "lean": 4, "drop": 0.0, "fwd": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "twist": 0 }]] },
		"finisher": { "len": 1.1, "mask": "full", "events": [[0.7, "hit"]], "keys": [
			[0.0, { "drop": 0.0, "hp": 0, "lean": 4, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "ra": [55, 22, 0], "la": [48, 38, 0], "re": 75, "le": 65 }],
			[0.25, { "drop": 0.25, "hp": 0, "lean": 20, "rt": [40, 4], "lt": [40, 4], "rk": 80, "lk": 80, "ra": [-20, 0, 20], "la": [-20, 0, 20], "re": 30, "le": 30 }],
			[0.5, { "drop": -0.55, "hp": 20, "lean": 0, "rt": [70, 8], "lt": [60, 8], "rk": 100, "lk": 100, "ra": [170, 10, 10], "la": [170, 10, 10], "re": 30, "le": 30 }],
			[0.7, { "drop": 0.4, "hp": 30, "lean": 30, "rt": [80, 10], "lt": [10, 10], "rk": 110, "lk": 60, "ra": [70, 20, 0], "la": [70, 20, 0], "re": 0, "le": 0 }],
			[1.0, { "drop": 0.0, "hp": 0, "lean": 4, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "ra": [55, 22, 0], "la": [48, 38, 0], "re": 75, "le": 65 }]] },
		"block": { "len": 0.5, "mask": "upper", "loop": true, "keys": [
			[0.0, { "lean": 6, "twist": -14, "ra": [90, 40, 30], "re": 100, "la": [40, 30, 10], "le": 90 }],
			[1.0, { "lean": 6, "twist": -14, "ra": [90, 40, 30], "re": 100, "la": [40, 30, 10], "le": 90 }]] },
		# NYX tumbles: a forward roll, a backflip, side cartwheels
		"dodge_f": { "len": 0.5, "mask": "full", "keys": [
			[0.0, { "hp": 0, "drop": 0.0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "head": 0 }],
			[0.18, { "hp": 50, "drop": 0.38, "lean": 55, "rt": [100, 6], "lt": [100, 6], "rk": 120, "lk": 120, "ra": [80, 20, 10], "la": [80, 20, 10], "re": 90, "le": 90, "head": 45 }],
			[0.5, { "hp": 180, "drop": 0.28, "lean": 72, "rt": [115, 6], "lt": [115, 6], "rk": 135, "lk": 135, "ra": [70, 30, 10], "la": [70, 30, 10], "re": 110, "le": 110, "head": 55 }],
			[0.8, { "hp": 300, "drop": 0.42, "lean": 55, "rt": [105, 6], "lt": [105, 6], "rk": 125, "lk": 125, "ra": [80, 30, 10], "la": [80, 30, 10], "re": 100, "le": 100, "head": 40 }],
			[1.0, { "hp": 360, "drop": 0.0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "head": 0 }]] },
		"dodge_b": { "len": 0.55, "mask": "full", "keys": [
			[0.0, { "hp": 0, "drop": 0.0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "head": 0 }],
			[0.2, { "hp": -50, "drop": -0.4, "lean": 10, "rt": [60, 6], "lt": [60, 6], "rk": 90, "lk": 90, "ra": [170, 0, 20], "la": [170, 0, 20], "re": 10, "le": 10, "head": -30 }],
			[0.5, { "hp": -180, "drop": -0.45, "lean": 60, "rt": [115, 6], "lt": [115, 6], "rk": 135, "lk": 135, "ra": [80, 20, 30], "la": [80, 20, 30], "re": 80, "le": 80, "head": 40 }],
			[0.8, { "hp": -300, "drop": -0.15, "lean": 40, "rt": [90, 6], "lt": [90, 6], "rk": 110, "lk": 110, "ra": [60, 20, 40], "la": [60, 20, 40], "re": 50, "le": 50, "head": 20 }],
			[1.0, { "hp": -360, "drop": 0.0, "lean": 0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "head": 0 }]] },
		"dodge_l": { "len": 0.5, "mask": "full", "keys": [
			[0.0, { "hr": 0, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30 }],
			[0.5, { "hr": 180, "drop": -0.3, "rt": [10, 60], "lt": [10, 60], "rk": 10, "lk": 10, "ra": [0, 0, 160], "la": [0, 0, 160], "re": 10, "le": 10 }],
			[1.0, { "hr": 360, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30 }]] },
		"dodge_r": { "len": 0.5, "mask": "full", "keys": [
			[0.0, { "hr": 0, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30 }],
			[0.5, { "hr": -180, "drop": -0.3, "rt": [10, 60], "lt": [10, 60], "rk": 10, "lk": 10, "ra": [0, 0, 160], "la": [0, 0, 160], "re": 10, "le": 10 }],
			[1.0, { "hr": -360, "drop": 0.0, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30 }]] },
		"cast": { "len": 0.55, "mask": "upper", "events": [[0.5, "cast"]], "keys": [
			[0.0, { "twist": 0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65 }],
			[0.35, { "twist": -40, "lean": -4, "ra": [100, -60, 30], "re": 120, "la": [60, 40, 10], "le": 70, "head": -4 }],
			[0.5, { "twist": 34, "lean": 12, "ra": [92, 30, 10], "re": 0, "la": [20, -10, 30], "le": 50, "head": 4 }],
			[1.0, { "twist": 0, "lean": 0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "head": 0 }]] },
	},
	"cipher": {
		"speed": 1.0,
		"melee_1": { "len": 0.44, "mask": "full", "events": [[0.45, "hit"]], "keys": [
			[0.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.28, { "twist": -20, "lean": 0, "ra": [40, 0, 20], "re": 130, "la": [55, 40, 0], "le": 90, "rt": [-6, 4], "lt": [14, 4] }],
			[0.48, { "twist": 22, "lean": 10, "ra": [92, 4, 0], "re": 0, "la": [40, 30, 0], "le": 90, "rt": [-12, 4], "lt": [24, 4], "rk": 12, "lk": 20, "fwd": 0.14 }],
			[1.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "fwd": 0.0 }]] },
		"melee_2": { "len": 0.44, "mask": "full", "events": [[0.45, "hit"]], "keys": [
			[0.0, { "twist": 22, "lean": 10, "ra": [92, 4, 0], "re": 0, "la": [40, 30, 0], "le": 90 }],
			[0.28, { "twist": 22, "lean": 2, "la": [40, 0, 20], "le": 130, "ra": [55, 40, 0], "re": 90 }],
			[0.48, { "twist": -24, "lean": 10, "la": [92, 4, 0], "le": 0, "ra": [40, 30, 0], "re": 90, "fwd": 0.14 }],
			[1.0, { "twist": 0, "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "fwd": 0.0 }]] },
		"melee_3": { "len": 0.62, "mask": "full", "events": [[0.55, "hit"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8 }],
			[0.35, { "lean": -8, "drop": 0.1, "ra": [40, -10, 10], "re": 140, "la": [40, -10, 10], "le": 140, "rt": [20, 6], "lt": [0, 6], "rk": 30, "lk": 20 }],
			[0.55, { "lean": 16, "drop": 0.16, "ra": [90, 12, 0], "re": 0, "la": [90, 12, 0], "le": 0, "rt": [34, 6], "lt": [-20, 6], "rk": 30, "lk": 10, "fwd": 0.25 }],
			[1.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "fwd": 0.0 }]] },
		"heavy": { "len": 0.9, "mask": "full", "events": [[0.7, "hit"]], "keys": [
			[0.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "twist": 0 }],
			[0.5, { "lean": -6, "drop": 0.12, "ra": [30, -20, 30], "re": 120, "la": [70, 40, 0], "le": 30, "rt": [30, 8], "lt": [-6, 8], "rk": 40, "lk": 20, "twist": -40, "head": -6 }],
			[0.7, { "lean": 18, "drop": 0.2, "ra": [95, 0, 0], "re": 0, "la": [10, -20, 40], "le": 20, "rt": [44, 8], "lt": [-24, 8], "rk": 40, "lk": 14, "twist": 26, "fwd": 0.3 }],
			[1.0, { "lean": 4, "drop": 0.0, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "rt": [0, 0], "lt": [0, 0], "rk": 8, "lk": 8, "twist": 0, "fwd": 0.0, "head": 0 }]] },
		"finisher": { "len": 1.2, "mask": "full", "events": [[0.4, "grab"], [0.8, "hit"]], "keys": [
			[0.0, { "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "head": 0 }],
			[0.4, { "lean": 10, "ra": [90, 0, 0], "re": 0, "la": [50, 30, 0], "le": 80, "head": 6, "fwd": 0.2 }],
			[0.6, { "lean": 4, "ra": [95, 0, 0], "re": 0, "la": [95, 0, 0], "le": 0, "head": 0, "fwd": 0.25 }],
			[0.8, { "lean": -20, "ra": [60, -30, 70], "re": 0, "la": [60, -30, 70], "le": 0, "head": -20, "fwd": 0.0, "drop": 0.1 }],
			[1.0, { "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "head": 0, "drop": 0.0 }]] },
		"block": { "len": 0.5, "mask": "upper", "loop": true, "keys": [
			[0.0, { "lean": 4, "ra": [92, 10, 0], "re": 10, "la": [60, 30, 0], "le": 60, "head": 4 }],
			[1.0, { "lean": 4, "ra": [92, 10, 0], "re": 10, "la": [60, 30, 0], "le": 60, "head": 4 }]] },
		# CIPHER blink-steps: a low glide, arms trailing, the body tilted into the slide
		"dodge_f": { "len": 0.4, "mask": "full", "keys": [
			[0.0, { "lean": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0 }],
			[0.4, { "lean": 32, "drop": 0.3, "ra": [-40, 0, 30], "la": [-40, 0, 30], "re": 10, "le": 10, "rt": [40, 4], "lt": [-30, 4], "rk": 50, "lk": 20 }],
			[1.0, { "lean": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0 }]] },
		"dodge_b": { "len": 0.4, "mask": "full", "keys": [
			[0.0, { "lean": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "hp": 0 }],
			[0.4, { "lean": -10, "drop": 0.2, "hp": -10, "ra": [70, 0, 40], "la": [70, 0, 40], "re": 0, "le": 0, "rt": [30, 4], "lt": [10, 4], "rk": 40, "lk": 30 }],
			[1.0, { "lean": 0, "drop": 0.0, "hp": 0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0 }]] },
		"dodge_l": { "len": 0.4, "mask": "full", "keys": [
			[0.0, { "side": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0 }],
			[0.4, { "side": 26, "drop": 0.26, "ra": [10, 0, 80], "la": [10, 0, 50], "re": 10, "le": 10, "rt": [20, -4], "lt": [10, 30], "rk": 50, "lk": 20, "lean": 10 }],
			[1.0, { "side": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "lean": 0 }]] },
		"dodge_r": { "len": 0.4, "mask": "full", "keys": [
			[0.0, { "side": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0 }],
			[0.4, { "side": -26, "drop": 0.26, "ra": [10, 0, 50], "la": [10, 0, 80], "re": 10, "le": 10, "rt": [10, 30], "lt": [20, -4], "rk": 20, "lk": 50, "lean": 10 }],
			[1.0, { "side": 0, "drop": 0.0, "ra": [20, 0, 10], "la": [20, 0, 10], "re": 30, "le": 30, "rt": [0, 0], "lt": [0, 0], "rk": 0, "lk": 0, "lean": 0 }]] },
		"cast": { "len": 0.75, "mask": "upper", "events": [[0.55, "cast"]], "keys": [
			[0.0, { "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "head": 0 }],
			[0.4, { "lean": -10, "ra": [60, -40, 50], "re": 90, "la": [60, -40, 50], "le": 90, "head": -10 }],
			[0.55, { "lean": 12, "ra": [95, 8, 0], "re": 0, "la": [95, 8, 0], "le": 0, "head": 4 }],
			[1.0, { "lean": 4, "ra": [55, 22, 0], "re": 75, "la": [48, 38, 0], "le": 65, "head": 0 }]] },
	},
}

# ---------------------------------------------------------------------------------------------------- reloads per gun
## Each reload is stretched to the gun's own reload time. The gun stays in the right hand; the left hand does the work —
## to the magazine, down and away (the `mag_out` event drops the spent one, gunplay._drop_mag), to the belt, back up and
## in (`mag_in`), then the charging handle / slide / bolt / pump (`rack`). The shotgun feeds shells one by one
## (`shell` events), the LMG lifts its top cover, the launcher is loaded from behind, the fusion rifle swaps a cell.
const RELOADS := {
	"AUTO": { "mask": "upper", "events": [[0.3, "mag_out"], [0.7, "mag_in"], [0.86, "rack"]], "keys": [
		[0.0, READY],
		[0.12, { "ra": [46, 30, 10], "re": 85, "la": [40, 34, 0], "le": 82, "lean": 8, "twist": -8, "head": 10 }],
		[0.3, { "ra": [44, 30, 10], "re": 86, "la": [22, 18, 4], "le": 45, "lean": 8, "twist": -8, "head": 14 }],
		[0.48, { "ra": [44, 30, 10], "re": 86, "la": [-4, -12, 14], "le": 60, "lean": 6, "twist": -10, "head": 10 }],
		[0.7, { "ra": [46, 30, 10], "re": 86, "la": [36, 32, 2], "le": 88, "lean": 8, "twist": -8, "head": 14 }],
		[0.86, { "ra": [50, 28, 8], "re": 84, "la": [58, 44, 6], "le": 112, "lean": 6, "twist": -4, "head": 8 }],
		[1.0, READY]] },
	"SMG": { "mask": "upper", "events": [[0.28, "mag_out"], [0.66, "mag_in"], [0.84, "rack"]], "keys": [
		[0.0, READY],
		[0.12, { "ra": [44, 34, 8], "re": 90, "la": [38, 36, 0], "le": 84, "lean": 6, "twist": -10, "head": 12 }],
		[0.28, { "ra": [44, 34, 8], "re": 90, "la": [20, 20, 4], "le": 46, "lean": 6, "twist": -10, "head": 14 }],
		[0.46, { "ra": [44, 34, 8], "re": 90, "la": [-2, -10, 12], "le": 60, "lean": 6, "twist": -10, "head": 10 }],
		[0.66, { "ra": [44, 34, 8], "re": 90, "la": [34, 34, 2], "le": 90, "lean": 6, "twist": -10, "head": 14 }],
		[0.84, { "ra": [48, 30, 8], "re": 88, "la": [52, 46, 10], "le": 118, "lean": 4, "twist": -4, "head": 8 }],
		[1.0, READY]] },
	"SIDEARM": { "mask": "upper", "events": [[0.25, "mag_out"], [0.62, "mag_in"], [0.82, "rack"]], "keys": [
		[0.0, { "ra": [70, 18, 0], "re": 20, "la": [66, 30, 0], "le": 30 }],
		[0.12, { "ra": [40, 24, 0], "re": 80, "la": [40, 28, 0], "le": 80, "head": 14, "lean": 6 }],
		[0.25, { "ra": [36, 24, 0], "re": 84, "la": [10, 10, 4], "le": 40, "head": 16, "lean": 6 }],
		[0.45, { "ra": [36, 24, 0], "re": 84, "la": [-6, -14, 12], "le": 60, "head": 12, "lean": 6 }],
		[0.62, { "ra": [38, 24, 0], "re": 84, "la": [34, 28, 0], "le": 88, "head": 16, "lean": 6 }],
		[0.82, { "ra": [44, 20, 0], "re": 76, "la": [48, 40, 0], "le": 104, "head": 12, "lean": 4 }],
		[1.0, { "ra": [70, 18, 0], "re": 20, "la": [66, 30, 0], "le": 30 }]] },
	"SHOTGUN": { "mask": "upper", "events": [[0.2, "shell"], [0.38, "shell"], [0.56, "shell"], [0.74, "shell"], [0.9, "rack"]], "keys": [
		[0.0, READY],
		[0.08, { "ra": [40, 36, 14], "re": 92, "la": [30, 28, 0], "le": 92, "twist": -14, "lean": 8, "head": 12 }],
		[0.14, { "ra": [40, 36, 14], "re": 92, "la": [0, -6, 10], "le": 70, "twist": -14, "lean": 8, "head": 12 }],
		[0.2, { "ra": [40, 36, 14], "re": 92, "la": [32, 30, 0], "le": 100, "twist": -14, "lean": 8, "head": 14 }],
		[0.3, { "ra": [40, 36, 14], "re": 92, "la": [0, -6, 10], "le": 70, "twist": -14, "lean": 8, "head": 12 }],
		[0.38, { "ra": [40, 36, 14], "re": 92, "la": [32, 30, 0], "le": 100, "twist": -14, "lean": 8, "head": 14 }],
		[0.48, { "ra": [40, 36, 14], "re": 92, "la": [0, -6, 10], "le": 70, "twist": -14, "lean": 8, "head": 12 }],
		[0.56, { "ra": [40, 36, 14], "re": 92, "la": [32, 30, 0], "le": 100, "twist": -14, "lean": 8, "head": 14 }],
		[0.66, { "ra": [40, 36, 14], "re": 92, "la": [0, -6, 10], "le": 70, "twist": -14, "lean": 8, "head": 12 }],
		[0.74, { "ra": [40, 36, 14], "re": 92, "la": [32, 30, 0], "le": 100, "twist": -14, "lean": 8, "head": 14 }],
		[0.84, { "ra": [52, 26, 6], "re": 80, "la": [52, 40, 0], "le": 60, "twist": -4, "lean": 4, "head": 6 }],
		[0.9, { "ra": [52, 26, 6], "re": 80, "la": [34, 32, 0], "le": 92, "twist": -4, "lean": 4, "head": 6 }],
		[1.0, READY]] },
	"SNIPER": { "mask": "upper", "events": [[0.22, "rack"], [0.42, "mag_out"], [0.7, "mag_in"], [0.88, "rack"]], "keys": [
		[0.0, READY],
		[0.12, { "ra": [50, 26, 6], "re": 80, "la": [56, 10, 14], "le": 118, "head": 10, "lean": 6 }],
		[0.22, { "ra": [50, 26, 6], "re": 80, "la": [40, 2, 20], "le": 128, "head": 10, "lean": 6 }],
		[0.42, { "ra": [44, 30, 8], "re": 86, "la": [22, 18, 4], "le": 46, "head": 16, "lean": 8 }],
		[0.56, { "ra": [44, 30, 8], "re": 86, "la": [-4, -12, 14], "le": 60, "head": 12, "lean": 8 }],
		[0.7, { "ra": [44, 30, 8], "re": 86, "la": [34, 32, 2], "le": 88, "head": 16, "lean": 8 }],
		[0.8, { "ra": [50, 26, 6], "re": 80, "la": [56, 10, 14], "le": 118, "head": 10, "lean": 6 }],
		[0.88, { "ra": [50, 26, 6], "re": 80, "la": [64, 6, 10], "le": 108, "head": 10, "lean": 6 }],
		[1.0, READY]] },
	"LMG": { "mask": "upper", "events": [[0.22, "open"], [0.38, "mag_out"], [0.62, "mag_in"], [0.8, "close"], [0.9, "rack"]], "keys": [
		[0.0, READY],
		[0.1, { "ra": [40, 30, 14], "re": 96, "la": [60, 30, 0], "le": 110, "lean": 10, "head": 12, "drop": 0.04 }],
		[0.22, { "ra": [40, 30, 14], "re": 96, "la": [90, 24, 0], "le": 90, "lean": 10, "head": 6, "drop": 0.04 }],
		[0.38, { "ra": [40, 30, 14], "re": 96, "la": [18, 14, 8], "le": 50, "lean": 12, "head": 16, "drop": 0.04 }],
		[0.5, { "ra": [40, 30, 14], "re": 96, "la": [-6, -14, 16], "le": 60, "lean": 10, "head": 12, "drop": 0.04 }],
		[0.62, { "ra": [40, 30, 14], "re": 96, "la": [30, 26, 4], "le": 90, "lean": 12, "head": 16, "drop": 0.04 }],
		[0.72, { "ra": [40, 30, 14], "re": 96, "la": [48, 34, 0], "le": 104, "lean": 10, "head": 12, "drop": 0.04 }],
		[0.8, { "ra": [40, 30, 14], "re": 96, "la": [86, 26, 0], "le": 96, "lean": 10, "head": 8, "drop": 0.04 }],
		[0.9, { "ra": [46, 28, 10], "re": 90, "la": [56, 40, 4], "le": 112, "lean": 8, "head": 8, "drop": 0.02 }],
		[1.0, READY]] },
	"HEAVY": { "mask": "upper", "events": [[0.35, "mag_out"], [0.72, "mag_in"], [0.88, "rack"]], "keys": [
		[0.0, READY],
		[0.14, { "ra": [64, 20, 30], "re": 110, "la": [40, 30, 0], "le": 90, "lean": 4, "twist": 10, "head": 4 }],
		[0.35, { "ra": [64, 20, 30], "re": 110, "la": [-30, -30, 20], "le": 60, "lean": 0, "twist": 22, "head": -4 }],
		[0.55, { "ra": [64, 20, 30], "re": 110, "la": [-40, -40, 30], "le": 90, "lean": -4, "twist": 30, "head": -6 }],
		[0.72, { "ra": [64, 20, 30], "re": 110, "la": [10, -20, 30], "le": 70, "lean": 0, "twist": 20, "head": 0 }],
		[0.88, { "ra": [60, 22, 20], "re": 100, "la": [46, 36, 0], "le": 80, "lean": 4, "twist": 4, "head": 4 }],
		[1.0, READY]] },
	"FUSION": { "mask": "upper", "events": [[0.3, "mag_out"], [0.68, "mag_in"], [0.86, "rack"]], "keys": [
		[0.0, READY],
		[0.15, { "ra": [50, 24, 0], "re": 82, "la": [46, 6, 26], "le": 100, "lean": 6, "twist": 14, "head": 10, "head_turn": 18 }],
		[0.3, { "ra": [50, 24, 0], "re": 82, "la": [30, -20, 40], "le": 80, "lean": 6, "twist": 16, "head": 10, "head_turn": 22 }],
		[0.5, { "ra": [50, 24, 0], "re": 82, "la": [0, -16, 20], "le": 70, "lean": 4, "twist": 10, "head": 6, "head_turn": 10 }],
		[0.68, { "ra": [50, 24, 0], "re": 82, "la": [44, 4, 28], "le": 104, "lean": 6, "twist": 14, "head": 10, "head_turn": 18 }],
		[0.86, { "ra": [52, 24, 0], "re": 80, "la": [52, 40, 0], "le": 80, "lean": 4, "twist": 4, "head": 6, "head_turn": 4 }],
		[1.0, READY]] },
}

## the reload that fits a frame (unknown frames take the rifle's)
## the frames added Nov 22 reload like their nearest kin: the pistol works its slide like the hand cannon, the marksman
## rifle its bolt and box like the sniper, the rocket launcher loads from behind like the heavy cannon and the grenade
## launcher feeds shells one at a time like the shotgun
const RELOAD_KIN := { "PISTOL": "SIDEARM", "MARKSMAN": "SNIPER", "ROCKET": "HEAVY", "GL": "SHOTGUN" }
static func reload_for(frame: String) -> Dictionary:
	return RELOADS.get(RELOAD_KIN.get(frame, frame), RELOADS.AUTO)

## a class clip, else the shared one, else {}
static func variant(cls: String, name: String) -> Dictionary:
	var c: Dictionary = CLASS.get(cls, {})
	if c.has(name):
		return c[name]
	return SHARED.get(name, {})

## a class's playback speed (GOLIATH heavier, NYX quicker)
static func speed_of(cls: String) -> float:
	return float((CLASS.get(cls, {}) as Dictionary).get("speed", 1.0))

## the dodge variant for a direction in the body's own frame (x right, y forward)
static func dodge_name(dir: Vector2) -> String:
	if dir.length() < 0.2:
		return "dodge_b"
	if absf(dir.x) > absf(dir.y):
		return "dodge_r" if dir.x > 0.0 else "dodge_l"
	return "dodge_f" if dir.y > 0.0 else "dodge_b"

## every clip the library holds, by key: "<class>/<name>", "shared/<name>", "reload/<FRAME>" (the tests walk this)
static func all() -> Dictionary:
	var out := {}
	for n in SHARED:
		out["shared/" + String(n)] = SHARED[n]
	for c in CLASS:
		for n in CLASS[c]:
			if CLASS[c][n] is Dictionary:
				out[String(c) + "/" + String(n)] = CLASS[c][n]
	for f in RELOADS:
		out["reload/" + String(f)] = RELOADS[f]
	return out

## the parameters a clip sets anywhere in its keys
static func params_of(clip: Dictionary) -> Dictionary:
	var out := {}
	for k in clip.get("keys", []):
		for p in (k[1] as Dictionary):
			out[p] = true
	return out

## the clip's parameters at time `u` (0..1 of its length): each parameter eased between the two keys that set it around u;
## arrays (arms, thighs) component by component
static func sample(clip: Dictionary, u: float) -> Dictionary:
	var keys: Array = clip.get("keys", [])
	var out := {}
	for p in params_of(clip):
		var prev_t := -1.0
		var prev: Variant = null
		var next_t := -1.0
		var next: Variant = null
		for k in keys:
			var pose: Dictionary = k[1]
			if not pose.has(p):
				continue
			var t := float(k[0])
			if t <= u:
				prev_t = t
				prev = pose[p]
			elif next == null:
				next_t = t
				next = pose[p]
		if prev == null:
			out[p] = next
		elif next == null or next_t <= prev_t:
			out[p] = prev
		else:
			var w := smoothstep(0.0, 1.0, (u - prev_t) / (next_t - prev_t))
			out[p] = _mix(prev, next, w)
	return out

static func _mix(a: Variant, b: Variant, w: float) -> Variant:
	if a is Array:
		var r: Array = []
		for i in (a as Array).size():
			r.append(lerpf(float(a[i]), float((b as Array)[i]) if i < (b as Array).size() else float(a[i]), w))
		return r
	return lerpf(float(a), float(b), w)
