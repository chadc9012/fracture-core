// World Fracture — scripted story missions.
//
// Port of the web build's mission state machines (src/game/missions/*): awakening, broken-signal, drowned-relay,
// blackout-protocol, stitched-neon-core, solar-array, core-node, the three zone missions (frozen-beacon, failure-core,
// convoy-breaker), descent-protocol and system-core. Each is driven by world events (START, ANCHOR, ARRIVED, CLEAR,
// HACK, HOLD, ACK, DECIDED) exactly as in the web build. The NOVA and mission lines are data (DataTables/MissionLines.json,
// keyed "FROM>TO"), so the logic here never retypes story text. Golden-tested in Tests/MissionCoreTest.cpp.
#pragma once

#include <map>
#include <optional>
#include <string>
#include <tuple>
#include <vector>

namespace wf::mission
{
	struct FPoint
	{
		double X = 0;
		double Z = 0;
	};

	/** One mission's live run, in the unified shape the web build saves (missions/persistence.ts SavedMissionRun). */
	struct FRun
	{
		std::string Id;
		std::string State = "IDLE";
		std::optional<FPoint> Target;
		double Hack = 0;
		double Hold = 0;
		bool bWave2Done = false;
		std::string Nova;  // NOVA's current line (most missions)
		std::string Line;  // Awakening's mission line
		std::string Alert; // Awakening's district alert banner
	};

	enum class EEvent { Start, Anchor, Arrived, Clear, Hack, Hold, Ack, Decided };

	struct FEvent
	{
		EEvent Type = EEvent::Start;
		double X = 0, Z = 0;              // Anchor
		std::optional<std::string> From;  // Arrived / Clear: the state the world saw when it emitted (stale-event guard)
		double Progress = 0;              // Hack / Hold
	};

	/** Inputs some missions read: the Descent Protocol's world sites and the allegiance chosen at the Core Node. */
	struct FContext
	{
		FPoint Airlock;
		FPoint Ring;
		FPoint Reactor;
		std::optional<std::string> Faction; // controllers | breakers | resonants
	};

	class FLines
	{
	public:
		/** Field: nova | line | alert. Key: "FROM>TO", "FROM>TO:<faction>", or "alert:FROM>TO". */
		void Add(const std::string& Mission, const std::string& Field, const std::string& Key, const std::string& Text);
		const std::string* Find(const std::string& Mission, const std::string& Field, const std::string& Key) const;
		size_t Num() const { return Lines.size(); }

	private:
		std::map<std::tuple<std::string, std::string, std::string>, std::string> Lines;
	};

	/** The missions this core runs, in campaign order. */
	const std::vector<std::string>& MissionIds();
	bool IsKnown(const std::string& Id);
	FRun Initial(const std::string& Id);

	/** One world event. Returns the run unchanged when the event doesn't apply to its state. */
	FRun Advance(const FLines& Lines, const FContext& Context, const FRun& Run, const FEvent& Event);

	/** Stable text for tests and logs (fields separated by \x1f). */
	std::string Describe(const FRun& Run);
}
