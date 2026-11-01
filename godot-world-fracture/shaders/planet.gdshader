shader_type spatial;
// The planet: the canon board's painting wrapped on the sphere (unshaded, so the painted colours stay true), with a soft
// night side away from the sun and a faint specular glint on the oceans.
render_mode unshaded, cull_back;

uniform sampler2D albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 sun_dir = vec3(-0.45, 0.35, -0.82);
uniform float night = 0.42;

varying vec3 world_n;

void vertex() {
	world_n = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec3 c = texture(albedo, UV).rgb;
	float lit = clamp(dot(normalize(world_n), normalize(sun_dir)) * 0.9 + 0.55, 0.0, 1.0);
	c *= mix(1.0 - night, 1.08, lit);
	ALBEDO = c;
}
