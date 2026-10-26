#include "Core/WFFoundryCore.h"

#include <cstdint>
#include <initializer_list>
#include <vector>

namespace wf::foundry
{
	namespace
	{
		bool FdWeaponSlot(const std::string& Slot) { return Slot == "primary" || Slot == "secondary" || Slot == "heavy"; }
		bool FdWord(char C) { return (C >= 'a' && C <= 'z') || (C >= 'A' && C <= 'Z') || (C >= '0' && C <= '9') || C == '_'; }
		/** a case-insensitive /a|b|c/i over ASCII (the patterns are ASCII; JavaScript does not fold other letters into them) */
		bool FdAny(const std::string& Lower, std::initializer_list<const char*> Words)
		{
			for (const char* W : Words) if (Lower.find(W) != std::string::npos) return true;
			return false;
		}
		/** /\bmg\b/i */
		bool FdMg(const std::string& Lower)
		{
			for (size_t I = Lower.find("mg"); I != std::string::npos; I = Lower.find("mg", I + 1))
				if ((I == 0 || !FdWord(Lower[I - 1])) && (I + 2 >= Lower.size() || !FdWord(Lower[I + 2]))) return true;
			return false;
		}
		/** foundries.ts hash: FNV-1a over `for (const ch of s)` charCodeAt(0), i.e. each code point (above U+FFFF its high surrogate) */
		uint32_t FdHash(const std::string& S)
		{
			uint32_t H = 2166136261u;
			for (size_t I = 0; I < S.size();)
			{
				const unsigned char C = static_cast<unsigned char>(S[I]);
				uint32_t Cp = C;
				size_t Len = 1;
				if (C >= 0xF0 && I + 3 < S.size() + 0) { Cp = ((C & 0x07u) << 18) | ((static_cast<unsigned char>(S[I + 1]) & 0x3Fu) << 12) | ((static_cast<unsigned char>(S[I + 2]) & 0x3Fu) << 6) | (static_cast<unsigned char>(S[I + 3]) & 0x3Fu); Len = 4; }
				else if (C >= 0xE0 && I + 2 < S.size()) { Cp = ((C & 0x0Fu) << 12) | ((static_cast<unsigned char>(S[I + 1]) & 0x3Fu) << 6) | (static_cast<unsigned char>(S[I + 2]) & 0x3Fu); Len = 3; }
				else if (C >= 0xC0 && I + 1 < S.size()) { Cp = ((C & 0x1Fu) << 6) | (static_cast<unsigned char>(S[I + 1]) & 0x3Fu); Len = 2; }
				const uint32_t Unit = Cp > 0xFFFF ? 0xD800u + ((Cp - 0x10000u) >> 10) : Cp;
				H ^= Unit;
				H *= 16777619u;
				I += Len;
			}
			return H;
		}
	}

	std::string FoundryOfName(const std::string& Name, const std::string& Slot)
	{
		if (!FdWeaponSlot(Slot)) return "";
		std::string L = Name;
		for (char& C : L) C = static_cast<char>(C >= 'A' && C <= 'Z' ? C - 'A' + 'a' : C);
		if (FdAny(L, {"void", "singularity", "horizon", "anomal", "genesis", "eternity", "antiphon", "hourglass"})) return "BLACK_ARMORY";
		if (FdAny(L, {"pulse", "arc", "cryo", "plasma", "phase", "caster", "bio-lum"})) return "OMOLON";
		if (FdMg(L) || FdAny(L, {"mag-cannon", "heavy", "repeater", "minigun", "maul", "frontline"})) return "HAKKE";
		if (FdAny(L, {"dmr", "rifle", "carbine", "smg"})) return "SUROS";
		if (FdAny(L, {"pistol", "sidearm", "slugger", "crossbow", "revolver"})) return "TEX_MECHANICA";
		static const char* const Order[5] = {"OMOLON", "HAKKE", "SUROS", "TEX_MECHANICA", "BLACK_ARMORY"};
		return Order[FdHash(Name) % 5];
	}

	std::string FoundryOf(const FGearItem* Item) { return Item ? FoundryOfName(Item->Name, Item->Slot) : ""; }

	FFootRules FootRules(const std::string& Foundry, bool bAiming)
	{
		FFootRules R;
		if (Foundry == "OMOLON") R.HeatMult = Rules.OmolonHeat;
		if (Foundry == "SUROS") R.RecoilMult = Rules.SurosRecoil;
		if (Foundry == "TEX_MECHANICA" && !bAiming) R.HipMult = Rules.TexHip;
		return R;
	}

	int FireFootBullets(vweapons::FHeat& H, double WeaponHeat, double HeatMult, int Pellets, bool& bTipped)
	{
		bTipped = false;
		const int N = Pellets > 0 ? Pellets : 1;
		int Fired = 0;
		for (int I = 0; I < N; ++I)
		{
			if (H.bOverheated) continue; // fireBullet refuses while venting
			if (vweapons::AddHeat(H, vweapons::HeatPerShotFoot * ((WeaponHeat * HeatMult) / N))) bTipped = true;
			++Fired;
		}
		return Fired;
	}

	bool FireFootLauncher(vweapons::FHeat& H, double WeaponHeat, double HeatMult, bool& bTipped)
	{
		bTipped = false;
		if (H.bOverheated) return false;
		bTipped = vweapons::AddHeat(H, vweapons::HeatPerShotFoot * (WeaponHeat * HeatMult));
		return true;
	}
}
