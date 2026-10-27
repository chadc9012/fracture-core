#include "Core/WFVenueCore.h"

#include "Core/WFBountyCore.h"
#include "Core/WFJsCompat.h"
#include "Core/WFRewardCore.h"
#include "Core/WFVehicleCore.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdint>

namespace wf::venue
{
	namespace
	{
		struct FDanceVenue { std::string Venue; double Bpm = 0, Beats = 0; };
		// generated from the web build (nightlife.ts, venue-life.ts, dance.ts) by a one-off dump; keep in step with them
		const std::vector<FVenue> VnVenues = {
			{"pulse-array", "PULSE ARRAY", "NEON CITY NIGHTCLUB", "nightclub", "#35efff", "#7a5cff", 26, 52},
			{"afterglow", "AFTERGLOW", "NEON CITY NIGHTCLUB", "nightclub", "#ff3b9d", "#ff7a3a", -26, 52},
			{"velvet-circuit", "VELVET CIRCUIT", "21+ CABARET LOUNGE", "lounge", "#c040ff", "#ff4fa8", 26, 86},
			{"crown-casino", "CROWN CASINO", "CASINO · HOTEL", "casino", "#ffc247", "#ff8a2a", -104, -26},
		};
		const std::vector<FHours> VnHours = {
			{"pulse-array", 20, 4},
			{"afterglow", 21, 5},
			{"velvet-circuit", 18, 2},
			{"crown-casino", 0, 24},
			{"grid-line-diner", 17, 7},
		};
		const std::vector<FVenueEvent> VnEvents = {
			{"pulse-overdrive", "pulse-array", "Overdrive Hour · bass-heavy set", 23, 1},
			{"afterglow-sunrise", "afterglow", "Sunrise Session · last dance before dawn", 3, 5},
			{"velvet-showcase", "velvet-circuit", "Midnight Showcase · live cabaret", 22, 0},
			{"crown-high-roller", "crown-casino", "High Roller Night · private tables open", 21, 2},
		};
		const std::vector<std::pair<std::string, std::string>> VnHosts = {
			{"pulse-array", "Kade, door host"},
			{"afterglow", "Sable, bartender"},
			{"velvet-circuit", "Mirelle, hostess"},
			{"crown-casino", "Dorian, pit boss"},
			{"grid-line-diner", "Ma Ruiz, owner"},
		};
		// the hosts' lines by tier (new, regular, VIP)
		const std::vector<std::pair<std::string, std::vector<std::vector<std::string>>>> VnLines = {
			{"pulse-array", {{"First time at Pulse Array? Keep your hands where the bouncers can see them and your eyes on the lights.", "The floor shakes on the drop. That's the building, not you."}, {"You again. Good. The regulars are starting to save you a spot by the rail.", "DJ's been testing a new set all week. Stick around past eleven."}, {"VIP rail's yours tonight. Nobody asks questions up there.", "You've earned the quiet booth. The city can wait an hour."}}},
			{"afterglow", {{"Afterglow never really closes, it just gets quieter. What are you drinking?", "Most people come here to forget a job. Some come to find one."}, {"Back already? I'll start your usual.", "Heard a crew from the Grid tried to start trouble last night. Didn't last long."}, {"For you, the back room's open. Best view of the sunrise in Neon.", "Regulars like you keep this place alive. First round's on the house — figuratively. I still need the till to balance."}}},
			{"velvet-circuit", {{"Welcome to the Velvet Circuit. Seats near the stage are earned, not bought.", "The show starts when the lights go violet."}, {"Nice to see a familiar face. The performers notice who comes back.", "Tonight's showcase has a new act. Don't leave early."}, {"Your table's ready, VIP. Front row.", "The house remembers its friends."}}},
			{"crown-casino", {{"Crown Casino never sleeps. House rules: no weapons drawn, no debts left unpaid.", "Watch the tables before you play them. The house always watches you."}, {"The dealers know your face now. That's good — mostly.", "High Roller Night brings out people who'd rather not be seen. Be polite."}, {"The private tables are open to you. Dorian's orders.", "A VIP in the Crown hears things. Keep what you hear to yourself."}}},
			{"grid-line-diner", {{"Grid Line Diner. Counter, booths, coffee that's been on since sundown. Sit.", "Night Shift Special's on the board. It fixes most things."}, {"Back again. The coffee remembers you.", "Late shift's been rough on the Grid. Everyone's eating double."}, {"Your stool's waiting. You're family here now, God help you.", "Regulars eat first. That's the rule, and I made it."}}},
		};
		const std::vector<FCastMember> VnCast = {
			{"pa-vex", "pulse-array", "Vex", "bouncer", 1.4, 3.1, "Hands visible, weapons holstered. You start something on my floor, you finish it outside.", {"You again. Floor's warm tonight.", "Keep it clean in there and we stay friends."}, {{"danced", "Saw you on the floor. Didn't trip over anyone. That's more than most."}, {"vip", "VIP rail's on the left. You know the way."}},
				{{"pa-vex-rules", "House rules", "No drawn steel, no deals on the floor, no Grid patches past the rope. Everything else is between you and the DJ.", "", std::nullopt},
				{"pa-vex-quiet", "Trouble lately?", "A crew in Grid jackets keep testing the back door. They never get past it. Tell your friends that.", "second-night", std::nullopt}}},
			{"pa-juno", "pulse-array", "Juno", "regular", 2.6, 0.8, "New face. The trick is the four-count: feel the kick, step on four.", {"Four-count, remember? Everything else is decoration.", "DJ changes the set every night. Same bones, new skin."}, {{"fourbeat", "You found the four! Told you it's all in the kick."}, {"danced", "Your footwork's getting less embarrassing."}},
				{{"pa-juno-fourbeat", "Teach me the four-count", "Stand on the floor, wait for the pulse, hit it on the beat. Four clean steps and you're dancing. Miss four and the floor eats you.", "", std::nullopt},
				{"pa-juno-set", "Tonight's set", "The set runs on the club's tempo and changes at midnight. Off-beats creep in once you're seven steps deep. Watch for them.", "danced", std::nullopt},
				{"pa-juno-rail", "The old light rig", "Before Pulse Array it was a freight shed. The old rig's still up in the rafters. Somebody tags it every year.", "third-night", FDiscovery{"Freight-shed light rig", 60, 80, {{"dataChip", 2}}}}}},
			{"ag-sable", "afterglow", "Sable", "bartender", -1.5, -4.6, "Kitchen's open till the sun comes up. The Sunrise Plate fixes most things.", {"The usual corner's free.", "You look like a long shift. Sit."}, {{"special", "Back for another plate? It's the hot sauce. Everyone comes back for the hot sauce."}, {"regular", "Night after night. You're a regular now, whether you like it or not."}},
				{{"ag-sable-plate", "What's in the Sunrise Plate?", "Eggs, flatbread, the green sauce and something from the coast I won't name. Keeps you mending for a while after.", "", std::nullopt},
				{"ag-sable-tour", "Where else eats this late?", "Velvet pours a decent Violet Hour, Crown does espresso that'll stop your heart, and Ma Ruiz runs a diner over in Nexus. Try them all.", "special", std::nullopt}}},
			{"ag-otto", "afterglow", "Otto", "regular", -3.2, 2, "Don't sit there, that's... fine, sit there. I'm Otto. I drive the dawn tram.", {"Tram's running late again. Always is.", "Afterglow at four in the morning is the only honest place in Neon."}, {{"danced", "You were on the floor at the sunrise set. Bold."}},
				{{"ag-otto-trams", "The dawn tram", "Maglev line, tower to tower. I see the whole city wake up. Mostly it wakes up angry.", "", std::nullopt},
				{"ag-otto-ledger", "Anything strange on your route?", "There's a stop the board says doesn't exist. Lights come on there some nights. I don't stop. Nobody asks me to.", "second-night", std::nullopt}}},
			{"vc-bram", "velvet-circuit", "Bram", "bouncer", 1.4, 3.1, "Lounge rules. Quiet voices, no recordings, tip the performers.", {"Evening.", "Showcase is worth your time tonight."}, {{"vip", "Front row's held for you."}},
				{{"vc-bram-show", "What's the show?", "Cabaret, live band, one act that does something with light I still can't explain. Starts when the room goes violet.", "", std::nullopt}}},
			{"vc-lena", "velvet-circuit", "Lena", "bartender", -3.3, -4.5, "Violet Hour? It's the house pour. Takes the edge off a bad day.", {"Same again?", "Quiet tonight. I like quiet."}, {{"special", "You came back for the Violet Hour. Good taste."}},
				{{"vc-lena-pour", "The Violet Hour", "Plum, smoke and a mineral from the frost country. Folks swear it makes them hard to hurt for a bit. Don't quote me.", "", std::nullopt}}},
			{"vc-ines", "velvet-circuit", "Ines", "regular", -3.2, 2, "You're blocking my view of the stage. Kidding. Sit.", {"The new act is good. Don't tell them I said so.", "I come for the music and leave before the speeches."}, {{"regular", "You keep turning up. We should form a club. A quiet one."}},
				{{"vc-ines-city", "Who comes here?", "Tower clerks, off-duty Aegis, a few people who'd rather not be named. The music's the only thing nobody argues about.", "", std::nullopt},
				{"vc-ines-booth", "The empty booth", "The far booth's kept empty every night. Reserved for someone who stopped coming. The staff still set a glass.", "second-night", FDiscovery{"The reserved booth", 50, 70, {{"energyToken", 2}}}}}},
			{"vc-cass", "velvet-circuit", "Cass", "regular", -0.2, -2.8, "Lena makes the best drink in Neon and she knows it.", {"Lena's in a mood. Order something easy.", "I used to perform here. Now I heckle politely."}, {},
				{{"vc-cass-stage", "You performed here?", "Six seasons. Then my hands started shaking. Now I come to watch. It's not worse, just different.", "", std::nullopt}}},
			{"cc-rook", "crown-casino", "Rook", "bouncer", 1.4, 3.1, "No weapons drawn, no debts left unpaid. The house watches everyone.", {"Lucky night?", "Dorian says hello. He doesn't."}, {{"jackpot", "Heard you broke the Pixel Pit. The cabinet's been sulking."}},
				{{"cc-rook-house", "Who runs the Crown?", "Dorian runs the floor. Who runs Dorian is a question people stop asking around here.", "", std::nullopt}}},
			{"cc-mags", "crown-casino", "Mags", "regular", 2.6, 0.8, "You here for the tables or the cabinet? The cabinet's honest at least.", {"Cabinet's faster tonight.", "I've lost more to that machine than to any table."}, {{"jackpot", "Jackpot! Buy me an espresso, you owe the room one."}},
				{{"cc-mags-pit", "Beating the Pixel Pit", "Don't press early, it counts as a miss. Wait for the light, then commit. Every round it gets meaner.", "", std::nullopt},
				{"cc-mags-chip", "The lucky chip", "Old house chip, wedged in the cabinet's coin return. Nobody's managed to get it out. You've got steady hands.", "jackpot", FDiscovery{"The cabinet's lucky chip", 80, 90, {{"dataShards", 1}}}}}},
			{"gl-ma", "grid-line-diner", "Ma Ruiz", "bartender", -1.5, -4.6, "Sit anywhere that isn't sticky. Night Shift Special's on the board.", {"Coffee's fresh. Ish.", "You eat yet? You don't look like you ate."}, {{"special", "Back for the special. I'll make it extra hot."}, {"regular", "Three nights running. Your stool's got your shape now."}},
				{{"gl-ma-diner", "How long's the diner been here?", "Before the towers, before the Fracture. My mother ran it for the rail crews. We kept the counter.", "", std::nullopt},
				{"gl-ma-crews", "Who comes in at night?", "Grid techs off the late shift, couriers, Guild runners. Everybody's tired, nobody's trouble. Mostly.", "second-night", std::nullopt}}},
			{"gl-deck", "grid-line-diner", "Deck", "regular", -1.4, 0.4, "Grid tech. Night shift. Don't ask me to fix your lights.", {"Three substations down tonight. Same three.", "Coffee and complaints, that's the shift."}, {{"regular", "You're a night person too. Respect."}},
				{{"gl-deck-grid", "What breaks on the Grid?", "Everything at the edges. The hub's fine. Out past the districts the lines hum wrong after dark.", "", std::nullopt},
				{"gl-deck-relay", "A relay nobody logged", "There's a relay box on a roof in the shipyard district that isn't on any map. It's warm. I put my hand on it once.", "third-night", FDiscovery{"The unlogged relay", 70, 80, {{"scrapMetal", 6}}}}}},
		};
		const std::vector<FSpecial> VnSpecials = {
			{"pulse-array", "Overdrive Tonic", "Citrus, guarana and a hum you feel in your teeth. Hit harder for a while.", 45, "ruinStone", 60},
			{"afterglow", "Sunrise Plate", "Eggs, flatbread and the green sauce. You keep mending for a while after.", 35, "healStim", 45},
			{"velvet-circuit", "Violet Hour", "Plum, smoke and frost mineral. Takes the edge off incoming fire.", 50, "armorStim", 90},
			{"crown-casino", "High Roller Espresso", "Thick enough to stand a spoon in. Sharpens your aim.", 40, "ruinStone", 45},
			{"grid-line-diner", "Night Shift Special", "Noodles, chilli oil, bottomless coffee. Patches you up between jobs.", 30, "healStim", 60},
		};
		const std::vector<std::pair<std::string, double>> VnFourBeatBpm = {{"pulse-array", 124}, {"afterglow", 108}, {"velvet-circuit", 96}};
		const std::vector<FDanceVenue> VnDanceVenues = {{"pulse-array", 124, 24}, {"afterglow", 108, 20}};
		const std::vector<FChallenge> VnChallenges = {
			{"four-beat", "pulse-array", "Four-Beat Dance", "Land the four-count on four different nights", 4, {120, 140, {{"energyToken", 2}}}},
			{"floor-filler", "afterglow", "Sunrise Set", "Score 4,000 or more on Afterglow's dance set", 1, {100, 120, {{"dataChip", 2}}}},
			{"meet-the-locals", "velvet-circuit", "Meet the Locals", "Get to know everyone at the Velvet Circuit", 4, {90, 110, {{"energyToken", 1}, {"dataChip", 1}}}},
			{"arcade-streak", "crown-casino", "Arcade Streak", "Hit the Pixel Pit jackpot on three nights", 3, {150, 160, {{"dataShards", 1}}}},
			{"tasting-tour", "afterglow", "Tasting Tour", "Try the house special at every venue in the city", 5, {140, 150, {{"gearParts", 4}}}},
			{"night-shift", "grid-line-diner", "Night Shift Regular", "Eat at the Grid Line Diner on three nights", 3, {80, 100, {{"scrapMetal", 8}}}},
		};

		bool VnHas(const FProgression& P, const std::string& Key) { return std::find(P.EarnedRewards.begin(), P.EarnedRewards.end(), Key) != P.EarnedRewards.end(); }
		double VnCount(const FProgression& P, const std::string& Prefix)
		{
			double N = 0;
			for (const std::string& K : P.EarnedRewards) if (K.rfind(Prefix, 0) == 0) ++N;
			return N;
		}
		bool VnAdd(FProgression& P, const std::string& Key)
		{
			if (VnHas(P, Key)) return false;
			P.EarnedRewards.push_back(Key);
			return true;
		}
		std::string VnTalkKey(const std::string& Npc, const std::string& Day) { return "venue-talk:" + Npc + "@" + Day; }
		std::string VnSpecialKey(const std::string& Venue, const std::string& Day) { return "special:" + Venue + "@" + Day; }
		/** JS Number(text) || 0 for the integer strings a best score is written as */
		double VnNumberOr0(const std::string& S)
		{
			if (S.empty()) return 0;
			double V = 0;
			const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
			if (R.ec != std::errc() || R.ptr != S.data() + S.size() || std::isnan(V)) return 0;
			return V;
		}
		/** venue-life.ts pay: a one-time Nex ledger claim, mission-scaled XP and materials */
		void VnPay(FProgression& P, const std::string& Key, double Nex, double Xp, const std::vector<std::pair<std::string, double>>& Materials)
		{
			P.NexLedger[Key] = Nex;
			P = reward::GrantXP(std::move(P), "MISSION", std::nullopt, std::nullopt, std::nullopt, Xp / 1200).Progression;
			for (const auto& [Id, Amount] : Materials) P.Materials[Id] += Amount;
		}
		const FTopic* VnTopicOpen(const FProgression& P, const FCastMember& C, const FTopic& T, double Nights)
		{
			const bool bOpen = T.Needs.empty() || (T.Needs == "second-night" ? Nights >= 2 : T.Needs == "third-night" ? Nights >= 3 : HasFact(P, C.Venue, T.Needs));
			return bOpen ? &T : nullptr;
		}
	}

	const std::vector<FVenue>& Venues() { return VnVenues; }
	const FHours* HoursOf(const std::string& Venue)
	{
		for (const FHours& H : VnHours) if (H.Venue == Venue) return &H;
		return nullptr;
	}
	bool InHours(double Open, double Close, double Hour)
	{
		if (Open == Close || (Open == 0 && Close == 24)) return true;
		return Open < Close ? Hour >= Open && Hour < Close : Hour >= Open || Hour < Close;
	}
	bool VenueOpen(const std::string& Venue, double Hour)
	{
		const FHours* H = HoursOf(Venue);
		return H ? InHours(H->Open, H->Close, Hour) : false;
	}
	const std::vector<FVenueEvent>& VenueEvents() { return VnEvents; }
	const FVenueEvent* VenueEventAt(const std::string& Venue, double Hour)
	{
		for (const FVenueEvent& E : VnEvents) if (E.Venue == Venue && InHours(E.Start, E.End, Hour)) return &E;
		return nullptr;
	}

	std::string DayOf(double NowMs) { return bounty::DayOf(NowMs); }
	double VenueStanding(const FProgression& P, const std::string& Venue) { return VnCount(P, "venue-visit:" + Venue + "@"); }
	bool IsVip(const FProgression& P, const std::string& Venue) { return VenueStanding(P, Venue) >= VipVisits; }
	bool RecordVenueVisit(FProgression& P, const std::string& Venue, double NowMs) { return VnAdd(P, "venue-visit:" + Venue + "@" + DayOf(NowMs)); }
	std::string HostOf(const std::string& Venue)
	{
		for (const auto& [Id, Host] : VnHosts) if (Id == Venue) return Host;
		return "";
	}
	std::vector<FLine> VenueDialogue(const std::string& Venue, double Standing, double Hour)
	{
		const size_t Tier = Standing >= VipVisits ? 2 : Standing >= 2 ? 1 : 0;
		std::string Speaker = HostOf(Venue);
		if (Speaker.empty()) Speaker = "Host";
		std::vector<FLine> Out;
		for (const auto& [Id, Tiers] : VnLines)
			if (Id == Venue && Tier < Tiers.size()) for (const std::string& Text : Tiers[Tier]) Out.push_back({Speaker, Text});
		if (const FVenueEvent* Ev = VenueEventAt(Venue, Hour)) Out.push_back({Speaker, "Tonight: " + Ev->Title + "."});
		return Out;
	}

	const std::vector<FCastMember>& Cast() { return VnCast; }
	const FCastMember* CastById(const std::string& Id)
	{
		for (const FCastMember& C : VnCast) if (C.Id == Id) return &C;
		return nullptr;
	}
	std::vector<const FCastMember*> CastAt(const std::string& Venue)
	{
		std::vector<const FCastMember*> Out;
		for (const FCastMember& C : VnCast) if (C.Venue == Venue) Out.push_back(&C);
		return Out;
	}
	double NightsTalked(const FProgression& P, const std::string& Npc) { return VnCount(P, "venue-talk:" + Npc + "@"); }
	bool HasFact(const FProgression& P, const std::string& Venue, const std::string& Fact)
	{
		if (Fact == "vip") return IsVip(P, Venue);
		if (Fact == "regular") return VenueStanding(P, Venue) >= 3;
		if (Fact == "danced") return DanceBest(P, Venue) > 0 || VnCount(P, "venue-danced:" + Venue + "@") > 0;
		return VnCount(P, "venue-" + Fact + ":" + Venue + "@") > 0;
	}
	void RecordFact(FProgression& P, const std::string& Venue, const std::string& Fact, double NowMs) { VnAdd(P, "venue-" + Fact + ":" + Venue + "@" + DayOf(NowMs)); }
	std::vector<const FTopic*> OpenTopics(const FProgression& P, const std::string& Npc, double NowMs)
	{
		std::vector<const FTopic*> Out;
		const FCastMember* C = CastById(Npc);
		if (!C) return Out;
		const double Nights = NightsTalked(P, Npc) + (VnHas(P, VnTalkKey(Npc, DayOf(NowMs))) ? 0 : 1);
		for (const FTopic& T : C->Topics) if (VnTopicOpen(P, *C, T, Nights)) Out.push_back(&T);
		return Out;
	}
	std::vector<FLine> Greeting(const FProgression& P, const std::string& Npc, double NowMs)
	{
		const FCastMember* C = CastById(Npc);
		if (!C) return {};
		const double Nights = NightsTalked(P, Npc);
		if (Nights == 0) return {{C->Name, C->First}};
		static const char* const Facts[6] = {"jackpot", "fourbeat", "special", "danced", "vip", "regular"};
		const std::string* Memory = nullptr;
		for (const char* F : Facts)
		{
			for (const auto& [Fact, Text] : C->Remembers)
				if (Fact == F && !Text.empty() && HasFact(P, C->Venue, Fact)) { Memory = &Text; break; }
			if (Memory) break;
		}
		const std::string Day = DayOf(NowMs);
		const double Code = static_cast<unsigned char>(Day.back());
		const std::string& Pick = C->Known[static_cast<size_t>(std::fmod(Nights + Code, static_cast<double>(C->Known.size())))];
		if (Memory) return {{C->Name, *Memory}, {C->Name, Pick}};
		return {{C->Name, Pick}};
	}
	void RecordTalk(FProgression& P, const std::string& Npc, double NowMs) { VnAdd(P, VnTalkKey(Npc, DayOf(NowMs))); }
	bool Discovered(const FProgression& P, const std::string& Topic) { return VnHas(P, "venue-discovery:" + Topic); }

	const std::vector<FSpecial>& Specials() { return VnSpecials; }
	const FSpecial* SpecialAt(const std::string& Venue)
	{
		for (const FSpecial& S : VnSpecials) if (S.Venue == Venue) return &S;
		return nullptr;
	}
	bool HadSpecialTonight(const FProgression& P, const std::string& Venue, double NowMs) { return P.NexLedger.count(VnSpecialKey(Venue, DayOf(NowMs))) > 0; }
	std::string OrderSpecial(FProgression& P, stash::FBuffs& Buffs, const std::string& Venue, double Hour, double NowMs)
	{
		const FSpecial* S = SpecialAt(Venue);
		if (!S) return "Nothing on the menu here";
		if (const FHours* H = HoursOf(Venue); H && !InHours(H->Open, H->Close, Hour)) return "The kitchen's closed";
		if (HadSpecialTonight(P, Venue, NowMs)) return "You've had the " + S->Name + " tonight";
		std::map<std::string, double> Ledger = P.NexLedger;
		if (!vehicle::SpendNex(Ledger, VnSpecialKey(Venue, DayOf(NowMs)), S->Price))
			return S->Name + " is " + js::NumberToString(S->Price) + " Nex (you have " + js::NumberToString(vehicle::NexBalance(P.NexLedger)) + ")";
		const auto Cur = Buffs.find(S->Buff);
		const bool bLive = Cur != Buffs.end() && Cur->second.Until > NowMs;
		const double Until = std::max(bLive ? Cur->second.Until : 0.0, NowMs + S->Seconds * 1000);
		const double Stacks = bLive ? std::max(1.0, Cur->second.Stacks) : 1.0;
		P.NexLedger = std::move(Ledger);
		RecordFact(P, Venue, "special", NowMs);
		Buffs[S->Buff] = {Stacks, Until};
		return "";
	}

	FFourBeat StartFourBeat(const std::string& Venue)
	{
		double Bpm = 110;
		for (const auto& [Id, B] : VnFourBeatBpm) if (Id == Venue) Bpm = B;
		FFourBeat S;
		S.Venue = Venue; S.BeatMs = 60000 / Bpm;
		return S;
	}
	double FourBeatPhase(const FFourBeat& S, double T) { return T < FourBeatLeadInMs ? 0 : std::fmod(T - FourBeatLeadInMs, S.BeatMs) / S.BeatMs; }
	FFourBeat FourBeatTick(const FFourBeat& S, double T)
	{
		if (S.bDone || T <= FourBeatTimeoutMs) return S;
		FFourBeat Out = S;
		Out.bDone = true; Out.bWon = false;
		return Out;
	}
	FTap FourBeatTap(const FFourBeat& S0, double T)
	{
		FFourBeat S = FourBeatTick(S0, T);
		if (S.bDone || !std::isfinite(T) || T < 0) return {S, ""};
		const double Rel = T - FourBeatLeadInMs;
		if (Rel < -S.BeatMs * FourBeatWindowFrac)
		{
			S.Misses += 1;
			S.bDone = S.Misses >= FourBeatMisses;
			return {S, "miss"};
		}
		const double Beat = js::Round(Rel / S.BeatMs);
		if (Beat == S.LastBeat) return {S, ""};
		const double Off = std::fabs(Rel - Beat * S.BeatMs);
		const bool bHit = Off <= S.BeatMs * FourBeatWindowFrac;
		S.LastBeat = Beat;
		S.Hits += bHit ? 1 : 0;
		S.Misses += bHit ? 0 : 1;
		S.bWon = S.Hits >= FourBeatHits;
		S.bDone = S.bWon || S.Misses >= FourBeatMisses;
		return {S, bHit ? "hit" : "miss"};
	}

	const std::vector<FChallenge>& Challenges() { return VnChallenges; }
	double ChallengeProgress(const FProgression& P, const FChallenge& C)
	{
		if (C.Id == "four-beat") return VnCount(P, "venue-fourbeat:pulse-array@");
		if (C.Id == "floor-filler") return DanceBest(P, "afterglow") >= 4000 ? 1 : 0;
		if (C.Id == "meet-the-locals")
		{
			double N = 0;
			for (const FCastMember* M : CastAt("velvet-circuit")) if (NightsTalked(P, M->Id) > 0) ++N;
			return N;
		}
		if (C.Id == "arcade-streak") return VnCount(P, "venue-jackpot:crown-casino@");
		if (C.Id == "tasting-tour")
		{
			double N = 0;
			for (const FSpecial& S : VnSpecials) if (VnCount(P, "venue-special:" + S.Venue + "@") > 0) ++N;
			return N;
		}
		if (C.Id == "night-shift") return VnCount(P, "venue-special:grid-line-diner@");
		return 0;
	}
	bool ChallengeClaimed(const FProgression& P, const std::string& Id) { return P.NexLedger.count("venue-challenge:" + Id) > 0; }
	std::vector<FPayout> ClaimChallenges(FProgression& P)
	{
		std::vector<FPayout> Paid;
		for (const FChallenge& C : VnChallenges)
		{
			if (ChallengeClaimed(P, C.Id) || ChallengeProgress(P, C) < C.Target) continue;
			VnPay(P, "venue-challenge:" + C.Id, C.Reward.Nex, C.Reward.Xp, C.Reward.Materials);
			Paid.push_back({C.Title, C.Reward});
		}
		return Paid;
	}
	std::optional<FPayout> ClaimDiscovery(FProgression& P, const FTopic& Topic)
	{
		if (!Topic.Discovery || Discovered(P, Topic.Id)) return std::nullopt;
		const FDiscovery& D = *Topic.Discovery;
		VnPay(P, "venue-discovery-pay:" + Topic.Id, D.Nex, D.Xp, D.Materials);
		VnAdd(P, "venue-discovery:" + Topic.Id);
		return FPayout{D.Title, FReward{D.Nex, D.Xp, D.Materials}};
	}
	std::string RewardText(const FReward& R)
	{
		std::vector<std::string> Parts;
		if (R.Nex != 0) Parts.push_back("+" + js::NumberToString(R.Nex) + " Nex");
		if (R.Xp != 0) Parts.push_back("+" + js::NumberToString(R.Xp) + " XP");
		for (const auto& [Id, Amount] : R.Materials)
		{
			std::string Name;
			for (const char C : Id)
			{
				if (C >= 'A' && C <= 'Z') { Name += ' '; Name += static_cast<char>(C - 'A' + 'a'); }
				else Name += static_cast<char>(C >= 'A' && C <= 'Z' ? C - 'A' + 'a' : C);
			}
			Parts.push_back("+" + js::NumberToString(Amount) + " " + Name);
		}
		std::string Out;
		for (const std::string& X : Parts) { if (X.empty()) continue; if (!Out.empty()) Out += " · "; Out += X; }
		return Out;
	}

	bool IsDanceVenue(const std::string& Venue)
	{
		for (const FDanceVenue& D : VnDanceVenues) if (D.Venue == Venue) return true;
		return false;
	}
	std::vector<FBeat> DanceSet(const std::string& Venue, const std::string& Day)
	{
		double Bpm = 116, Beats = 20;
		for (const FDanceVenue& D : VnDanceVenues) if (D.Venue == Venue) { Bpm = D.Bpm; Beats = D.Beats; }
		uint32_t Seed = js::Fnv1a(Venue + "@" + Day);
		auto R = [&Seed]() { Seed = Seed * 1664525u + 1013904223u; return static_cast<double>(Seed) / 4294967296.0; };
		const double Step = 60 / Bpm;
		std::vector<FBeat> Out;
		double T = DanceLeadIn;
		int Last = -1;
		for (int I = 0; I < static_cast<int>(Beats); ++I)
		{
			int A = static_cast<int>(std::floor(R() * 4));
			if (A == Last && R() < 0.6) A = (A + 1 + static_cast<int>(std::floor(R() * 3))) % 4;
			Out.push_back({T, static_cast<EArrow>(A), ""});
			Last = A;
			T += I > 6 && R() < 0.25 ? Step / 2 : Step;
		}
		return Out;
	}
	std::string Press(std::vector<FBeat>& Beats, EArrow Arrow, double Now)
	{
		for (FBeat& B : Beats)
		{
			if (!B.Hit.empty() || B.Arrow != Arrow || std::fabs(B.T - Now) > WindowMiss) continue;
			const double D = std::fabs(B.T - Now);
			B.Hit = D <= WindowPerfect ? "perfect" : D <= WindowGood ? "good" : "miss";
			return B.Hit;
		}
		return "";
	}
	int Expire(std::vector<FBeat>& Beats, double Now)
	{
		int N = 0;
		for (FBeat& B : Beats) if (B.Hit.empty() && Now - B.T > WindowMiss) { B.Hit = "miss"; ++N; }
		return N;
	}
	bool Finished(const std::vector<FBeat>& Beats)
	{
		for (const FBeat& B : Beats) if (B.Hit.empty()) return false;
		return true;
	}
	FDanceResult Result(const std::vector<FBeat>& Beats)
	{
		FDanceResult R;
		double Combo = 0;
		for (const FBeat& B : Beats)
		{
			if (B.Hit == "perfect" || B.Hit == "good") { Combo += 1; R.BestCombo = std::max(R.BestCombo, Combo); }
			else Combo = 0;
			if (B.Hit == "perfect") R.Perfect += 1;
			else if (B.Hit == "good") R.Good += 1;
		}
		R.Miss = static_cast<double>(Beats.size()) - R.Perfect - R.Good;
		R.Score = R.Perfect * PointsPerfect + R.Good * PointsGood + R.BestCombo * 20;
		const double Pct = (R.Perfect + R.Good * 0.5) / std::max(1.0, static_cast<double>(Beats.size()));
		R.Grade = Pct >= 0.95 ? "S" : Pct >= 0.8 ? "A" : Pct >= 0.6 ? "B" : Pct >= 0.4 ? "C" : "D";
		return R;
	}
	double DanceBest(const FProgression& P, const std::string& Venue)
	{
		const std::string Prefix = "venue-best:" + Venue + ":";
		double Best = 0;
		for (const std::string& K : P.EarnedRewards) if (K.rfind(Prefix, 0) == 0) Best = std::max(Best, VnNumberOr0(K.substr(Prefix.size())));
		return Best;
	}
	bool RecordDance(FProgression& P, const std::string& Venue, double Score)
	{
		if (Score <= DanceBest(P, Venue)) return false;
		const std::string Prefix = "venue-best:" + Venue + ":";
		std::vector<std::string> Keep;
		for (const std::string& K : P.EarnedRewards) if (K.rfind(Prefix, 0) != 0) Keep.push_back(K);
		Keep.push_back(Prefix + js::NumberToString(js::Round(Score)));
		P.EarnedRewards = std::move(Keep);
		return true;
	}
}
