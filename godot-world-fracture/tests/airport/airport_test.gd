extends SceneTree
## airport.gd headless: tickets, boarding, refunds, security, hangars, aircraft and where weapons may be out.
const Air = preload("res://scripts/airport/airport.gd")

var ok := true

func check(name: String, cond: bool, extra: Variant = "") -> void:
	print(("PASS " if cond else "FAIL ") + name + ("" if str(extra) == "" else "  " + str(extra)))
	ok = ok and cond

func _init() -> void:
	var p := { "nex": 500, "xp": 0, "level": 1 }
	# the board: every open destination but home, soonest first, closed ones last
	var b := Air.departures("NXC", 600)
	check("board lists every destination but home", b.size() == Air.DESTINATIONS.size() - 1 and b.all(func(f): return f.to != "NXC"))
	check("open flights first, in time order", b[0].open and not b[b.size() - 1].open and int(b[0].minute) <= int(b[1].minute), [b[0], b[1]])
	check("not-yet-open destinations are on the board but not sold", b.any(func(f): return f.to == "AET" and f.status == "NOT YET OPEN") and not Air.bookable("NXC", "AET"))
	check("routes never include home", "NXC" not in Air.routes("NXC") and "NEC" in Air.routes("NXC") and "THA" in Air.routes("NEC"))
	check("board wraps past midnight", Air.departures("NEC", 1435).all(func(f): return int(f.minute) >= 0 and int(f.minute) < 1440))
	# tickets
	check("no airside without a pass", not Air.can_go_airside(p, "NXC"))
	var line := Air.buy_ticket(p, "NXC", "THA")
	check("buy a ticket", int(p.nex) == 500 - Air.fare("THA") and Air.tickets_from(p, "NXC").size() == 1, line)
	check("a pass opens security at its airport only", Air.can_go_airside(p, "NXC") and not Air.can_go_airside(p, "NEC"))
	check("can't book home or a closed route", Air.buy_ticket(p, "NXC", "NXC").begins_with("No flights") and Air.buy_ticket(p, "NXC", "ELD").begins_with("No flights"))
	var poor := { "nex": 10 }
	check("not enough Nex", Air.buy_ticket(poor, "NEC", "NXC").begins_with("Needs") and int(poor.nex) == 10 and Air.air(poor).tickets.is_empty())
	check("boarding uses the ticket", Air.board(p, "NXC", "THA") and Air.tickets_from(p, "NXC").is_empty() and not Air.board(p, "NXC", "THA"))
	Air.buy_ticket(p, "NXC", "NEC")
	var before := int(p.nex)
	var tid: String = Air.air(p).tickets[0].id
	check("refund pays back 90%", Air.refund(p, tid).begins_with("Refunded") and int(p.nex) == before + 135 and Air.air(p).tickets.is_empty())
	# hangars and aircraft
	var rich := { "nex": 40000 }
	check("no aircraft without a hangar", Air.buy_aircraft(rich, "NXC", "vanguard-jet").begins_with("Lease"))
	check("lease a hangar", Air.buy_hangar(rich, "NXC", "H2").begins_with("Hangar H2") and int(rich.nex) == 40000 - Air.HANGAR_PRICE)
	check("one hangar per airport", Air.buy_hangar(rich, "NXC", "H1").begins_with("You already") and Air.hangar_bay(rich, "NXC") == "H2")
	check("a hangar opens security", Air.can_go_airside(rich, "NXC") and not Air.can_go_airside(rich, "NEC"))
	check("buy a jet into the hangar", Air.buy_aircraft(rich, "NXC", "vanguard-jet").ends_with("Nex") and Air.aircraft_at(rich, "NXC") == ["vanguard-jet"])
	check("no duplicate aircraft", Air.buy_aircraft(rich, "NXC", "vanguard-jet").contains("already"))
	# weapons
	for z in ["landside", "terminal", "shops", "lounge"]:
		check("no weapons in " + z, not Air.weapons_allowed(rich, "NXC", z))
	check("weapons on the apron and runway", Air.weapons_allowed(p, "NXC", "apron") and Air.weapons_allowed(p, "NEC", "runway"))
	check("weapons in your own hangar only", Air.weapons_allowed(rich, "NXC", "hangar:H2") and not Air.weapons_allowed(rich, "NXC", "hangar:H1") and not Air.weapons_allowed(p, "NXC", "hangar:H2"))
	# saves round-trip through JSON (ints come back as floats)
	var back: Dictionary = JSON.parse_string(JSON.stringify(rich))
	check("state survives a JSON save", Air.owns_hangar(back, "NXC") and Air.aircraft_at(back, "NXC").size() == 1 and Air.buy_hangar(back, "NEC", "H1").begins_with("Hangar"))
	# the network: two city airports off the streets, three in regions, every airport also a destination
	check("city airports open from streets", Air.AIRPORTS.NXC.street and Air.AIRPORTS.NEC.street and not Air.AIRPORTS.FRV.street)
	check("every airport is a destination with its own region", Air.AIRPORTS.keys().all(func(c): return Air.DESTINATIONS.has(c) and Air.DESTINATIONS[c].region == Air.AIRPORTS[c].region))
	check("a hangar can be leased at a region airport", Air.buy_hangar({ "nex": 9000 }, "SOL", "H3").begins_with("Hangar H3"))
	# First Class, the VIP lounge, paint
	var fc := { "nex": 2000 }
	check("economy passes don't open the VIP lounge", Air.buy_ticket(fc, "NXC", "RVD").begins_with("Ticket") and not Air.vip(fc, "NXC"))
	check("first class costs 2.5×", Air.buy_ticket(fc, "NXC", "SOL", "first").begins_with("First Class") and int(fc.nex) == 2000 - Air.fare("RVD") - Air.fare_for("SOL", "first") and Air.fare_for("SOL", "first") == 550)
	check("a first-class pass opens the VIP lounge here only", Air.vip(fc, "NXC") and not Air.vip(fc, "NEC"))
	check("a hangar opens the VIP lounge too", Air.vip(rich, "NXC"))
	var pr := Air.paint(rich, "NXC", "vanguard-jet", "crimson")
	check("respray an aircraft you own", pr.ends_with("Nex") and Air.paint_of(rich, "vanguard-jet") == "crimson", pr)
	check("can't paint what you don't own here", Air.paint(rich, "NXC", "leviathan", "gold").begins_with("That aircraft") and Air.paint(rich, "NEC", "vanguard-jet", "gold").begins_with("That aircraft"))
	var nex_before := int(rich.nex)
	check("factory colours back for free", Air.paint(rich, "NXC", "vanguard-jet", "factory").find("Nex") == -1 and Air.paint_of(rich, "vanguard-jet") == "factory" and int(rich.nex) == nex_before)
	print("ALL PASS" if ok else "SOME FAILED")
	quit(0 if ok else 1)
