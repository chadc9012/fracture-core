extends RefCounted
## One wallet for every vehicle facility (owner's "Three Vehicle Facilities V4 — Shared Wallet", Nov 15): the customs
## garage, the Aviation Hangar and the Military Motor Pool all spend the profile's Nex, the same Nex the dealership, the
## airport and street racing use. The garage's own ₵ credits (garage_state.gd) were a separate purse; the first time a
## facility opens they're added to your Nex once and the purse is retired. While a facility is open its state's `credits`
## mirrors your Nex (so the garage's order and checkout code is unchanged); close() writes it back.

const Gear := preload("res://scripts/gear/gear_store.gd")

## move the old garage credits over once, then point state.credits at the profile's Nex
static func open(state) -> void:
	var p := Gear.profile_load()
	if not state.wallet_merged:
		p.nex = int(p.get("nex", 0)) + int(state.credits)
		state.wallet_merged = true
		Gear.profile_save(p)
		state.save()
	state.credits = int(p.get("nex", 0))

## write what's left back to the profile (call after every purchase)
static func close(state) -> void:
	var p := Gear.profile_load()
	p.nex = maxi(0, int(state.credits))
	Gear.profile_save(p)
