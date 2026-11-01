shader_type spatial;
// The atmosphere rim: a slightly larger sphere seen from inside, bright at the limb (fresnel), added over space.
render_mode unshaded, cull_front, blend_add, depth_draw_never;

uniform vec4 tint : source_color = vec4(0.37, 0.78, 1.0, 1.0);
uniform float power = 2.6;
uniform float strength = 1.25;

void fragment() {
	float f = pow(1.0 - abs(dot(NORMAL, VIEW)), power);
	ALBEDO = tint.rgb * strength * f;
	ALPHA = f;
}
