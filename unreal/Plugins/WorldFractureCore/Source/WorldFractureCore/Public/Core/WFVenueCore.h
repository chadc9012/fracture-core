// World Fracture — the cities' nightlife: Neon City's four venues (Pulse Array, Afterglow, the Velvet Circuit, Crown
// Casino) and Nexus City's Grid Line Diner. Their hours and nightly events, your visits and VIP standing, the hosts' and
// the regulars' talk (topics that open as people get to know you, a few of them discoveries that pay once), the house
// specials (one a night, paid in Nex, one stack of a stim buff), the Four-Beat Dance, the clubs' dance sets and best
// scores, and the venue challenges.
//
// Everything is remembered in the main save as earnedRewards keys (one per venue / person per UTC day) and Nex ledger
// claims; nothing here runs a second progression pipeline. Dialogue is ambient city talk, never story spoilers.
//
// Port of the web build's authoritative rules:
//   nightlife.ts   VENUES, VENUE_HOURS, inHours, venueOpen, VENUE_EVENTS, venueEvent, VIP_VISITS, venueStanding, isVip,
//                  recordVenueVisit, VENUE_HOST, venueDialogue
//   venue-life.ts  NEXUS_DINER, CAST, castAt, nightsTalked, hasFact, recordFact, openTopics, greeting, recordTalk,
//                  discovered, SPECIALS, orderSpecial, the Four-Beat Dance, CHALLENGES, claimChallenges, claimDiscovery,
//                  rewardText
//   dance.ts       DANCE_VENUES, danceSet, press, expire, finished, result, danceBest, recordDance
// The venue doors (venue-doors.ts) are exported to DataTables/Venues.json. Golden-tested (Tests/VenueCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"
#include "Core/WFStashCore.h"

#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace wf::venue
{
	struct FVenue { std::string Id, Name, Sub, Kind, Color, Accent; double Dx = 0, Dz = 0; };
	WORLDFRACTURECORE_API const std::vector<FVenue>& Venues();
	struct FHours { std::string Venue; double Open = 0, Close = 0; };
	WORLDFRACTURECORE_API const FHours* HoursOf(const std::string& Venue);
	/** a close earlier than the open runs past midnight; 0-24 (or open == close) is always open */
	WORLDFRACTURECORE_API bool InHours(double Open, double Close, double Hour);
	WORLDFRACTURECORE_API bool VenueOpen(const std::string& Venue, double Hour);
	struct FVenueEvent { std::string Id, Venue, Title; double Start = 0, End = 0; };
	WORLDFRACTURECORE_API const std::vector<FVenueEvent>& VenueEvents();
	WORLDFRACTURECORE_API const FVenueEvent* VenueEventAt(const std::string& Venue, double Hour);

	inline constexpr double VipVisits = 5;
	inline const std::string NexusDiner = "grid-line-diner";
	WORLDFRACTURECORE_API std::string DayOf(double NowMs);
	/** nights visited (distinct days) */
	WORLDFRACTURECORE_API double VenueStanding(const FProgression& P, const std::string& Venue);
	WORLDFRACTURECORE_API bool IsVip(const FProgression& P, const std::string& Venue);
	/** one visit per venue per day; false when today's visit is already recorded */
	WORLDFRACTURECORE_API bool RecordVenueVisit(FProgression& P, const std::string& Venue, double NowMs);
	WORLDFRACTURECORE_API std::string HostOf(const std::string& Venue); // "" = none
	struct FLine { std::string Speaker, Text; };
	/** the host's greeting (standing counted before today's visit), plus tonight's event */
	WORLDFRACTURECORE_API std::vector<FLine> VenueDialogue(const std::string& Venue, double Standing, double Hour);

	struct FReward { double Nex = 0, Xp = 0; std::vector<std::pair<std::string, double>> Materials; };
	struct FDiscovery { std::string Title; double Nex = 0, Xp = 0; std::vector<std::pair<std::string, double>> Materials; };
	struct FTopic { std::string Id, Title, Text, Needs; /* "" | a fact | second-night | third-night */ std::optional<FDiscovery> Discovery; };
	struct FCastMember
	{
		std::string Id, Venue, Name, Role; // bouncer | bartender | regular
		double SpotX = 0, SpotZ = 0;       // room-local metres in the venue's pocket room
		std::string First;
		std::vector<std::string> Known;
		std::vector<std::pair<std::string, std::string>> Remembers; // fact -> line
		std::vector<FTopic> Topics;
	};
	WORLDFRACTURECORE_API const std::vector<FCastMember>& Cast();
	WORLDFRACTURECORE_API const FCastMember* CastById(const std::string& Id);
	WORLDFRACTURECORE_API std::vector<const FCastMember*> CastAt(const std::string& Venue);
	WORLDFRACTURECORE_API double NightsTalked(const FProgression& P, const std::string& Npc);
	/** danced | fourbeat | jackpot | special | vip | regular */
	WORLDFRACTURECORE_API bool HasFact(const FProgression& P, const std::string& Venue, const std::string& Fact);
	/** remember something done at a venue tonight (danced | fourbeat | jackpot | special), once a venue a night */
	WORLDFRACTURECORE_API void RecordFact(FProgression& P, const std::string& Venue, const std::string& Fact, double NowMs);
	/** the topics this person will talk about now (counting tonight's conversation) */
	WORLDFRACTURECORE_API std::vector<const FTopic*> OpenTopics(const FProgression& P, const std::string& Npc, double NowMs);
	/** a first meeting, or a line that shows they remember you (and what you did) */
	WORLDFRACTURECORE_API std::vector<FLine> Greeting(const FProgression& P, const std::string& Npc, double NowMs);
	WORLDFRACTURECORE_API void RecordTalk(FProgression& P, const std::string& Npc, double NowMs);
	WORLDFRACTURECORE_API bool Discovered(const FProgression& P, const std::string& Topic);

	struct FSpecial { std::string Venue, Name, Blurb; double Price = 0; std::string Buff; double Seconds = 0; };
	WORLDFRACTURECORE_API const std::vector<FSpecial>& Specials();
	WORLDFRACTURECORE_API const FSpecial* SpecialAt(const std::string& Venue);
	WORLDFRACTURECORE_API bool HadSpecialTonight(const FProgression& P, const std::string& Venue, double NowMs);
	/** one special a venue a night, paid in Nex: one stack of its buff for its duration (never shortening a longer one).
	 *  Returns "" and changes P and Buffs, or the refusal and changes nothing. */
	WORLDFRACTURECORE_API std::string OrderSpecial(FProgression& P, stash::FBuffs& Buffs, const std::string& Venue, double Hour, double NowMs);

	/** the Four-Beat Dance: tap on the club's beat; four clean hits win, four misses or 15 s lose. Times in ms from the start. */
	inline constexpr double FourBeatHits = 4, FourBeatMisses = 4, FourBeatTimeoutMs = 15000, FourBeatWindowFrac = 0.3, FourBeatLeadInMs = 1200;
	struct FFourBeat { std::string Venue; double BeatMs = 0, Hits = 0, Misses = 0, LastBeat = -1; bool bDone = false, bWon = false; };
	WORLDFRACTURECORE_API FFourBeat StartFourBeat(const std::string& Venue);
	WORLDFRACTURECORE_API double FourBeatPhase(const FFourBeat& S, double T);
	WORLDFRACTURECORE_API FFourBeat FourBeatTick(const FFourBeat& S, double T);
	/** Grade: "hit" | "miss" | "" (ignored) */
	struct FTap { FFourBeat State; std::string Grade; };
	WORLDFRACTURECORE_API FTap FourBeatTap(const FFourBeat& S, double T);

	struct FChallenge { std::string Id, Venue, Title, Blurb; double Target = 0; FReward Reward; };
	WORLDFRACTURECORE_API const std::vector<FChallenge>& Challenges();
	WORLDFRACTURECORE_API double ChallengeProgress(const FProgression& P, const FChallenge& C);
	WORLDFRACTURECORE_API bool ChallengeClaimed(const FProgression& P, const std::string& Id);
	struct FPayout { std::string Title; FReward Reward; };
	/** claims every finished, unclaimed challenge (a claimed one never pays twice) */
	WORLDFRACTURECORE_API std::vector<FPayout> ClaimChallenges(FProgression& P);
	/** a discovery pays once, when its topic is first heard */
	WORLDFRACTURECORE_API std::optional<FPayout> ClaimDiscovery(FProgression& P, const FTopic& Topic);
	WORLDFRACTURECORE_API std::string RewardText(const FReward& R);

	// the clubs' dance floor (dance.ts): tonight's set is seeded by venue and day; times in seconds since the set started
	enum class EArrow : int { Left, Up, Down, Right };
	inline const char* const ArrowNames[4] = {"left", "up", "down", "right"};
	inline constexpr double DanceLeadIn = 2, WindowPerfect = 0.08, WindowGood = 0.16, WindowMiss = 0.25, PointsPerfect = 300, PointsGood = 100;
	struct FBeat { double T = 0; EArrow Arrow = EArrow::Left; std::string Hit; /* "" | perfect | good | miss */ };
	WORLDFRACTURECORE_API bool IsDanceVenue(const std::string& Venue);
	WORLDFRACTURECORE_API std::vector<FBeat> DanceSet(const std::string& Venue, const std::string& Day);
	/** judges the earliest unjudged beat of that arrow inside the window; "" = nothing to judge */
	WORLDFRACTURECORE_API std::string Press(std::vector<FBeat>& Beats, EArrow Arrow, double Now);
	/** beats that slid past the line unplayed count as misses */
	WORLDFRACTURECORE_API int Expire(std::vector<FBeat>& Beats, double Now);
	WORLDFRACTURECORE_API bool Finished(const std::vector<FBeat>& Beats);
	struct FDanceResult { double Score = 0, Perfect = 0, Good = 0, Miss = 0, BestCombo = 0; std::string Grade; };
	WORLDFRACTURECORE_API FDanceResult Result(const std::vector<FBeat>& Beats);
	WORLDFRACTURECORE_API double DanceBest(const FProgression& P, const std::string& Venue);
	/** keeps one key a venue (the best); false when the score is not a new best */
	WORLDFRACTURECORE_API bool RecordDance(FProgression& P, const std::string& Venue, double Score);
}
