// World Fracture — GPS: the city road graph, shortest-route planning, turn-by-turn guidance and rerouting.
//
// New for the Unreal build (the web build's waypoint, map-pin.ts, is a straight-line pin with compass and tracker; it
// has no road routing). The pin rules match it: a waypoint is a world point with a label, and it counts as reached
// within ARRIVE_RADIUS (12 m) of the player.
//
// Units are the rules' metres on the ground plane: x, z (Unreal X = x * 100, Y = z * 100). Looking down with x to the
// right and z downward (Unreal's top view), a positive cross product of travel directions is a right turn.
//
// The graph is built from the city layout (DataTables/NexusCity.json): each road segment joins the two junctions at its
// ends, and the hub's ring road becomes a loop of nodes. Nexus City's districts are separate street grids around an open
// plaza, so BridgeComponents links any piece the roads leave apart with the shortest straight crossing that clears every
// building; those legs are marked PLAZA so the HUD can draw them differently.
//
// Tested by Tests/GpsCoreTest.cpp (self-checking: there is no web reference to record goldens from).
#pragma once

#include "Core/WFCoreApi.h"

#include <cstdint>
#include <string>
#include <vector>

namespace wf::gps
{
	/** within this many metres the waypoint counts as reached (map-pin.ts ARRIVE_RADIUS) */
	inline constexpr double ArriveRadius = 12;
	/** further than this from the route line, the player has left it */
	inline constexpr double OffRouteDistance = 18;
	/** what a turn costs in the route search (metres): equal-length routes with fewer turns win */
	inline constexpr double TurnPenalty = 6;
	/** turns gentler than this (degrees) are not announced */
	inline constexpr double StraightTolerance = 30;

	enum class EEdgeKind : uint8_t { Road, Ring, Plaza };
	WORLDFRACTURECORE_API const char* EdgeKindName(EEdgeKind Kind);

	struct FPoint { double X = 0, Z = 0; };
	/** a footprint the GPS will not cut through: centre, half extents, and its turn about the vertical (radians, the web
	 * build's rotation.y: local x maps to world (cos, -sin), local z to (sin, cos)) */
	struct FRect { double X = 0, Z = 0, HalfX = 0, HalfZ = 0, Rot = 0; };
	struct FNode { double X = 0, Z = 0; };
	struct FEdge { int A = 0, B = 0; double Length = 0; EEdgeKind Kind = EEdgeKind::Road; };

	/** where a world point meets the graph: the closest point on any edge */
	struct FSnap
	{
		int Edge = -1;
		double T = 0;      // 0 at the edge's A, 1 at its B
		double X = 0, Z = 0;
		double Distance = 0; // from the query point
	};

	class WORLDFRACTURECORE_API FRoadGraph
	{
	public:
		/** adds a node, or returns the existing one within MergeDistance */
		int AddNode(double X, double Z, double MergeDistance = 0.5);
		/** joins two nodes; ignores self-loops and duplicates */
		void AddEdge(int A, int B, EEdgeKind Kind);

		/** NexusCity.json Segments rows [x, z, halfX, halfZ, axis]: axis 0 runs along x, 1 along z. JunctionHalf is the
		 * junction box's half size, so a segment reaches junction centres at halfLength + JunctionHalf either side. */
		void AddCitySegments(const std::vector<std::vector<double>>& Segments, double JunctionHalf);
		/** a ring road of NodeCount nodes around (Cx, Cz) */
		void AddRing(double Cx, double Cz, double Radius, int NodeCount);
		/** links each separate piece of the network to the rest with the shortest clear straight leg (at most MaxLength
		 * metres) between their nodes; returns how many legs were added */
		int BridgeComponents(const std::vector<FRect>& Obstacles, double MaxLength);
		/** links each road node within MaxLength of the ring to its closest ring node reachable without crossing a building */
		int ConnectRingSpokes(const std::vector<FRect>& Obstacles, double MaxLength);

		/** how many separate pieces the network is in */
		int CountComponents() const;
		FSnap Snap(double X, double Z) const;

		const std::vector<FNode>& Nodes() const { return NodeList; }
		const std::vector<FEdge>& Edges() const { return EdgeList; }
		/** the edges touching a node */
		const std::vector<int>& EdgesAt(int Node) const { return Adjacent[static_cast<size_t>(Node)]; }

	private:
		std::vector<FNode> NodeList;
		std::vector<FEdge> EdgeList;
		std::vector<std::vector<int>> Adjacent;
		std::vector<int> ComponentOf() const;
	};

	/** true when the straight line from A to B passes through any footprint (grown by Margin) */
	WORLDFRACTURECORE_API bool SegmentHitsAny(const FPoint& A, const FPoint& B, const std::vector<FRect>& Obstacles, double Margin = 0.5);

	enum class EManeuver : uint8_t { Depart, Left, Right, SharpLeft, SharpRight, UTurn, EnterRing, ExitRing, CrossPlaza, Arrive };
	WORLDFRACTURECORE_API const char* ManeuverName(EManeuver M);

	struct WORLDFRACTURECORE_API FManeuver
	{
		EManeuver Type = EManeuver::Depart;
		double AtDistance = 0; // metres along the route
		double X = 0, Z = 0;
		int RingExit = 0;      // for EnterRing: which exit to take (1 = first); 0 when the route leaves the ring between exits
		std::string Text() const;
		/** a few words for the HUD banner over the minimap ("Ring road: 2nd exit") */
		std::string ShortText() const;
	};

	struct FRoute
	{
		bool bValid = false;
		/** the route line, start to destination; Kinds[i] is the kind of the leg from Points[i] to Points[i + 1] */
		std::vector<FPoint> Points;
		std::vector<EEdgeKind> Kinds;
		/** distance along the route at each point */
		std::vector<double> Along;
		double Length = 0;
		std::vector<FManeuver> Maneuvers;
	};

	/** Shortest route over the network: straight from the start to its nearest road, along the roads, then straight to
	 * the destination. Invalid only when the graph is empty or the two ends sit on pieces with no connection. */
	WORLDFRACTURECORE_API FRoute PlanRoute(const FRoadGraph& Graph, double FromX, double FromZ, double ToX, double ToZ);

	struct FGuidance
	{
		double Progress = 0;          // metres along the route at the player's closest point
		double Remaining = 0;         // metres to the destination along the route
		double OffRoute = 0;          // metres from the route line
		const FManeuver* Next = nullptr;
		double ToNext = 0;            // metres to Next
		bool bArrived = false;
		bool bShouldReroute = false;
	};

	/** Where the player is on the route. LastProgress keeps the reading from jumping to a later stretch that happens to
	 * pass nearby (pass the previous Progress, 0 for a new route). */
	WORLDFRACTURECORE_API FGuidance Guide(const FRoute& Route, double X, double Z, double LastProgress);

	/** "350 m", "1.2 km" */
	WORLDFRACTURECORE_API std::string FormatDistance(double Metres);
	/** minutes at the given speed (m/s), at least 1 */
	WORLDFRACTURECORE_API int EtaMinutes(double Metres, double SpeedMs);
}
