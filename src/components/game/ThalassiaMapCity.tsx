import { CITY_DESTINATIONS } from "@/game/destinations";
import { MAP_EXTENT } from "@/game/terrain-map";

/** Cartographic city illustration, anchored to the same landmark as the real underwater scene.
 * Purely decorative: selection and landing are handled by the parent map's interactive marker. */
export function ThalassiaMapCity({ detail = false }: { detail?: boolean }) {
  const city = CITY_DESTINATIONS.find((destination) => destination.id === "thalassia");
  if (!city) return null;
  const scale = MAP_EXTENT * (detail ? 0.00011 : 0.00018);
  return <g transform={`translate(${city.x} ${city.z}) scale(${scale})`} pointerEvents="none" aria-hidden="true">
    <circle r="130" fill="#002d47" fillOpacity="0.7" stroke="#45d9ff" strokeOpacity="0.55" strokeWidth="6" />
    <circle r="105" fill="none" stroke="#79e7ff" strokeOpacity="0.75" strokeWidth="4" strokeDasharray="24 10" />
    <circle r="65" fill="#005c79" fillOpacity="0.55" stroke="#83eeff" strokeWidth="5" />
    <ellipse cy="15" rx="83" ry="26" fill="none" stroke="#40d6fc" strokeWidth="5" />
    <path d="M -66 14 V -32 L -48 -52 L -31 -32 V 14 M -20 14 V -78 L 0 -106 L 20 -78 V 14 M 30 14 V -40 L 48 -60 L 66 -40 V 14" fill="#063b60" stroke="#92edff" strokeWidth="6" strokeLinejoin="round" />
    <path d="M -49 -52 V -13 M 0 -106 V -16 M 48 -60 V -12" stroke="#b7f7ff" strokeWidth="5" strokeOpacity="0.9" />
    <circle cy="-80" r="10" fill="#d2fbff" />
    <path d="M -110 70 Q 0 110 110 70 M -110 -65 Q 0 -110 110 -65" fill="none" stroke="#34c8ee" strokeOpacity="0.8" strokeWidth="4" />
  </g>;
}
