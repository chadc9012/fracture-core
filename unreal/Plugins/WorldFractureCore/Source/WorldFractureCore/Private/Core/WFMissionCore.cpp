// World Fracture — scripted story missions. Port of src/game/missions/*; see WFMissionCore.h.
#include "Core/WFMissionCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>

namespace wf::mission
{
	namespace
	{
		/** The family of a mission's state machine and its mission-specific state names. */
		struct FShape
		{
			enum class EFamily { Awakening, Wave, Boss, CoreNode, Descent } Family;
			std::string Approach;  // the travel state after ANCHOR (Boss family)
			std::string Objective; // the hack-style state after the first fight (Boss family)
			bool bStaleGuard;      // ARRIVED/CLEAR with a `from` for another state are ignored
		};

		const std::map<std::string, FShape>& Shapes()
		{
			using F = FShape::EFamily;
			static const std::map<std::string, FShape> Map = {
				{"awakening", {F::Awakening, "", "", false}},
				{"broken-signal", {F::Wave, "DISCOVERY", "HACKING", true}},
				{"blackout-protocol", {F::Wave, "INFILTRATION", "HACKING", false}},
				{"drowned-relay", {F::Boss, "WADING", "PURGING", false}},
				{"stitched-neon-core", {F::Boss, "DESCENT", "STABILIZING", false}},
				{"solar-array", {F::Boss, "CROSSING", "REALIGNING", false}},
				{"core-node", {F::CoreNode, "INFILTRATE", "HACKING", false}},
				{"frozen-beacon", {F::Boss, "TRAVEL", "HACKING", false}},
				{"failure-core", {F::Boss, "TRAVEL", "HACKING", false}},
				{"convoy-breaker", {F::Boss, "TRAVEL", "HACKING", false}},
				{"descent-protocol", {F::Descent, "DIVE", "", true}},
				{"system-core", {F::Boss, "DIVE", "STABILIZING", false}},
			};
			return Map;
		}

		/** Moves to `To` and applies the transition's line(s) from the table. */
		FRun Go(const FLines& L, FRun R, const std::string& To, const std::string& Suffix = "")
		{
			const std::string Key = R.State + ">" + To + Suffix;
			if (const std::string* Nova = L.Find(R.Id, "nova", Key)) R.Nova = *Nova;
			if (const std::string* Line = L.Find(R.Id, "line", Key)) R.Line = *Line;
			if (const std::string* Alert = L.Find(R.Id, "alert", "alert:" + R.State + ">" + To)) R.Alert = *Alert;
			R.State = To;
			return R;
		}

		FRun Awakening(const FLines& L, const FRun& R, const FEvent& E)
		{
			const auto ClearFor = [&E](const char* Phase) { return E.Type == EEvent::Clear && (!E.From || *E.From == Phase); };
			if (R.State == "IDLE") return E.Type == EEvent::Start ? Go(L, R, "DROP") : R;
			if (R.State == "DROP")
			{
				if (E.Type != EEvent::Anchor) return R;
				FRun N = Go(L, R, "PATROL");
				N.Target = FPoint{E.X, E.Z};
				return N;
			}
			if (R.State == "PATROL") return ClearFor("PATROL") ? Go(L, R, "ESCALATION") : R;
			if (R.State == "ESCALATION") return ClearFor("ESCALATION") ? Go(L, R, "LOOT") : R;
			if (R.State == "LOOT")
			{
				if (E.Type != EEvent::Ack || !R.Target) return R;
				FRun N = Go(L, R, "CAPTURE");
				N.Target = FPoint{R.Target->X + 30, R.Target->Z - 18};
				return N;
			}
			if (R.State == "CAPTURE")
			{
				if (E.Type != EEvent::Arrived) return R;
				FRun N = Go(L, R, "HOLD");
				N.Hold = 0;
				return N;
			}
			if (R.State == "HOLD")
			{
				if (E.Type != EEvent::Hold) return R;
				if (E.Progress >= 100 && R.Target)
				{
					FRun N = Go(L, R, "EXTRACT");
					N.Hold = 100;
					N.Target = FPoint{R.Target->X - 26, R.Target->Z + 34};
					return N;
				}
				FRun N = R;
				N.Hold = E.Progress;
				return N;
			}
			if (R.State == "EXTRACT")
			{
				if (E.Type != EEvent::Arrived) return R;
				FRun N = Go(L, R, "COMPLETE");
				N.Target.reset();
				return N;
			}
			return R;
		}

		FRun Wave(const FLines& L, const FShape& S, const FRun& R, const FEvent& E)
		{
			const bool bBrokenSignal = R.Id == "broken-signal";
			if (R.State == "IDLE") return E.Type == EEvent::Start ? Go(L, R, "TRIGGERED") : R;
			if (R.State == "TRIGGERED")
			{
				if (E.Type != EEvent::Anchor) return R;
				FRun N = Go(L, R, S.Approach);
				N.Target = FPoint{E.X, E.Z};
				return N;
			}
			if (bBrokenSignal && R.State == "DISCOVERY")
			{
				if (E.Type != EEvent::Arrived || !R.Target) return R;
				FRun N = Go(L, R, "TRAVERSAL");
				N.Target = FPoint{R.Target->X + 22, R.Target->Z + 22};
				return N;
			}
			if (R.State == (bBrokenSignal ? "TRAVERSAL" : S.Approach)) return E.Type == EEvent::Arrived ? Go(L, R, "COMBAT_1") : R;
			if (R.State == "COMBAT_1") return E.Type == EEvent::Clear ? Go(L, R, "HACKING") : R;
			if (R.State == "HACKING")
			{
				if (E.Type != EEvent::Hack) return R;
				if (E.Progress >= 50 && !R.bWave2Done)
				{
					FRun N = Go(L, R, "COMBAT_2");
					N.Hack = E.Progress;
					return N;
				}
				if (E.Progress >= 100)
				{
					FRun N = Go(L, R, "COMPLETE");
					N.Hack = 100;
					return N;
				}
				FRun N = R;
				N.Hack = E.Progress;
				return N;
			}
			if (R.State == "COMBAT_2")
			{
				if (E.Type != EEvent::Clear) return R;
				FRun N = Go(L, R, "HACKING");
				N.bWave2Done = true;
				return N;
			}
			if (R.State == "COMPLETE")
			{
				if (E.Type != EEvent::Ack) return R;
				FRun N = Go(L, R, "WORLD_UPDATE");
				N.Target.reset();
				return N;
			}
			return R;
		}

		/** Boss family, plus the Core Node (whose objective leads to a reveal and an allegiance choice instead of a boss). */
		FRun Boss(const FLines& L, const FShape& S, const FContext& C, const FRun& R, const FEvent& E)
		{
			const bool bCoreNode = S.Family == FShape::EFamily::CoreNode;
			if (R.State == "IDLE") return E.Type == EEvent::Start ? Go(L, R, "TRIGGERED") : R;
			if (R.State == "TRIGGERED")
			{
				if (E.Type != EEvent::Anchor) return R;
				FRun N = Go(L, R, S.Approach);
				N.Target = FPoint{E.X, E.Z};
				return N;
			}
			if (R.State == S.Approach) return E.Type == EEvent::Arrived ? Go(L, R, "COMBAT_1") : R;
			if (R.State == "COMBAT_1") return E.Type == EEvent::Clear ? Go(L, R, S.Objective) : R;
			if (R.State == S.Objective)
			{
				if (E.Type != EEvent::Hack) return R;
				if (E.Progress >= 100)
				{
					FRun N = Go(L, R, bCoreNode ? "REVEAL" : "BOSS");
					N.Hack = 100;
					return N;
				}
				FRun N = R;
				N.Hack = E.Progress;
				return N;
			}
			if (bCoreNode && R.State == "REVEAL") return E.Type == EEvent::Decided && C.Faction ? Go(L, R, "COMPLETE", ":" + *C.Faction) : R;
			if (!bCoreNode && R.State == "BOSS") return E.Type == EEvent::Clear ? Go(L, R, "COMPLETE") : R;
			if (R.State == "COMPLETE")
			{
				if (E.Type != EEvent::Ack) return R;
				FRun N = Go(L, R, "WORLD_UPDATE");
				N.Target.reset();
				return N;
			}
			return R;
		}

		FRun Descent(const FLines& L, const FContext& C, const FRun& R, const FEvent& E)
		{
			if (R.State == "IDLE") return E.Type == EEvent::Start ? Go(L, R, "TRIGGERED") : R;
			if (R.State == "TRIGGERED")
			{
				if (E.Type != EEvent::Anchor) return R;
				FRun N = Go(L, R, "DIVE");
				N.Target = FPoint{E.X, E.Z};
				return N;
			}
			if (R.State == "DIVE") return E.Type == EEvent::Arrived ? Go(L, R, "COMBAT_1") : R;
			if (R.State == "COMBAT_1")
			{
				if (E.Type != EEvent::Clear) return R;
				FRun N = Go(L, R, "AIRLOCK");
				N.Target = C.Airlock;
				N.Hack = 0;
				return N;
			}
			if (R.State == "AIRLOCK")
			{
				if (E.Type != EEvent::Hack) return R;
				if (E.Progress >= 100)
				{
					FRun N = Go(L, R, "RING");
					N.Hack = 0;
					N.Target = C.Ring;
					return N;
				}
				FRun N = R;
				N.Hack = E.Progress;
				return N;
			}
			if (R.State == "RING")
			{
				if (E.Type != EEvent::Arrived) return R;
				FRun N = Go(L, R, "CORE");
				N.Target = C.Reactor;
				return N;
			}
			if (R.State == "CORE")
			{
				if (E.Type != EEvent::Arrived) return R;
				FRun N = Go(L, R, "TRACING");
				N.Hack = 0;
				return N;
			}
			if (R.State == "TRACING")
			{
				if (E.Type != EEvent::Hack) return R;
				if (E.Progress >= 100)
				{
					FRun N = Go(L, R, "COMPLETE");
					N.Hack = 100;
					return N;
				}
				FRun N = R;
				N.Hack = E.Progress;
				return N;
			}
			if (R.State == "COMPLETE")
			{
				if (E.Type != EEvent::Ack) return R;
				FRun N = Go(L, R, "WORLD_UPDATE");
				N.Target.reset();
				return N;
			}
			return R;
		}
	}

	void FLines::Add(const std::string& Mission, const std::string& Field, const std::string& Key, const std::string& Text)
	{
		Lines[{Mission, Field, Key}] = Text;
	}

	const std::string* FLines::Find(const std::string& Mission, const std::string& Field, const std::string& Key) const
	{
		const auto Found = Lines.find({Mission, Field, Key});
		return Found == Lines.end() ? nullptr : &Found->second;
	}

	const std::vector<std::string>& MissionIds()
	{
		static const std::vector<std::string> Ids = {"awakening", "broken-signal", "drowned-relay", "blackout-protocol", "stitched-neon-core", "solar-array",
			"core-node", "frozen-beacon", "failure-core", "convoy-breaker", "descent-protocol", "system-core"};
		return Ids;
	}

	bool IsKnown(const std::string& Id) { return Shapes().count(Id) > 0; }

	FRun Initial(const std::string& Id)
	{
		FRun R;
		R.Id = Id;
		return R;
	}

	FRun Advance(const FLines& Lines, const FContext& Context, const FRun& Run, const FEvent& Event)
	{
		const auto Found = Shapes().find(Run.Id);
		if (Found == Shapes().end()) return Run;
		const FShape& S = Found->second;
		if (S.bStaleGuard && (Event.Type == EEvent::Arrived || Event.Type == EEvent::Clear) && Event.From && *Event.From != Run.State) return Run;
		switch (S.Family)
		{
		case FShape::EFamily::Awakening: return Awakening(Lines, Run, Event);
		case FShape::EFamily::Wave: return Wave(Lines, S, Run, Event);
		case FShape::EFamily::Boss:
		case FShape::EFamily::CoreNode: return Boss(Lines, S, Context, Run, Event);
		case FShape::EFamily::Descent: return Descent(Lines, Context, Run, Event);
		}
		return Run;
	}

	std::string Describe(const FRun& R)
	{
		const char Sep = '\x1f';
		std::string Out = "id=" + R.Id + Sep + "state=" + R.State + Sep + "target=";
		Out += R.Target ? js::NumberToString(R.Target->X) + "," + js::NumberToString(R.Target->Z) : std::string("null");
		Out += std::string(1, Sep) + "hack=" + js::NumberToString(R.Hack) + Sep + "hold=" + js::NumberToString(R.Hold) + Sep + "wave2=" + (R.bWave2Done ? "1" : "0");
		Out += std::string(1, Sep) + "nova=" + R.Nova + Sep + "line=" + R.Line + Sep + "alert=" + R.Alert;
		return Out;
	}
}
