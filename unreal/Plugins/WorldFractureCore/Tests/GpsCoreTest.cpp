// WF_NO_GOLDEN — self-checking test for the GPS core (there is no web reference to record goldens from). Its argument is
// the path to DataTables/NexusCity.json, so the real city's road network is checked too.
#include "Core/WFGpsCore.h"

#include <cmath>
#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

using namespace wf::gps;

namespace
{
	int Checks = 0, Failures = 0;
	void Check(bool bOk, const std::string& What)
	{
		++Checks;
		if (!bOk) { ++Failures; std::printf("FAIL: %s\n", What.c_str()); }
	}
	bool Near(double A, double B, double Tol = 0.01) { return std::abs(A - B) <= Tol; }
	int CountType(const FRoute& R, EManeuver T)
	{
		int N = 0;
		for (const FManeuver& M : R.Maneuvers) N += M.Type == T;
		return N;
	}

	/** rows of a top-level "Key": [[...], [...]] array in the city JSON, each row as raw comma-separated tokens */
	std::vector<std::vector<std::string>> JsonRows(const std::string& Json, const std::string& Key)
	{
		std::vector<std::vector<std::string>> Rows;
		const size_t K = Json.find("\"" + Key + "\"");
		if (K == std::string::npos) return Rows;
		size_t I = Json.find('[', K);
		int Depth = 0;
		std::vector<std::string> Row;
		std::string Tok;
		for (; I < Json.size(); ++I)
		{
			const char C = Json[I];
			if (C == '[') { ++Depth; if (Depth == 2) { Row.clear(); Tok.clear(); } continue; }
			if (C == ']')
			{
				if (Depth == 2) { if (!Tok.empty()) Row.push_back(Tok); Rows.push_back(Row); Tok.clear(); }
				if (--Depth == 0) break;
				continue;
			}
			if (Depth == 2)
			{
				if (C == ',') { Row.push_back(Tok); Tok.clear(); }
				else if (C != ' ' && C != '\n' && C != '"') Tok += C;
			}
		}
		return Rows;
	}
	double JsonNumber(const std::string& Json, const std::string& Key)
	{
		const size_t K = Json.find("\"" + Key + "\"");
		return K == std::string::npos ? 0 : std::stod(Json.substr(Json.find(':', K) + 1));
	}

	/** a 3 x 3 street grid with 10 m blocks: nodes at x, z in {0, 10, 20} */
	FRoadGraph Grid()
	{
		FRoadGraph G;
		for (int Z = 0; Z <= 20; Z += 10)
			for (int X = 0; X <= 20; X += 10)
			{
				const int N = G.AddNode(X, Z);
				if (X > 0) G.AddEdge(G.AddNode(X - 10, Z), N, EEdgeKind::Road);
				if (Z > 0) G.AddEdge(G.AddNode(X, Z - 10), N, EEdgeKind::Road);
			}
		return G;
	}
}

int main(int Argc, char** Argv)
{
	// ---- a plain grid ----
	{
		const FRoadGraph G = Grid();
		Check(G.Nodes().size() == 9 && G.Edges().size() == 12, "grid has 9 nodes and 12 edges");
		Check(G.CountComponents() == 1, "grid is one piece");

		const FRoute R = PlanRoute(G, 0, 0, 20, 20);
		Check(R.bValid, "grid route is valid");
		Check(Near(R.Length, 40), "grid corner to corner is 40 m, got " + std::to_string(R.Length));
		Check(R.Maneuvers.front().Type == EManeuver::Depart && R.Maneuvers.back().Type == EManeuver::Arrive, "route starts with DEPART and ends with ARRIVE");
		const int Turns = CountType(R, EManeuver::Left) + CountType(R, EManeuver::Right);
		Check(Turns == 1, "corner to corner of a grid takes one turn, not a staircase (got " + std::to_string(Turns) + ")");

		// east along z = 0 then south (z grows downward on screen) is a right turn
		FRoadGraph L;
		L.AddEdge(L.AddNode(0, 0), L.AddNode(10, 0), EEdgeKind::Road);
		L.AddEdge(L.AddNode(10, 0), L.AddNode(10, 10), EEdgeKind::Road);
		const FRoute RL = PlanRoute(L, 0, 0, 10, 10);
		Check(CountType(RL, EManeuver::Right) == 1 && CountType(RL, EManeuver::Left) == 0, "east then south is one right turn");
		const FRoute LL = PlanRoute(L, 10, 10, 0, 0);
		Check(CountType(LL, EManeuver::Left) == 1 && CountType(LL, EManeuver::Right) == 0, "north then west is a left turn");
		FRoadGraph L2;
		L2.AddEdge(L2.AddNode(0, 0), L2.AddNode(10, 0), EEdgeKind::Road);
		L2.AddEdge(L2.AddNode(10, 0), L2.AddNode(10, -10), EEdgeKind::Road);
		Check(CountType(PlanRoute(L2, 0, 0, 10, -10), EManeuver::Left) == 1, "east then north is a left turn");

		// mid-block start and finish: the route begins and ends on the exact points
		const FRoute Mid = PlanRoute(G, 5, -3, 15, 20);
		Check(Mid.bValid && Near(Mid.Points.front().X, 5) && Near(Mid.Points.front().Z, -3), "route starts at the player");
		Check(Near(Mid.Points.back().X, 15) && Near(Mid.Points.back().Z, 20), "route ends at the waypoint");
		Check(Mid.Kinds.front() == EEdgeKind::Plaza, "the leg onto the road from off-road is a plaza leg");
		Check(Near(Mid.Length, 3 + 5 + 20 + 5, 0.01) || Near(Mid.Length, 3 + 5 + 20 + 5 + 0, 0.5), "mid-block route length is 33 m, got " + std::to_string(Mid.Length));

		// same edge: straight along it, no detour
		const FRoute Same = PlanRoute(G, 2, 0, 8, 0);
		Check(Same.bValid && Near(Same.Length, 6), "start and end on one street is the straight 6 m, got " + std::to_string(Same.Length));
	}

	// ---- guidance ----
	{
		const FRoadGraph G = Grid();
		FRoadGraph Line;
		Line.AddEdge(Line.AddNode(0, 0), Line.AddNode(60, 0), EEdgeKind::Road);
		const FRoute R = PlanRoute(Line, 0, 0, 60, 0); // straight east 60 m
		FGuidance A = Guide(R, 30, 1, 0);
		Check(Near(A.Progress, 30) && Near(A.Remaining, 30) && Near(A.OffRoute, 1), "guidance halfway: progress 30, remaining 30, 1 m off");
		Check(!A.bArrived && !A.bShouldReroute, "halfway is neither arrived nor off route");
		Check(A.Next && A.Next->Type == EManeuver::Arrive && Near(A.ToNext, 30), "next is ARRIVE in 30 m");

		const FRoute T = PlanRoute(G, 0, 0, 20, 20);
		const FGuidance B = Guide(T, 3, 0, 0);
		Check(B.Next && B.Next->Type != EManeuver::Arrive && B.Next->Type != EManeuver::Depart, "before the corner the next instruction is the turn");

		const FGuidance Off = Guide(R, 30, 40, 0);
		Check(Off.bShouldReroute && Off.OffRoute > OffRouteDistance, "40 m off the route asks for a reroute");
		const FGuidance Arr = Guide(R, 60 - ArriveRadius + 1, 0, 45);
		Check(Arr.bArrived && !Arr.bShouldReroute, "inside the arrive radius counts as arrived");

		// a loop that passes near itself: progress stays on the stretch the player is on
		FRoadGraph U;
		const int A0 = U.AddNode(0, 0), A1 = U.AddNode(40, 0), A2 = U.AddNode(40, 6), A3 = U.AddNode(0, 6);
		U.AddEdge(A0, A1, EEdgeKind::Road);
		U.AddEdge(A1, A2, EEdgeKind::Road);
		U.AddEdge(A2, A3, EEdgeKind::Road);
		const FRoute UR = PlanRoute(U, 0, 0, 0, 6);
		const FGuidance Early = Guide(UR, 10, 2.5, 8);
		Check(Early.Progress < 20, "on a hairpin, progress stays on the outbound leg (got " + std::to_string(Early.Progress) + ")");
		const FGuidance Late = Guide(UR, 10, 3.5, 70);
		Check(Late.Progress > 50, "and on the return leg once the player is past the bend (got " + std::to_string(Late.Progress) + ")");
	}

	// ---- ring roads ----
	{
		FRoadGraph G;
		G.AddRing(0, 0, 10, 8);
		G.AddEdge(G.AddNode(-30, 0), G.AddNode(-10, 0), EEdgeKind::Road);
		G.AddEdge(G.AddNode(10, 0), G.AddNode(30, 0), EEdgeKind::Road);
		G.AddEdge(G.AddNode(0, 10), G.AddNode(0, 30), EEdgeKind::Road);
		Check(G.CountComponents() == 1, "ring with three spokes is one piece");
		const FRoute R = PlanRoute(G, -30, 0, 30, 0);
		Check(R.bValid && CountType(R, EManeuver::EnterRing) == 1 && CountType(R, EManeuver::ExitRing) == 1, "crossing the ring enters and exits it once");
		int Exit = 0;
		for (const FManeuver& M : R.Maneuvers) if (M.Type == EManeuver::EnterRing) Exit = M.RingExit;
		Check(Exit == 1 || Exit == 2, "east exit is the 1st or 2nd depending on direction, got " + std::to_string(Exit));
		const FRoute S = PlanRoute(G, -30, 0, 0, 30);
		int ExitS = 0;
		for (const FManeuver& M : S.Maneuvers) if (M.Type == EManeuver::EnterRing) ExitS = M.RingExit;
		Check(ExitS == 1, "south spoke from the west is the 1st exit, got " + std::to_string(ExitS));
		// a place inside the ring (on its plaza): the route joins the ring and leaves it between exits
		const FRoute In = PlanRoute(G, -30, 0, 0, -5);
		int ExitIn = -1;
		std::string TextIn;
		for (const FManeuver& M : In.Maneuvers) if (M.Type == EManeuver::EnterRing) { ExitIn = M.RingExit; TextIn = M.Text(); }
		Check(In.bValid && ExitIn == 0 && TextIn == "Join the ring road", "a plaza destination inside the ring has no exit number (got " + std::to_string(ExitIn) + ", \"" + TextIn + "\")");
	}

	// ---- bridging separate pieces around a building ----
	{
		FRoadGraph G;
		G.AddEdge(G.AddNode(0, 0), G.AddNode(10, 0), EEdgeKind::Road);
		G.AddEdge(G.AddNode(20, 0), G.AddNode(30, 0), EEdgeKind::Road);
		G.AddEdge(G.AddNode(20, 12), G.AddNode(30, 12), EEdgeKind::Road);
		G.AddEdge(G.AddNode(10, 12), G.AddNode(20, 12), EEdgeKind::Road); // the top street: (10,12)-(20,12)-(30,12)
		Check(G.CountComponents() == 3, "three separate pieces before bridging, got " + std::to_string(G.CountComponents()));
		const std::vector<FRect> Wall{{15, 0, 2, 3}}; // blocks the 10 m gap between (10,0) and (20,0)
		Check(SegmentHitsAny({10, 0}, {20, 0}, Wall), "the wall blocks the straight gap");
		Check(!SegmentHitsAny({10, 0}, {10, 12}, Wall), "a parallel leg clears it");
		const std::vector<FRect> Turned{{0, 0, 10, 1, 3.141592653589793 / 2}}; // a 20 x 2 slab turned to run along z
		Check(SegmentHitsAny({-5, 6}, {5, 6}, Turned) && !SegmentHitsAny({3, -5}, {3, 5}, Turned), "a turned footprint blocks across its new length only");
		const int Added = G.BridgeComponents(Wall, 40);
		Check(Added == 2 && G.CountComponents() == 1, "two crossings join the three pieces");
		for (const FEdge& E : G.Edges())
			if (E.Kind == EEdgeKind::Plaza)
			{
				const FNode& A = G.Nodes()[static_cast<size_t>(E.A)];
				const FNode& B = G.Nodes()[static_cast<size_t>(E.B)];
				Check(!SegmentHitsAny({A.X, A.Z}, {B.X, B.Z}, Wall), "no crossing cuts through the wall");
			}
		const FRoute R = PlanRoute(G, 0, 0, 30, 0);
		Check(R.bValid, "a route exists once bridged");
		bool bCross = false;
		for (const FManeuver& M : R.Maneuvers) bCross |= M.Type == EManeuver::CrossPlaza;
		Check(bCross, "the route announces the plaza crossing");

		FRoadGraph Apart;
		Apart.AddEdge(Apart.AddNode(0, 0), Apart.AddNode(10, 0), EEdgeKind::Road);
		Apart.AddEdge(Apart.AddNode(500, 0), Apart.AddNode(510, 0), EEdgeKind::Road);
		Check(Apart.BridgeComponents({}, 40) == 0, "pieces further apart than the limit stay apart");
		Check(!PlanRoute(Apart, 0, 0, 510, 0).bValid, "and the route between them is invalid");
		Check(!PlanRoute(FRoadGraph{}, 0, 0, 1, 1).bValid, "an empty graph gives no route");
	}

	// ---- text ----
	{
		Check(FormatDistance(42) == "40 m" && FormatDistance(347) == "350 m" && FormatDistance(1234) == "1.2 km", "distance formatting");
		Check(EtaMinutes(1200, 20) == 1 && EtaMinutes(1300, 20) == 2 && EtaMinutes(0, 0) == 1, "eta minutes");
		FManeuver M{EManeuver::EnterRing, 0, 0, 0, 2};
		Check(M.Text() == "At the ring road, take the 2nd exit", "ring instruction text");
		M.RingExit = 0;
		Check(M.Text() == "Join the ring road", "ring instruction without an exit");
	}

	// ---- the real Nexus City ----
	if (Argc > 1)
	{
		std::ifstream In(Argv[1]);
		std::stringstream Ss;
		Ss << In.rdbuf();
		const std::string Json = Ss.str();
		Check(!Json.empty(), std::string("read ") + Argv[1]);

		std::vector<std::vector<double>> Segments;
		for (const auto& Row : JsonRows(Json, "Segments"))
		{
			std::vector<double> V;
			for (const std::string& T : Row) V.push_back(std::stod(T));
			Segments.push_back(V);
		}
		std::vector<FRect> Obstacles;
		for (const auto& Row : JsonRows(Json, "Buildings"))
			Obstacles.push_back({std::stod(Row[0]), std::stod(Row[1]), std::stod(Row[2]) / 2, std::stod(Row[3]) / 2}); // rows hold full width and depth
		for (const auto& Row : JsonRows(Json, "HubTowers"))
		{
			Obstacles.push_back({std::stod(Row[0]), std::stod(Row[1]), std::stod(Row[2]) / 2, std::stod(Row[3]) / 2, std::stod(Row[5])});
		}
		const double Hx = JsonNumber(Json, "X"), Hz = JsonNumber(Json, "Z"), RoadR = JsonNumber(Json, "RoadR");
		Check(Segments.size() == 56 && Obstacles.size() > 60, "city has 56 road segments and its buildings");

		FRoadGraph G;
		G.AddCitySegments(Segments, 3.5);
		const int RoadPieces = G.CountComponents();
		G.AddRing(Hx, Hz, RoadR, 48); // as AWFGpsNavigator::Build
		const int Spokes = G.ConnectRingSpokes(Obstacles, 42);
		const int Bridges = G.BridgeComponents(Obstacles, 80);
		std::printf("Nexus City: %zu nodes, %zu edges, street grid in %d pieces, %d ring spokes, %d plaza bridges, %d piece(s) after\n",
			G.Nodes().size(), G.Edges().size(), RoadPieces, Spokes, Bridges, G.CountComponents());
		Check(RoadPieces > 1, "the raw street grid is in separate districts (why bridging exists)");
		Check(G.CountComponents() == 1, "after spokes and bridges every street is reachable");
		for (const FEdge& E : G.Edges())
			if (E.Kind == EEdgeKind::Plaza)
			{
				const FNode& A = G.Nodes()[static_cast<size_t>(E.A)];
				const FNode& B = G.Nodes()[static_cast<size_t>(E.B)];
				Check(!SegmentHitsAny({A.X, A.Z}, {B.X, B.Z}, Obstacles), "plaza leg clears the buildings");
			}

		// every node can reach every other: route from the spawn pad to each node
		const double Sx = Hx + JsonNumber(Json, "SpawnX"), Sz = Hz + JsonNumber(Json, "SpawnZ");
		int Ok = 0;
		double Longest = 0;
		for (const FNode& N : G.Nodes())
		{
			const FRoute R = PlanRoute(G, Sx, Sz, N.X, N.Z);
			if (R.bValid) { ++Ok; Longest = std::max(Longest, R.Length); }
		}
		Check(Ok == static_cast<int>(G.Nodes().size()), "a route from the spawn pad to every node (" + std::to_string(Ok) + "/" + std::to_string(G.Nodes().size()) + ")");
		std::printf("Nexus City: longest route from the spawn pad %.0f m\n", Longest);

		// a cross-city trip, printed for review
		const FRoute Trip = PlanRoute(G, 2.4, -236.4, 69.09, -294.33); // south-west streets to the Nexus Armory on the plaza
		Check(Trip.bValid, "cross-city trip routes");
		std::printf("Trip %.0f m, %zu points:\n", Trip.Length, Trip.Points.size());
		for (const FManeuver& M : Trip.Maneuvers) std::printf("  %6.0f m  %-12s %s\n", M.AtDistance, ManeuverName(M.Type), M.Text().c_str());
		if (Argc > 2)
		{
			std::ofstream Out(Argv[2]);
			for (const FEdge& E : G.Edges())
				Out << "E " << EdgeKindName(E.Kind) << ' ' << G.Nodes()[static_cast<size_t>(E.A)].X << ' ' << G.Nodes()[static_cast<size_t>(E.A)].Z << ' ' << G.Nodes()[static_cast<size_t>(E.B)].X << ' ' << G.Nodes()[static_cast<size_t>(E.B)].Z << '\n';
			for (size_t I = 0; I < Trip.Points.size(); ++I)
				Out << "P " << Trip.Points[I].X << ' ' << Trip.Points[I].Z << ' ' << (I < Trip.Kinds.size() ? EdgeKindName(Trip.Kinds[I]) : "END") << '\n';
			for (const FManeuver& M : Trip.Maneuvers) Out << "M " << M.AtDistance << ' ' << ManeuverName(M.Type) << ' ' << M.Text() << '\n';
			// guidance a third of the way along, for the HUD preview
			const double Along = Trip.Length / 3;
			size_t Leg = 0;
			while (Leg + 2 < Trip.Points.size() && Trip.Along[Leg + 1] < Along) ++Leg;
			const double T = (Along - Trip.Along[Leg]) / std::max(1e-6, Trip.Along[Leg + 1] - Trip.Along[Leg]);
			const double Gx = Trip.Points[Leg].X + (Trip.Points[Leg + 1].X - Trip.Points[Leg].X) * T;
			const double Gz = Trip.Points[Leg].Z + (Trip.Points[Leg + 1].Z - Trip.Points[Leg].Z) * T;
			const FGuidance G = Guide(Trip, Gx, Gz, Along - 5);
			const double Yaw = std::atan2(Trip.Points[Leg + 1].Z - Trip.Points[Leg].Z, Trip.Points[Leg + 1].X - Trip.Points[Leg].X) * 180 / 3.141592653589793;
			Out << "G " << Gx << ' ' << Gz << ' ' << Yaw << ' ' << G.Remaining << ' ' << G.ToNext << ' ' << FormatDistance(G.ToNext) << '|' << FormatDistance(G.Remaining) << '|' << (G.Next ? G.Next->Text() : "") << '\n';
		}
	}

	std::printf("%d checks, %d failed\n", Checks, Failures);
	return Failures == 0 ? 0 : 1;
}
