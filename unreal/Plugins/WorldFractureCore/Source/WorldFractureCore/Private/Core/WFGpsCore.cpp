#include "Core/WFGpsCore.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <limits>
#include <queue>
#include <utility>

namespace wf::gps
{
	namespace
	{
		constexpr double GpsPi = 3.141592653589793;
		constexpr double Inf = std::numeric_limits<double>::infinity();

		double Dist(double Ax, double Az, double Bx, double Bz) { return std::hypot(Bx - Ax, Bz - Az); }

		/** closest point on segment AB to P: returns t in [0, 1] and the distance */
		std::pair<double, double> Project(double Ax, double Az, double Bx, double Bz, double Px, double Pz)
		{
			const double Dx = Bx - Ax, Dz = Bz - Az;
			const double Len2 = Dx * Dx + Dz * Dz;
			double T = Len2 > 0 ? ((Px - Ax) * Dx + (Pz - Az) * Dz) / Len2 : 0;
			T = std::clamp(T, 0.0, 1.0);
			return {T, Dist(Ax + Dx * T, Az + Dz * T, Px, Pz)};
		}

		const char* Ordinal(int N)
		{
			switch (N)
			{
			case 1: return "1st";
			case 2: return "2nd";
			case 3: return "3rd";
			case 4: return "4th";
			case 5: return "5th";
			case 6: return "6th";
			default: return "next";
			}
		}
	}

	const char* EdgeKindName(EEdgeKind Kind)
	{
		switch (Kind)
		{
		case EEdgeKind::Road: return "ROAD";
		case EEdgeKind::Ring: return "RING";
		case EEdgeKind::Plaza: return "PLAZA";
		}
		return "ROAD";
	}

	const char* ManeuverName(EManeuver M)
	{
		switch (M)
		{
		case EManeuver::Depart: return "DEPART";
		case EManeuver::Left: return "LEFT";
		case EManeuver::Right: return "RIGHT";
		case EManeuver::SharpLeft: return "SHARP_LEFT";
		case EManeuver::SharpRight: return "SHARP_RIGHT";
		case EManeuver::UTurn: return "U_TURN";
		case EManeuver::EnterRing: return "ENTER_RING";
		case EManeuver::ExitRing: return "EXIT_RING";
		case EManeuver::CrossPlaza: return "CROSS_PLAZA";
		case EManeuver::Arrive: return "ARRIVE";
		}
		return "DEPART";
	}

	std::string FManeuver::Text() const
	{
		switch (Type)
		{
		case EManeuver::Depart: return "Head to the route";
		case EManeuver::Left: return "Turn left";
		case EManeuver::Right: return "Turn right";
		case EManeuver::SharpLeft: return "Sharp left";
		case EManeuver::SharpRight: return "Sharp right";
		case EManeuver::UTurn: return "Make a U-turn";
		case EManeuver::EnterRing: return RingExit > 0 ? std::string("At the ring road, take the ") + Ordinal(RingExit) + " exit" : std::string("Join the ring road");
		case EManeuver::ExitRing: return "Exit the ring road";
		case EManeuver::CrossPlaza: return "Cross the plaza";
		case EManeuver::Arrive: return "Arrive at destination";
		}
		return "";
	}

	std::string FManeuver::ShortText() const
	{
		switch (Type)
		{
		case EManeuver::Depart: return "To the route";
		case EManeuver::Left: return "Left";
		case EManeuver::Right: return "Right";
		case EManeuver::SharpLeft: return "Sharp left";
		case EManeuver::SharpRight: return "Sharp right";
		case EManeuver::UTurn: return "U-turn";
		case EManeuver::EnterRing: return RingExit > 0 ? std::string("Ring road: ") + Ordinal(RingExit) + " exit" : std::string("Join ring road");
		case EManeuver::ExitRing: return "Leave ring road";
		case EManeuver::CrossPlaza: return "Cross plaza";
		case EManeuver::Arrive: return "Arrive";
		}
		return "";
	}

	// ---------------------------------------------------------------- graph

	int FRoadGraph::AddNode(double X, double Z, double MergeDistance)
	{
		for (size_t I = 0; I < NodeList.size(); ++I)
			if (Dist(NodeList[I].X, NodeList[I].Z, X, Z) <= MergeDistance) return static_cast<int>(I);
		NodeList.push_back({X, Z});
		Adjacent.emplace_back();
		return static_cast<int>(NodeList.size() - 1);
	}

	void FRoadGraph::AddEdge(int A, int B, EEdgeKind Kind)
	{
		if (A == B || A < 0 || B < 0 || A >= static_cast<int>(NodeList.size()) || B >= static_cast<int>(NodeList.size())) return;
		for (int E : Adjacent[static_cast<size_t>(A)])
		{
			const FEdge& Ex = EdgeList[static_cast<size_t>(E)];
			if ((Ex.A == A && Ex.B == B) || (Ex.A == B && Ex.B == A)) return;
		}
		const FNode& Na = NodeList[static_cast<size_t>(A)];
		const FNode& Nb = NodeList[static_cast<size_t>(B)];
		EdgeList.push_back({A, B, Dist(Na.X, Na.Z, Nb.X, Nb.Z), Kind});
		const int Id = static_cast<int>(EdgeList.size() - 1);
		Adjacent[static_cast<size_t>(A)].push_back(Id);
		Adjacent[static_cast<size_t>(B)].push_back(Id);
	}

	void FRoadGraph::AddCitySegments(const std::vector<std::vector<double>>& Segments, double JunctionHalf)
	{
		for (const std::vector<double>& S : Segments)
		{
			if (S.size() < 5) continue;
			const double X = S[0], Z = S[1];
			const bool bAlongX = S[4] == 0;
			const double Reach = (bAlongX ? S[2] : S[3]) + JunctionHalf;
			const int A = bAlongX ? AddNode(X - Reach, Z) : AddNode(X, Z - Reach);
			const int B = bAlongX ? AddNode(X + Reach, Z) : AddNode(X, Z + Reach);
			AddEdge(A, B, EEdgeKind::Road);
		}
	}

	void FRoadGraph::AddRing(double Cx, double Cz, double Radius, int NodeCount)
	{
		if (NodeCount < 3) return;
		std::vector<int> Ids;
		for (int I = 0; I < NodeCount; ++I)
		{
			const double A = 2 * GpsPi * I / NodeCount;
			Ids.push_back(AddNode(Cx + std::cos(A) * Radius, Cz + std::sin(A) * Radius));
		}
		for (size_t I = 0; I < Ids.size(); ++I) AddEdge(Ids[I], Ids[(I + 1) % Ids.size()], EEdgeKind::Ring);
	}

	std::vector<int> FRoadGraph::ComponentOf() const
	{
		std::vector<int> Label(NodeList.size(), -1);
		int Next = 0;
		for (size_t Start = 0; Start < NodeList.size(); ++Start)
		{
			if (Label[Start] >= 0) continue;
			std::vector<int> Stack{static_cast<int>(Start)};
			Label[Start] = Next;
			while (!Stack.empty())
			{
				const int N = Stack.back();
				Stack.pop_back();
				for (int E : Adjacent[static_cast<size_t>(N)])
				{
					const FEdge& Ed = EdgeList[static_cast<size_t>(E)];
					const int O = Ed.A == N ? Ed.B : Ed.A;
					if (Label[static_cast<size_t>(O)] < 0) { Label[static_cast<size_t>(O)] = Next; Stack.push_back(O); }
				}
			}
			++Next;
		}
		return Label;
	}

	int FRoadGraph::CountComponents() const
	{
		const std::vector<int> Label = ComponentOf();
		int Count = 0;
		for (int L : Label) Count = std::max(Count, L + 1);
		return Count;
	}

	bool SegmentHitsAny(const FPoint& A, const FPoint& B, const std::vector<FRect>& Obstacles, double Margin)
	{
		for (const FRect& R : Obstacles)
		{
			// into the box's own frame, then a Liang-Barsky clip against the grown box
			const double C = std::cos(R.Rot), S = std::sin(R.Rot);
			auto Local = [&](const FPoint& P) { const double X = P.X - R.X, Z = P.Z - R.Z; return FPoint{X * C - Z * S, X * S + Z * C}; };
			const FPoint La = Local(A), Lb = Local(B);
			const double Dx = Lb.X - La.X, Dz = Lb.Z - La.Z;
			double T0 = 0, T1 = 1;
			const double MinX = -R.HalfX - Margin, MaxX = R.HalfX + Margin;
			const double MinZ = -R.HalfZ - Margin, MaxZ = R.HalfZ + Margin;
			const double P[4] = {-Dx, Dx, -Dz, Dz};
			const double Q[4] = {La.X - MinX, MaxX - La.X, La.Z - MinZ, MaxZ - La.Z};
			bool bInside = true;
			for (int I = 0; I < 4 && bInside; ++I)
			{
				if (P[I] == 0) { if (Q[I] < 0) bInside = false; continue; }
				const double T = Q[I] / P[I];
				if (P[I] < 0) T0 = std::max(T0, T);
				else T1 = std::min(T1, T);
				if (T0 > T1) bInside = false;
			}
			if (bInside) return true;
		}
		return false;
	}

	int FRoadGraph::BridgeComponents(const std::vector<FRect>& Obstacles, double MaxLength)
	{
		int Added = 0;
		for (;;)
		{
			const std::vector<int> Label = ComponentOf();
			int Count = 0;
			for (int L : Label) Count = std::max(Count, L + 1);
			if (Count <= 1) break;
			// grow from the largest piece
			std::vector<int> Size(static_cast<size_t>(Count), 0);
			for (int L : Label) ++Size[static_cast<size_t>(L)];
			const int Main = static_cast<int>(std::max_element(Size.begin(), Size.end()) - Size.begin());
			double Best = Inf;
			int BestA = -1, BestB = -1;
			for (size_t I = 0; I < NodeList.size(); ++I)
			{
				if (Label[I] != Main) continue;
				for (size_t J = 0; J < NodeList.size(); ++J)
				{
					if (Label[J] == Main) continue;
					const double D = Dist(NodeList[I].X, NodeList[I].Z, NodeList[J].X, NodeList[J].Z);
					if (D >= Best || D > MaxLength) continue;
					if (SegmentHitsAny({NodeList[I].X, NodeList[I].Z}, {NodeList[J].X, NodeList[J].Z}, Obstacles)) continue;
					Best = D;
					BestA = static_cast<int>(I);
					BestB = static_cast<int>(J);
				}
			}
			if (BestA < 0) break; // the rest cannot be reached without cutting through a building
			AddEdge(BestA, BestB, EEdgeKind::Plaza);
			++Added;
		}
		return Added;
	}

	int FRoadGraph::ConnectRingSpokes(const std::vector<FRect>& Obstacles, double MaxLength)
	{
		std::vector<bool> IsRing(NodeList.size(), false);
		for (const FEdge& E : EdgeList)
			if (E.Kind == EEdgeKind::Ring) IsRing[static_cast<size_t>(E.A)] = IsRing[static_cast<size_t>(E.B)] = true;
		int Added = 0;
		// each street end near the ring gets one spoke, to the closest ring node it can reach in a straight line
		for (size_t N = 0; N < NodeList.size(); ++N)
		{
			if (IsRing[N]) continue;
			double Best = Inf;
			int BestR = -1;
			for (size_t R = 0; R < NodeList.size(); ++R)
			{
				if (!IsRing[R]) continue;
				const double D = Dist(NodeList[R].X, NodeList[R].Z, NodeList[N].X, NodeList[N].Z);
				if (D >= Best || D > MaxLength) continue;
				if (SegmentHitsAny({NodeList[R].X, NodeList[R].Z}, {NodeList[N].X, NodeList[N].Z}, Obstacles)) continue;
				Best = D;
				BestR = static_cast<int>(R);
			}
			if (BestR < 0) continue;
			const size_t Before = EdgeList.size();
			AddEdge(static_cast<int>(N), BestR, EEdgeKind::Plaza);
			if (EdgeList.size() > Before) ++Added;
		}
		return Added;
	}

	FSnap FRoadGraph::Snap(double X, double Z) const
	{
		FSnap Best;
		Best.Distance = Inf;
		for (size_t I = 0; I < EdgeList.size(); ++I)
		{
			const FEdge& E = EdgeList[I];
			const FNode& A = NodeList[static_cast<size_t>(E.A)];
			const FNode& B = NodeList[static_cast<size_t>(E.B)];
			const auto [T, D] = Project(A.X, A.Z, B.X, B.Z, X, Z);
			// prefer real roads: a plaza crossing has to be clearly closer to win
			const double Score = E.Kind == EEdgeKind::Plaza ? D + 4 : D;
			const double BestScore = Best.Edge >= 0 && EdgeList[static_cast<size_t>(Best.Edge)].Kind == EEdgeKind::Plaza ? Best.Distance + 4 : Best.Distance;
			if (Score < BestScore)
			{
				Best.Edge = static_cast<int>(I);
				Best.T = T;
				Best.X = A.X + (B.X - A.X) * T;
				Best.Z = A.Z + (B.Z - A.Z) * T;
				Best.Distance = D;
			}
		}
		if (Best.Edge < 0) Best.Distance = 0;
		return Best;
	}

	// ---------------------------------------------------------------- routing

	FRoute PlanRoute(const FRoadGraph& Graph, double FromX, double FromZ, double ToX, double ToZ)
	{
		FRoute Route;
		const std::vector<FNode>& Nodes = Graph.Nodes();
		const std::vector<FEdge>& Edges = Graph.Edges();
		if (Edges.empty()) return Route;
		const FSnap S = Graph.Snap(FromX, FromZ);
		const FSnap T = Graph.Snap(ToX, ToZ);
		if (S.Edge < 0 || T.Edge < 0) return Route;

		// A* over the graph plus two virtual nodes: the start's and the destination's snap points
		const int NodeCount = static_cast<int>(Nodes.size());
		const int Vs = NodeCount, Vt = NodeCount + 1;
		const FEdge& Es = Edges[static_cast<size_t>(S.Edge)];
		const FEdge& Et = Edges[static_cast<size_t>(T.Edge)];
		auto Pos = [&](int N) -> FPoint {
			if (N == Vs) return {S.X, S.Z};
			if (N == Vt) return {T.X, T.Z};
			return {Nodes[static_cast<size_t>(N)].X, Nodes[static_cast<size_t>(N)].Z};
		};
		struct FLink { int To; double Cost; EEdgeKind Kind; };
		auto Links = [&](int N) {
			std::vector<FLink> Out;
			if (N == Vs)
			{
				Out.push_back({Es.A, Es.Length * S.T, Es.Kind});
				Out.push_back({Es.B, Es.Length * (1 - S.T), Es.Kind});
				if (S.Edge == T.Edge) Out.push_back({Vt, Es.Length * std::abs(S.T - T.T), Es.Kind});
				return Out;
			}
			if (N == Vt) return Out;
			for (int E : Graph.EdgesAt(N))
			{
				const FEdge& Ed = Edges[static_cast<size_t>(E)];
				Out.push_back({Ed.A == N ? Ed.B : Ed.A, Ed.Length, Ed.Kind});
			}
			if (N == Et.A) Out.push_back({Vt, Et.Length * T.T, Et.Kind});
			if (N == Et.B) Out.push_back({Vt, Et.Length * (1 - T.T), Et.Kind});
			return Out;
		};

		// search states are (node, the node we came from) so each turn can cost a little: among equally short ways
		// through a grid, the GPS takes the one with fewer turns instead of a staircase
		const int Total = NodeCount + 2;
		auto State = [&](int N, int From) { return static_cast<size_t>(N) * static_cast<size_t>(Total + 1) + static_cast<size_t>(From + 1); };
		const size_t StateCount = static_cast<size_t>(Total) * static_cast<size_t>(Total + 1);
		std::vector<double> Cost(StateCount, Inf);
		std::vector<int> PrevFrom(StateCount, -2); // the From of the state before (its node is this state's From)
		std::vector<EEdgeKind> KindIn(StateCount, EEdgeKind::Road);
		auto TurnCost = [&](int From, int N, int To) {
			if (From < 0) return 0.0;
			const FPoint A = Pos(From), P = Pos(N), B = Pos(To);
			const double Ix = P.X - A.X, Iz = P.Z - A.Z, Ox = B.X - P.X, Oz = B.Z - P.Z;
			if (std::hypot(Ix, Iz) < 0.5 || std::hypot(Ox, Oz) < 0.5) return 0.0;
			const double Deg = std::abs(std::atan2(Ix * Oz - Iz * Ox, Ix * Ox + Iz * Oz)) * 180 / GpsPi;
			return Deg < StraightTolerance ? 0.0 : TurnPenalty;
		};
		struct FItem { double F; int N; int From; bool operator>(const FItem& O) const { return F > O.F; } };
		std::priority_queue<FItem, std::vector<FItem>, std::greater<FItem>> Open;
		const FPoint Goal = Pos(Vt);
		auto H = [&](int N) { const FPoint P = Pos(N); return Dist(P.X, P.Z, Goal.X, Goal.Z); };
		Cost[State(Vs, -1)] = 0;
		Open.push({H(Vs), Vs, -1});
		int GoalFrom = -2;
		while (!Open.empty())
		{
			const FItem It = Open.top();
			Open.pop();
			const double Here = Cost[State(It.N, It.From)];
			if (It.F - H(It.N) > Here + 1e-9) continue; // stale
			if (It.N == Vt) { GoalFrom = It.From; break; }
			for (const FLink& L : Links(It.N))
			{
				if (L.To == It.From) continue; // no doubling straight back
				const double C = Here + L.Cost + TurnCost(It.From, It.N, L.To);
				const size_t Next = State(L.To, It.N);
				if (C + 1e-9 < Cost[Next])
				{
					Cost[Next] = C;
					PrevFrom[Next] = It.From;
					KindIn[Next] = L.Kind;
					Open.push({C + H(L.To), L.To, It.N});
				}
			}
		}
		if (GoalFrom == -2) return Route;

		// the node chain, destination back to start
		std::vector<int> Chain;
		std::vector<EEdgeKind> ChainKind;
		for (int N = Vt, From = GoalFrom; N >= 0;)
		{
			const size_t St = State(N, From);
			Chain.push_back(N);
			ChainKind.push_back(KindIn[St]);
			const int PrevF = PrevFrom[St];
			N = From;
			From = PrevF;
		}
		std::reverse(ChainKind.begin(), ChainKind.end());
		std::reverse(Chain.begin(), Chain.end());

		std::vector<int> PointNode; // graph node behind each point (-1 for off-graph points)
		auto Push = [&](const FPoint& P, EEdgeKind KindToHere, int Node) {
			if (!Route.Points.empty() && Dist(Route.Points.back().X, Route.Points.back().Z, P.X, P.Z) < 0.25)
			{
				if (Node >= 0) PointNode.back() = Node;
				return;
			}
			if (!Route.Points.empty()) Route.Kinds.push_back(KindToHere);
			Route.Points.push_back(P);
			PointNode.push_back(Node);
		};
		Push({FromX, FromZ}, EEdgeKind::Plaza, -1);
		for (size_t I = 0; I < Chain.size(); ++I)
		{
			const int N = Chain[I];
			Push(Pos(N), N == Vs ? EEdgeKind::Plaza : ChainKind[I], N < NodeCount ? N : -1);
		}
		Push({ToX, ToZ}, EEdgeKind::Plaza, -1);
		if (Route.Points.size() < 2) Push({ToX + 0.3, ToZ}, EEdgeKind::Plaza, -1); // already there: a stub route

		Route.Along.assign(Route.Points.size(), 0);
		for (size_t I = 1; I < Route.Points.size(); ++I)
			Route.Along[I] = Route.Along[I - 1] + Dist(Route.Points[I - 1].X, Route.Points[I - 1].Z, Route.Points[I].X, Route.Points[I].Z);
		Route.Length = Route.Along.back();
		Route.bValid = true;

		// ---- turn-by-turn ----
		auto IsExit = [&](int Node) {
			if (Node < 0) return false;
			for (int E : Graph.EdgesAt(Node))
				if (Edges[static_cast<size_t>(E)].Kind != EEdgeKind::Ring) return true;
			return false;
		};
		Route.Maneuvers.push_back({EManeuver::Depart, 0, Route.Points[0].X, Route.Points[0].Z, 0});
		const size_t Last = Route.Points.size() - 1;
		for (size_t I = 1; I < Last; ++I)
		{
			const EEdgeKind In = Route.Kinds[I - 1], Out = Route.Kinds[I];
			const FPoint& P = Route.Points[I];
			FManeuver M{EManeuver::Depart, Route.Along[I], P.X, P.Z, 0};
			if (In != EEdgeKind::Ring && Out == EEdgeKind::Ring)
			{
				M.Type = EManeuver::EnterRing;
				// count the exits up to where the route leaves the ring; leaving part-way round (to a place on the plaza,
				// not down a street) has no exit number
				int Exits = 0;
				bool bAtExit = false;
				for (size_t J = I + 1; J <= Last; ++J)
				{
					if (IsExit(PointNode[J])) ++Exits;
					if (J >= Route.Kinds.size() || Route.Kinds[J] != EEdgeKind::Ring) { bAtExit = IsExit(PointNode[J]); break; }
				}
				M.RingExit = bAtExit ? std::max(1, Exits) : 0;
			}
			else if (In == EEdgeKind::Ring && Out == EEdgeKind::Ring) continue;
			else if (In == EEdgeKind::Ring) M.Type = EManeuver::ExitRing;
			else if (Out == EEdgeKind::Plaza && In != EEdgeKind::Plaza && I + 1 < Last) M.Type = EManeuver::CrossPlaza;
			else
			{
				const FPoint& A = Route.Points[I - 1];
				const FPoint& B = Route.Points[I + 1];
				const double Ix = P.X - A.X, Iz = P.Z - A.Z, Ox = B.X - P.X, Oz = B.Z - P.Z;
				const double Cross = Ix * Oz - Iz * Ox, Dot = Ix * Ox + Iz * Oz;
				const double Deg = std::atan2(Cross, Dot) * 180 / GpsPi;
				const double Abs = std::abs(Deg);
				if (Abs < StraightTolerance) continue;
				const bool bRight = Deg > 0;
				if (Abs > 165) M.Type = EManeuver::UTurn;
				else if (Abs > 120) M.Type = bRight ? EManeuver::SharpRight : EManeuver::SharpLeft;
				else M.Type = bRight ? EManeuver::Right : EManeuver::Left;
			}
			Route.Maneuvers.push_back(M);
		}
		Route.Maneuvers.push_back({EManeuver::Arrive, Route.Length, Route.Points[Last].X, Route.Points[Last].Z, 0});
		return Route;
	}

	FGuidance Guide(const FRoute& Route, double X, double Z, double LastProgress)
	{
		FGuidance G;
		if (!Route.bValid || Route.Points.size() < 2) return G;
		auto Closest = [&](double From, double To) {
			double BestD = Inf, BestAlong = 0;
			for (size_t I = 0; I + 1 < Route.Points.size(); ++I)
			{
				if (Route.Along[I + 1] < From || Route.Along[I] > To) continue;
				const FPoint& A = Route.Points[I];
				const FPoint& B = Route.Points[I + 1];
				const auto [T, D] = Project(A.X, A.Z, B.X, B.Z, X, Z);
				if (D < BestD - 1e-9) { BestD = D; BestAlong = Route.Along[I] + (Route.Along[I + 1] - Route.Along[I]) * T; }
			}
			return std::make_pair(BestD, BestAlong);
		};
		auto [D, Along] = Closest(LastProgress - 25, LastProgress + 150);
		if (D > OffRouteDistance)
		{
			const auto [D2, Along2] = Closest(-Inf, Inf);
			if (D2 < D) { D = D2; Along = Along2; }
		}
		G.Progress = Along;
		G.Remaining = std::max(0.0, Route.Length - Along);
		G.OffRoute = D;
		const FPoint& End = Route.Points.back();
		G.bArrived = Dist(X, Z, End.X, End.Z) <= ArriveRadius;
		G.bShouldReroute = !G.bArrived && D > OffRouteDistance;
		for (const FManeuver& M : Route.Maneuvers)
		{
			if (M.Type == EManeuver::Depart) continue;
			if (M.AtDistance > Along + 1 || M.Type == EManeuver::Arrive)
			{
				G.Next = &M;
				G.ToNext = std::max(0.0, M.AtDistance - Along);
				break;
			}
		}
		return G;
	}

	std::string FormatDistance(double Metres)
	{
		char Buf[32];
		if (Metres < 100) std::snprintf(Buf, sizeof(Buf), "%d m", static_cast<int>(std::lround(Metres / 5)) * 5);
		else if (Metres < 1000) std::snprintf(Buf, sizeof(Buf), "%d m", static_cast<int>(std::lround(Metres / 10)) * 10);
		else std::snprintf(Buf, sizeof(Buf), "%.1f km", Metres / 1000);
		return Buf;
	}

	int EtaMinutes(double Metres, double SpeedMs)
	{
		if (SpeedMs <= 0) return 1;
		return std::max(1, static_cast<int>(std::ceil(Metres / SpeedMs / 60)));
	}
}
