extends RefCounted
## The wet night of the owner's Nexus City renders (docs/reference/nexus-city-*.png, Nov 8): every neon sign, headlight
## and lit window mirrored as long smeared streaks in the asphalt and the paving, rain falling through the lamp light.
##
## The project renders with Godot's mobile renderer (the phone), which has no screen-space reflections, and a reflection
## probe can't see moving cars or the neon that blinks. So the wet ground gets its reflections from a thin overlay laid on
## the road and the walks: an additive pass that marches the mirrored view ray through the depth buffer for a dozen steps
## and, where it meets the scene, adds what the screen shows there — blurred down the mips and stretched vertically the
## way rain-soaked asphalt smears light, weighted by the puddle mask and the Fresnel term. Where the ray finds nothing
## the overlay adds nothing, so dry patches stay matte. It costs one screen copy and a short loop per covered pixel; the
## web build (gl_compatibility) skips it and keeps the plain wet materials.
##
## Rain is one GPU particle box that follows the camera: thin streaks lit by the scene, sized for the phone.

const OVERLAY := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform sampler2D puddle_noise : hint_default_white, repeat_enable;
uniform float strength = 0.85;     // how much of the mirrored scene comes back
uniform float base_wet = 0.45;     // the whole surface is damp; puddles go to 1
uniform float blur = 2.5;          // mip level: wet asphalt is a rough mirror
uniform float streak = 0.035;      // vertical smear of the lights, in screen UV
uniform float max_dist = 60.0;
uniform float time_scale = 1.0;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
vec3 view_at(vec2 uv, mat4 inv_proj) {
	float d = textureLod(depth_tex, uv, 0.0).r;
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, d, 1.0);
	return v.xyz / v.w;
}
void fragment() {
	vec2 p = wpos.xz;
	float puddle = smoothstep(0.5, 0.62, texture(puddle_noise, p * 0.018).r * 0.8 + texture(puddle_noise, p * 0.07).r * 0.3);
	float wet = clamp(base_wet + puddle, 0.0, 1.0);
	// rain rings on the puddles: tiny expanding circles that wobble the reflection
	vec2 cell = floor(p * 1.6);
	vec2 cf = fract(p * 1.6) - 0.5;
	float seed = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
	float ph = fract(TIME * time_scale * 0.9 + seed);
	float ring = smoothstep(0.06, 0.0, abs(length(cf) - ph * 0.45)) * (1.0 - ph) * puddle;
	vec3 vn = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz + (VIEW_MATRIX * vec4(cf.x, 0.0, cf.y, 0.0)).xyz * ring * 0.15);
	vec3 v = normalize(VERTEX);
	vec3 r = reflect(v, vn);
	// march the mirrored ray through the depth buffer
	vec3 hit = vec3(0.0);
	float found = 0.0;
	float t = 0.4;
	vec2 huv = vec2(0.0);
	for (int i = 0; i < 14; i++) {
		vec3 q = VERTEX + r * t;
		vec4 c = PROJECTION_MATRIX * vec4(q, 1.0);
		vec2 uv = c.xy / c.w * 0.5 + 0.5;
		if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || t > max_dist) { break; }
		vec3 s = view_at(uv, INV_PROJECTION_MATRIX);
		float dz = s.z - q.z;   // > 0: the scene surface is in front of the ray point (the ray went behind it)
		if (dz > 0.0 && dz < t * 0.35 + 0.6) {
			found = 1.0 - smoothstep(0.75, 1.0, t / max_dist);
			huv = uv;
			break;
		}
		t *= 1.38;
	}
	if (found > 0.0) {
		// screen-edge fade, then the vertical smear of wet asphalt
		vec2 e = smoothstep(vec2(0.0), vec2(0.08), huv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - huv);
		found *= e.x * e.y;
		vec3 col = textureLod(screen_tex, huv, blur).rgb * 0.4;
		col += textureLod(screen_tex, huv + vec2(0.0, streak), blur + 0.5).rgb * 0.3;
		col += textureLod(screen_tex, huv - vec2(0.0, streak), blur + 0.5).rgb * 0.3;
		hit = col;
	}
	float fres = mix(0.25, 1.0, pow(clamp(1.0 - abs(dot(-v, vn)), 0.0, 1.0), 3.0));
	ALBEDO = hit * found * wet * fres * strength;
}
"""

static func supported() -> bool:
	return RenderingServer.get_current_rendering_method() != "gl_compatibility"

static func _noise(freq: float, octaves: int, size := 512) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = freq
	n.fractal_octaves = octaves
	var t := NoiseTexture2D.new()
	t.width = size
	t.height = size
	t.seamless = true
	t.noise = n
	return t

static func overlay_material(strength := 0.85, base_wet := 0.45) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = OVERLAY
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("puddle_noise", _noise(0.004, 4))
	m.set_shader_parameter("strength", strength)
	m.set_shader_parameter("base_wet", base_wet)
	# the transparent pass draws after the opaque scene, so the overlay sees the finished street
	m.render_priority = -10
	return m

## lay the mirror over a flat surface: `size` x/z, `at` the centre of its top face (a hair above it)
static func overlay(parent: Node3D, size: Vector2, at: Vector3, mat: ShaderMaterial) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	mi.position = at + Vector3(0, 0.012, 0)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.extra_cull_margin = 2.0
	parent.add_child(mi)
	return mi

## rain: streaks falling through a box that the caller keeps centred on the camera (`follow`)
static func rain(parent: Node3D, amount := 1400) -> GPUParticles3D:
	var gp := GPUParticles3D.new()
	gp.amount = amount
	gp.lifetime = 1.1
	gp.preprocess = 1.1
	gp.local_coords = false
	gp.visibility_aabb = AABB(Vector3(-24, -16, -24), Vector3(48, 32, 48))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(20, 0.5, 20)
	pm.direction = Vector3(0.08, -1, 0.04)
	pm.spread = 2.0
	pm.initial_velocity_min = 17.0
	pm.initial_velocity_max = 22.0
	pm.gravity = Vector3(0, -6, 0)
	gp.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.018, 0.55)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	m.albedo_color = Color(0.55, 0.62, 0.85, 0.32)
	m.disable_receive_shadows = true
	q.material = m
	gp.draw_pass_1 = q
	gp.position = Vector3(0, 14, 0)
	parent.add_child(gp)
	return gp

static func follow(rain_node: GPUParticles3D, cam: Camera3D) -> void:
	if rain_node and cam:
		rain_node.global_position = cam.global_position + Vector3(0, 12, 0) - cam.global_basis.z * 8.0
