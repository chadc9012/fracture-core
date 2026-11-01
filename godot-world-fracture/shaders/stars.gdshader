shader_type sky;
// Deep space behind the globe: navy towards one side like the board's backdrop, with a field of small stars.

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

void sky() {
	vec3 d = normalize(EYEDIR);
	vec3 base = mix(vec3(0.008, 0.02, 0.047), vec3(0.06, 0.14, 0.27), pow(clamp(dot(d, normalize(vec3(0.3, 0.2, -1.0))) * 0.5 + 0.5, 0.0, 1.0), 3.0));
	vec3 cell = floor(d * 220.0);
	float h = hash(cell);
	float star = step(0.9965, h) * (0.5 + 0.5 * hash(cell + 7.0));
	vec3 f = fract(d * 220.0) - 0.5;
	star *= smoothstep(0.5, 0.0, length(f));
	COLOR = base + vec3(0.8, 0.9, 1.0) * star * 1.6;
}
