// Golden test for the C++ class abilities: replays tools/gen-ability-golden.ts, recorded from the web build's real
// ability-effects.ts castAbility / holdDisabledField / cancelAbilities / syncSimFromLive, live-build.ts, ability-hud.ts,
// branch-effects.ts, subclass-verbs.ts, operator-abilities.ts, operators.ts and progression.ts selectAbilityBranch.
// The build, events, world calls and HUD must match exactly; positions from sin / cos / atan2 compare to 1e-9.
#include "Core/WFAbilityCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::ability;

namespace
{
	const std::string None = "~";
	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S) { if (C == Sep) { Out.push_back(Cur); Cur.clear(); } else Cur += C; }
		Out.push_back(Cur);
		return Out;
	}
	double Num(const std::string& S)
	{
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::string N(double V) { return js::NumberToString(V); }

	int Checks = 0, Mismatches = 0;
	void Fail(int Line, const std::string& What)
	{
		if (++Mismatches <= 25) std::fprintf(stderr, "line %d: %s\n", Line, What.c_str());
	}
	/** Compares two texts token by token: numbers to 1e-9 relative, everything else exactly. */
	bool NumberLike(const std::string& S, double& V)
	{
		if (S.empty()) return false;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		return R.ec == std::errc() && R.ptr == S.data() + S.size();
	}
	std::vector<std::string> Tokens(const std::string& S)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S)
		{
			if (C == '|' || C == '/' || C == ';' || C == ',' || C == ':' || C == '=' || C == '\t') { Out.push_back(Cur); Out.push_back(std::string(1, C)); Cur.clear(); }
			else Cur += C;
		}
		Out.push_back(Cur);
		return Out;
	}
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got == Want) return;
		const std::vector<std::string> G = Tokens(Got), W = Tokens(Want);
		bool bOk = G.size() == W.size();
		for (size_t I = 0; bOk && I < G.size(); ++I)
		{
			if (G[I] == W[I]) continue;
			double A = 0, B = 0;
			bOk = NumberLike(G[I], A) && NumberLike(W[I], B) && std::fabs(A - B) <= 1e-9 * std::max(1.0, std::fabs(B));
		}
		if (!bOk) Fail(Line, std::string(What) + ":\n   got  " + Got + "\n   want " + Want);
	}

	struct FObstacle { double X = 0, Z = 0, R = 0; };
	class FTestWorld : public IWorld
	{
	public:
		double NowS = 0;
		std::vector<std::string> Log;
		std::vector<FObstacle> Obstacles;
		double IframesV = 0, BarrierV = 0, DomeV = 0, NoiseV = 0, CombatHeat = 0, LastHit = 0;
		double Now() const override { return NowS; }
		double DamageMods(std::vector<FMachine>&, size_t I, double Dmg, const std::string& Element, double X, double Z) override
		{
			Log.push_back("dmg:" + std::to_string(I) + ":" + N(Dmg) + ":" + Element + ":" + N(X) + ":" + N(Z));
			return Dmg * 0.9;
		}
		void Defeat(std::vector<FMachine>& Ms, size_t I) override
		{
			Log.push_back("defeat:" + std::to_string(I));
			if (Ms[I].Hp <= 0) Ms[I].bAlive = false;
		}
		void Alert(const std::string& Text) override { Log.push_back("alert:" + Text); }
		bool Blocked(double X, double Z) const override
		{
			for (const FObstacle& O : Obstacles) if (std::hypot(X - O.X, Z - O.Z) < 1.0 + O.R) return true;
			return false;
		}
		void BossPoise(std::vector<FMachine>&, size_t, double Amount) override { Log.push_back("poise:" + N(Amount)); }
		void SpawnVolatileZone(double X, double Z, double Radius, double Dps, double Duration) override { Log.push_back("volatile:" + N(X) + ":" + N(Z) + ":" + N(Radius) + ":" + N(Dps) + ":" + N(Duration)); }
		void PlaceRiftTurret(double X, double Z, double Duration) override { Log.push_back("turret:" + N(X) + ":" + N(Z) + ":" + N(Duration)); }
		void Iframes(double S) override { IframesV = std::max(IframesV, S); }
		void Barrier(double S) override { BarrierV = std::max(BarrierV, S); }
		void Dome(double S) override { DomeV = std::max(DomeV, S); }
		void Noise() override { NoiseV = 1; }
		void Hit() override { LastHit = NowS * 1000; CombatHeat += 1.5; }
		void ClearDefences() override { IframesV = 0; BarrierV = 0; DomeV = 0; }
	};

	std::string LiveText(const FLiveBuild& L)
	{
		auto SlotOf = [&L](const char* S) { const auto It = L.Equipped.Slots.find(S); return It == L.Equipped.Slots.end() ? std::string() : It->second; };
		std::string Slots3 = SlotOf("PRIMARY") + "," + SlotOf("TACTICAL") + "," + SlotOf("ULTIMATE");
		std::string Br;
		for (const auto& [K, V] : L.Branches) { if (!Br.empty()) Br += ","; Br += K + "=" + V; }
		std::string Rt;
		for (const char* S : wf::ability::Slots)
		{
			const FRuntime& R = L.Runtime.at(S);
			if (!Rt.empty()) Rt += ",";
			Rt += R.State + "/" + N(R.Cooldown) + "/" + N(R.ActiveFor);
		}
		const std::string Pending = L.PendingVerb ? L.PendingVerb->Verb + "/" + N(L.PendingVerb->Magnitude) + "/" + N(L.PendingVerb->Duration) + "/" + N(L.PendingVerb->Radius) : None;
		return Slots3 + "|" + L.Equipped.Mode + "|" + Br + "|" + Rt + "|" + N(L.Energy) + "|" + L.Effect + "|" + N(L.EffectTime) + "|" + L.Threat + "|" + N(L.DamageMultiplier) + "|" + N(L.ShieldReflect)
			+ "|" + N(L.DashTime) + "|" + N(L.HackTime) + "|" + N(L.FieldTime) + "|" + N(L.Momentum) + "|" + N(L.SiegeTime) + "|" + N(L.VeilTime) + "|" + (L.VerbKind.empty() ? None : L.VerbKind)
			+ "|" + N(L.VerbTime) + "|" + N(L.VerbMagnitude) + "|" + Pending + "|" + N(L.StrikeBoost) + "|" + N(L.SiegeBoost);
	}
	std::string SimText(const std::vector<FMachine>& Ms, const FTestWorld& W)
	{
		std::string S;
		for (size_t I = 0; I < Ms.size(); ++I)
		{
			const FMachine& M = Ms[I];
			if (I) S += ";";
			S += std::string(M.bAlive ? "1" : "0") + "/" + N(M.X) + "/" + N(M.Z) + "/" + N(M.Hp) + "/" + (M.bBoss ? "1" : "0") + "/" + N(M.Aim) + "/" + N(M.Cool) + "/" + N(M.VulnUntil) + "/" + N(M.VulnMult);
		}
		return S + "|" + N(W.IframesV) + "|" + N(W.BarrierV) + "|" + N(W.DomeV) + "|" + N(W.NoiseV) + "|" + N(W.CombatHeat) + "|" + N(W.LastHit);
	}
	std::string EventText(const FEvent& E)
	{
		return N(E.Id) + "/" + E.Kind + "/" + E.AbilityId + "/" + E.Slot + "/" + E.Effect + "/" + N(E.X) + "/" + N(E.Z) + "/" + N(E.Radius) + "/" + N(E.Duration) + "/" + (E.FromX ? N(*E.FromX) : None) + "/" + (E.FromZ ? N(*E.FromZ) : None)
			+ "/" + std::to_string(E.Hits) + "/" + std::to_string(E.BossHits) + "/" + std::to_string(E.Kills) + "/" + (E.Reason.empty() ? None : E.Reason) + "/" + N(E.At);
	}
	std::string HudText(const FLiveBuild& L)
	{
		std::string S;
		for (const FHudRow& H : AbilityHud(L))
		{
			if (!S.empty()) S += ";";
			S += H.Slot + "/" + H.Key + "/" + H.Id + "/" + H.Name + "/" + H.State + "/" + (H.bReady ? "1" : "0") + "/" + N(H.Cooldown) + "/" + N(H.CooldownMax) + "/" + N(H.Cost);
		}
		return S;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: %s golden.txt\n", Argv[0]); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	int Cases = 0, Casts = 0, Ops = 0, TurretSteps = 0;
	FTestWorld World;
	std::vector<FMachine> Ms;
	FLiveBuild Live;
	FEventLog Log;
	std::string Subclass, Environment;
	double Energy0 = 100;
	double X = 0, Z = 0, Yaw = 0;
	// a build block: B then BR lines
	auto ReadBuild = [&](size_t& I, FBuild& OutB, std::map<std::string, std::string>& OutBr) {
		const std::vector<std::string> F = Split(Lines[I], '\t');
		OutB.Mode = F[1];
		OutB.Slots = {{"PRIMARY", F[2]}, {"TACTICAL", F[3]}, {"ULTIMATE", F[4]}};
		OutBr.clear();
		while (I + 1 < Lines.size() && Lines[I + 1].rfind("BR\t", 0) == 0) { const auto G = Split(Lines[++I], '\t'); OutBr[G[1]] = G[2]; }
	};
	std::vector<FRiftTurret> Turrets;
	std::vector<FMachine> TurretTargets;

	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const int LineNo = static_cast<int>(I) + 1;
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const std::string& T = F[0];
		if (T == "C")
		{
			++Cases;
			Subclass = F[2] == None ? "" : F[2];
			Environment = F[3];
			Energy0 = Num(F[4]);
			World = FTestWorld{};
			Log = FEventLog{};
			Log.NextId = Num(F[5]);
			Ms.clear();
			X = Z = Yaw = 0;
		}
		else if (T == "S") { World.IframesV = Num(F[1]); World.BarrierV = Num(F[2]); World.DomeV = Num(F[3]); World.NoiseV = Num(F[4]); World.CombatHeat = Num(F[5]); World.LastHit = Num(F[6]); }
		else if (T == "B")
		{
			FBuild B; std::map<std::string, std::string> Br;
			ReadBuild(I, B, Br);
			Live = CreateLiveBuild(B, Br);
			Live.Energy = Energy0;
		}
		else if (T == "OB") World.Obstacles.push_back({Num(F[1]), Num(F[2]), Num(F[3])});
		else if (T == "M")
		{
			FMachine M;
			M.bAlive = F[1] == "1"; M.X = Num(F[2]); M.Z = Num(F[3]); M.Hp = Num(F[4]); M.bBoss = F[5] == "1"; M.Aim = Num(F[6]); M.Cool = Num(F[7]); M.VulnUntil = Num(F[8]); M.VulnMult = Num(F[9]);
			Ms.push_back(M);
		}
		else if (T == "CAST")
		{
			++Casts; ++Ops;
			World.Log.clear();
			World.NowS = Num(F[6]);
			X = Num(F[2]); Z = Num(F[3]); Yaw = Num(F[4]);
			FCastContext Ctx; Ctx.Environment = Environment; Ctx.SubclassId = Subclass; Ctx.bInVehicle = F[5] == "1";
			const FCastResult R = CastAbility(World, Ms, Live, Log, F[1], {X, Z, Yaw}, Ctx);
			if (R.bOk) { X = R.Pose.X; Z = R.Pose.Z; Yaw = R.Pose.Yaw; }
			const std::vector<std::string> W = Split(Lines[++I], '\t');
			Same(LineNo + 1, "cast", std::string(R.bOk ? "1" : "0") + "\t" + (R.bOk ? None : R.Reason) + "\t" + (R.bOk ? None : R.Text) + "\t" + N(X) + "\t" + N(Z) + "\t" + N(Yaw) + "\t" + (R.Config ? R.Config->Id : None) + "\t" + EventText(R.Event),
				Lines[I].substr(3));
			X = Num(W[4]); Z = Num(W[5]); Yaw = Num(W[6]); // follow the recorded pose so ulp drift cannot compound
		}
		else if (T == "TICK")
		{
			++Ops;
			World.Log.clear();
			const double Dt = Num(F[1]);
			TickLiveBuild(Live, Dt, Num(F[2]));
			World.NowS += Dt;
			for (FMachine& M : Ms) M.Cool = std::max(0.0, M.Cool - Dt);
			World.IframesV = std::max(0.0, World.IframesV - Dt); World.BarrierV = std::max(0.0, World.BarrierV - Dt); World.DomeV = std::max(0.0, World.DomeV - Dt);
		}
		else if (T == "MOVE") { X = Num(F[1]); Z = Num(F[2]); Yaw = Num(F[3]); }
		else if (T == "AIM") Ms[static_cast<size_t>(Num(F[1]))].Aim = Num(F[2]);
		else if (T == "REBIND")
		{
			++Ops;
			World.Log.clear();
			++I;
			FBuild B; std::map<std::string, std::string> Br;
			ReadBuild(I, B, Br);
			Live = RebindLiveBuild(Live, B, Br);
		}
		else if (T == "HOLD") { ++Ops; World.Log.clear(); HoldDisabledField(Ms, Live, {Num(F[1]), Num(F[2]), Yaw}); }
		else if (T == "CANCEL")
		{
			++Ops;
			World.Log.clear();
			World.NowS = Num(F[3]);
			Live = CancelAbilities(World, Live, Log, {Num(F[1]), Num(F[2]), Yaw});
			std::vector<std::string> Want;
			while (I + 1 < Lines.size() && Lines[I + 1].rfind("EV\t", 0) == 0) Want.push_back(Lines[++I].substr(3));
			const size_t From = Log.Events.size() > Want.size() ? Log.Events.size() - Want.size() : 0;
			for (size_t K = 0; K < Want.size(); ++K) Same(LineNo, "cancel event", From + K < Log.Events.size() ? EventText(Log.Events[From + K]) : None, Want[K]);
		}
		else if (T == "L")
		{
			std::string Got;
			for (const std::string& S : World.Log) { if (!Got.empty()) Got += ";"; Got += S; }
			Same(LineNo, "world calls", Got.empty() ? None : Got, F[1]);
		}
		else if (T == "X") Same(LineNo, "state", LiveText(Live) + "\t" + SimText(Ms, World), F[1] + "\t" + F[2]);
		else if (T == "HUD") Same(LineNo, "hud", HudText(Live), F[1]);
		else if (T == "SY")
		{
			const FSimMods M = SyncSimFromLive(Live);
			Same(LineNo, "sync", N(M.VerbDamageMult) + "\t" + N(M.StealthMult) + "\t" + N(M.VerbIncomingMult), F[1] + "\t" + F[2] + "\t" + F[3]);
		}
		else if (T == "SEL")
		{
			FProgression P;
			P.CalibrationTokens = Num(F[1]);
			SelectAbilityBranch(P, F[2], F[3]);
			const auto It = P.AbilityBranches.find(F[2]);
			Same(LineNo, "select branch", N(P.CalibrationTokens) + "\t" + (It == P.AbilityBranches.end() ? None : It->second), F[4] + "\t" + F[5]);
		}
		else if (T == "TC") { Turrets.clear(); TurretTargets.clear(); }
		else if (T == "TT") { FMachine M; M.X = Num(F[1]); M.Z = Num(F[2]); M.bAlive = F[3] == "1"; TurretTargets.push_back(M); }
		else if (T == "TD")
		{
			Turrets = DeployRiftTurret(Turrets, Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]));
			std::string Got;
			for (const FRiftTurret& Tu : Turrets) { if (!Got.empty()) Got += ";"; Got += N(Tu.X) + "/" + N(Tu.Z) + "/" + N(Tu.Until); }
			Same(LineNo, "deploy", Got, F.size() > 5 ? F[5] : "");
		}
		else if (T == "TS")
		{
			++TurretSteps;
			std::string Hits, State;
			for (FRiftTurret& Tu : Turrets) { if (!Hits.empty()) Hits += ","; Hits += std::to_string(StepRiftTurret(Tu, TurretTargets, Num(F[1]))); }
			for (const FRiftTurret& Tu : Turrets) { if (!State.empty()) State += ";"; State += N(Tu.Cool) + "/" + N(Tu.Rot) + "/" + N(Tu.Flash); }
			Same(LineNo, "turret step", Hits + "\t" + State, (F.size() > 2 ? F[2] : "") + "\t" + (F.size() > 3 ? F[3] : ""));
		}
		else if (T == "BR" || T == "EV" || T == "RC") Fail(LineNo, "stray " + T);
		else Fail(LineNo, "unknown line " + T);
	}

	// the save side: the equip rule and legacy ids
	{
		FProgression P;
		std::string Err;
		Same(0, "equip covenant locked", EquipAbility(P, "ash-nova", Err) ? "1" : "0", "0");
		P.UnlockedAbilities.push_back("ash-nova");
		Same(0, "equip covenant bonded", EquipAbility(P, "ash-nova", Err) ? "1" : "0", "1");
		Same(0, "equipped tactical", P.ActiveBuildSlots["TACTICAL"], "ash-nova");
		Same(0, "equip shadow strike (30 <= combat 34)", EquipAbility(P, "shadow-strike", Err) ? "1" : "0", "1");
		Same(0, "legacy id", MigrateAbilityId("time-split"), "shadow-strike");
	}

	std::printf("%d cases, %d operations (%d casts), %d turret steps, %d checks, %d mismatches\n", Cases, Ops, Casts, TurretSteps, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
