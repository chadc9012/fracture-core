using UnityEngine;
using UnityEngine.Rendering;

/// World Fracture engine sample (Unity 6, URP): a Nexus City street at night, built from code so it matches the Godot sample
/// (engine-samples/godot-nexus-street/main.gd) piece for piece. Left half of the screen: drag to walk. Right half: drag to
/// look. Keyboard: WASD + mouse drag.
public class NexusStreet : MonoBehaviour
{
    // assigned by the build script so the shaders ship in the player (a Shader.Find on an unreferenced shader is stripped)
    public Shader lit;
    public Shader unlit;

    const float StreetLen = 160f;
    CharacterController player;
    Transform playerBody, camPivot, car;
    Camera cam;
    float carT, yaw, pitch = -14f;
    int moveTouch = -1, lookTouch = -1;
    Vector2 moveOrigin, moveVec, lastMouse;
    float fps;
    Light sun;
    readonly System.Collections.Generic.List<Light> nightLights = new();
    readonly System.Collections.Generic.List<Material> windowMats = new();
    bool isDay;
    string zone = "Nexus City";
    System.Random wr = new System.Random(77);

    void Start()
    {
        Application.targetFrameRate = 60;
        Environment();
        Street();
        var rng = new System.Random(1204);
        for (int i = 0; i < 14; i++)
        {
            float side = i % 2 == 0 ? -1f : 1f, z = -70f + (i / 2) * 22f;
            Tower(new Vector3(side * (22f + (float)rng.NextDouble() * 6f), 0, z), 10f + (float)rng.NextDouble() * 6f, 40f + (float)rng.NextDouble() * 80f, i);
        }
        for (int k = 0; k < 9; k++) { float zz = -64f + k * 16f; Lamp(new Vector3(-8.6f, 0, zz)); Lamp(new Vector3(8.6f, 0, zz + 8f)); }
        car = Car(new Color(0.55f, 0.06f, 0.1f));
        WarZone();
        Player();
        SetDay(false);
    }

    // ------------------------------------------------------------ the night
    void Environment()
    {
        RenderSettings.ambientMode = AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.12f, 0.1f, 0.22f);
        RenderSettings.ambientEquatorColor = new Color(0.16f, 0.1f, 0.2f);
        RenderSettings.ambientGroundColor = new Color(0.03f, 0.03f, 0.04f);
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.Exponential;
        RenderSettings.fogDensity = 0.008f;
        RenderSettings.fogColor = new Color(0.18f, 0.12f, 0.26f);
        sun = new GameObject("Sun / moon").AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.shadows = LightShadows.Soft;
    }

    Material Mat(Color c, float smooth = 0.2f, float metal = 0f)
    {
        var m = new Material(lit);
        m.SetColor("_BaseColor", c);
        m.SetFloat("_Smoothness", smooth);
        m.SetFloat("_Metallic", metal);
        return m;
    }
    Material Glow(Color c, float energy = 3f)
    {
        var m = Mat(c * 0.2f);
        m.EnableKeyword("_EMISSION");
        m.SetColor("_EmissionColor", c * energy);
        m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
        return m;
    }
    GameObject Box(Vector3 size, Vector3 pos, Material m, Transform parent = null, bool collide = false)
    {
        var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
        g.transform.SetParent(parent, false);
        g.transform.localPosition = pos;
        g.transform.localScale = size;
        g.GetComponent<Renderer>().sharedMaterial = m;
        if (!collide) Destroy(g.GetComponent<Collider>());
        return g;
    }

    // ------------------------------------------------------------ the street
    void Street()
    {
        Box(new Vector3(14, 0.2f, StreetLen), new Vector3(0, -0.1f, 0), Mat(new Color(0.07f, 0.07f, 0.08f), 0.65f, 0.2f), null, true);  // wet asphalt
        foreach (float s in new[] { -1f, 1f })
        {
            Box(new Vector3(6, 0.35f, StreetLen), new Vector3(s * 10f, 0f, 0), Mat(new Color(0.32f, 0.31f, 0.3f), 0.15f), null, true);
            Box(new Vector3(0.25f, 0.4f, StreetLen), new Vector3(s * 7.1f, 0.05f, 0), Mat(new Color(0.5f, 0.5f, 0.48f), 0.2f));
        }
        for (int z = -76; z < 80; z += 8) Box(new Vector3(0.18f, 0.02f, 3.2f), new Vector3(0, 0.01f, z), Glow(new Color(0.9f, 0.85f, 0.6f), 0.6f));
        Box(new Vector3(200, 0.2f, 200), new Vector3(0, -0.35f, 0), Mat(new Color(0.05f, 0.05f, 0.06f)), null, true);
    }

    Texture2D Windows(int seed)
    {
        var t = new Texture2D(64, 128, TextureFormat.RGB24, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Repeat };
        var rng = new System.Random(seed * 7919 + 1204);
        var px = new Color[64 * 128];
        for (int i = 0; i < px.Length; i++) px[i] = new Color(0.03f, 0.035f, 0.05f);
        for (int j = 0; j < 32; j++) for (int i = 0; i < 16; i++)
        {
            double r = rng.NextDouble();
            var c = r < 0.25 ? new Color(1f, 0.82f, 0.55f) : r < 0.33 ? new Color(0.7f, 0.85f, 1f) : r < 0.36 ? new Color(0.8f, 0.55f, 1f) : new Color(0.05f, 0.06f, 0.08f);
            for (int y = 1; y < 3; y++) for (int x = 1; x < 3; x++) px[(j * 4 + y) * 64 + i * 4 + x] = c;
        }
        t.SetPixels(px);
        t.Apply();
        return t;
    }

    void Tower(Vector3 b, float w, float h, int i)
    {
        var tex = Windows(i);
        var m = Mat(new Color(0.5f, 0.52f, 0.6f), 0.7f, 0.6f);
        m.SetTexture("_BaseMap", tex);
        m.SetTextureScale("_BaseMap", new Vector2(w / 10f, h / 20f));
        m.EnableKeyword("_EMISSION");
        m.SetTexture("_EmissionMap", tex);
        m.SetTextureScale("_EmissionMap", new Vector2(w / 10f, h / 20f));
        m.SetColor("_EmissionColor", Color.white * 1.6f);
        windowMats.Add(m);
        Box(new Vector3(w, h, w), b + new Vector3(0, h / 2f, 0), m, null, true);
        Box(new Vector3(w + 0.4f, 0.5f, w + 0.4f), b + new Vector3(0, h + 0.25f, 0), Glow(new Color(0.7f, 0.4f, 1f), 2f));
    }

    void Lamp(Vector3 at)
    {
        var steel = Mat(new Color(0.12f, 0.12f, 0.13f), 0.5f, 0.8f);
        float dir = at.x < 0 ? 1f : -1f;
        Box(new Vector3(0.18f, 6, 0.18f), at + new Vector3(0, 3, 0), steel);
        Box(new Vector3(1.6f, 0.12f, 0.2f), at + new Vector3(dir * 0.8f, 6, 0), steel);
        Box(new Vector3(0.6f, 0.14f, 0.35f), at + new Vector3(dir * 1.5f, 5.9f, 0), Glow(new Color(1f, 0.78f, 0.5f), 4f));
        var l = new GameObject("Lamp light").AddComponent<Light>();
        l.type = LightType.Point;
        l.color = new Color(1f, 0.75f, 0.48f);
        l.intensity = 2.2f;
        l.range = 13f;
        l.transform.position = at + new Vector3(dir * 1.5f, 5.5f, 0);
        nightLights.Add(l);
    }

    Transform Car(Color paint)
    {
        var root = new GameObject("Car").transform;
        Box(new Vector3(1.9f, 0.55f, 4.4f), new Vector3(0, 0.6f, 0), Mat(paint, 0.85f, 0.7f), root);
        Box(new Vector3(1.6f, 0.5f, 2.2f), new Vector3(0, 1.1f, -0.2f), Mat(new Color(0.05f, 0.07f, 0.1f), 0.95f, 0.9f), root);
        foreach (float x in new[] { -0.95f, 0.95f }) foreach (float z in new[] { -1.4f, 1.4f })
        {
            var wheel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(wheel.GetComponent<Collider>());
            wheel.transform.SetParent(root, false);
            wheel.transform.localPosition = new Vector3(x, 0.36f, z);
            wheel.transform.localRotation = Quaternion.Euler(0, 0, 90);
            wheel.transform.localScale = new Vector3(0.72f, 0.14f, 0.72f);
            wheel.GetComponent<Renderer>().sharedMaterial = Mat(new Color(0.03f, 0.03f, 0.03f), 0.1f);
        }
        foreach (float x in new[] { -0.65f, 0.65f })
        {
            Box(new Vector3(0.4f, 0.12f, 0.05f), new Vector3(x, 0.72f, -2.21f), Glow(new Color(1f, 0.1f, 0.12f), 5f), root);
            Box(new Vector3(0.4f, 0.12f, 0.05f), new Vector3(x, 0.72f, 2.21f), Glow(new Color(0.9f, 0.95f, 1f), 4f), root);
        }
        var head = new GameObject("Headlights").AddComponent<Light>();
        head.type = LightType.Spot;
        head.intensity = 3f;
        head.range = 22f;
        head.spotAngle = 56f;
        head.transform.SetParent(root, false);
        head.transform.localPosition = new Vector3(0, 0.8f, 2.3f);
        nightLights.Add(head);
        return root;
    }

    // ------------------------------------------------------------ day and night
    void SetDay(bool day)
    {
        isDay = day;
        sun.color = day ? new Color(1f, 0.95f, 0.86f) : new Color(0.55f, 0.62f, 0.9f);
        sun.intensity = day ? 1.15f : 0.35f;
        sun.transform.rotation = Quaternion.Euler(day ? 42f : 50f, day ? 35f : 30f, 0f);
        RenderSettings.ambientSkyColor = day ? new Color(0.45f, 0.55f, 0.7f) : new Color(0.12f, 0.1f, 0.22f);
        RenderSettings.ambientEquatorColor = day ? new Color(0.4f, 0.44f, 0.46f) : new Color(0.16f, 0.1f, 0.2f);
        RenderSettings.ambientGroundColor = day ? new Color(0.15f, 0.15f, 0.12f) : new Color(0.03f, 0.03f, 0.04f);
        if (cam) cam.backgroundColor = day ? new Color(0.45f, 0.62f, 0.85f) : new Color(0.05f, 0.04f, 0.1f);
        foreach (var l in nightLights) l.enabled = !day;
        foreach (var m in windowMats)
        {
            m.SetColor("_EmissionColor", Color.white * (day ? 0.15f : 1.6f));
            m.SetColor("_BaseColor", day ? new Color(0.75f, 0.8f, 0.88f) : new Color(0.5f, 0.52f, 0.6f));
        }
    }

    void Teleport()
    {
        player.enabled = false;
        player.transform.position = player.transform.position.z > -90f ? new Vector3(0, 1f, -112f) : new Vector3(3, 1f, 30f);
        player.enabled = true;
        yaw = 180f;
    }

    // ------------------------------------------------------------ the war zone (south of the city)
    /// A two-lane forest road through pines, like the Road to Vostok shot: wrecked armour at a checkpoint, tyres, sandbags,
    /// a gravel berm and a tagged bus shelter, in fog. The pines are static-batched into a few draw calls.
    void WarZone()
    {
        Box(new Vector3(240, 0.2f, 200), new Vector3(0, -0.35f, -180), Mat(new Color(0.2f, 0.22f, 0.14f), 0f), null, true);
        Box(new Vector3(9, 0.2f, 200), new Vector3(0, -0.12f, -180), Mat(new Color(0.3f, 0.3f, 0.3f), 0.1f), null, true);
        for (int z = -90; z > -270; z -= 9) Box(new Vector3(0.15f, 0.02f, 3f), new Vector3(0, 0f, z), Mat(new Color(0.75f, 0.75f, 0.7f), 0.1f));
        Pines();
        var rust = Mat(new Color(0.32f, 0.2f, 0.12f), 0.05f, 0.3f);
        var olive = Mat(new Color(0.26f, 0.27f, 0.18f), 0.15f, 0.2f);
        Apc(new Vector3(-2.5f, 0, -132), 23f, rust);
        Apc(new Vector3(3.2f, 0, -140), -14f, olive);
        Tank(new Vector3(-1f, 0, -158), 9f, rust);
        var bag = Mat(new Color(0.45f, 0.4f, 0.3f), 0f);
        for (int i = 0; i < 10; i++)
        {
            Box(new Vector3(1f, 0.45f, 0.55f), new Vector3(-4f + i * 0.95f, 0.22f, -126f + (i % 2) * 0.1f), bag, null, i % 3 == 0);
            Box(new Vector3(1f, 0.45f, 0.55f), new Vector3(-3.5f + i * 0.95f, 0.66f, -126f), bag);
        }
        var tyre = Mat(new Color(0.05f, 0.05f, 0.05f), 0.1f);
        for (int i = 0; i < 6; i++)
        {
            var t = Prim(PrimitiveType.Cylinder, tyre, null);
            t.transform.position = new Vector3(-6.5f + (i % 2) * 0.3f, 0.12f + (i / 2) * 0.2f, -134f - (i % 3) * 0.9f);
            t.transform.localScale = new Vector3(0.84f, 0.1f, 0.84f);
        }
        var berm = Prim(PrimitiveType.Sphere, Mat(new Color(0.5f, 0.46f, 0.4f), 0f), null);
        berm.transform.position = new Vector3(-9.5f, -0.2f, -136);
        berm.transform.localScale = new Vector3(11.2f, 1.8f, 6.4f);
        Shelter(new Vector3(7.5f, 0, -150));
    }

    GameObject Prim(PrimitiveType t, Material m, Transform parent)
    {
        var g = GameObject.CreatePrimitive(t);
        Destroy(g.GetComponent<Collider>());
        g.transform.SetParent(parent, false);
        g.GetComponent<Renderer>().sharedMaterial = m;
        return g;
    }

    static Mesh ConeMesh(int seg)
    {
        var v = new System.Collections.Generic.List<Vector3>();
        var tri = new System.Collections.Generic.List<int>();
        for (int i = 0; i < seg; i++)
        {
            float a0 = i * Mathf.PI * 2 / seg, a1 = (i + 1) * Mathf.PI * 2 / seg;
            int b = v.Count;
            v.Add(new Vector3(Mathf.Cos(a0) * 0.5f, -0.5f, Mathf.Sin(a0) * 0.5f));
            v.Add(new Vector3(0, 0.5f, 0));
            v.Add(new Vector3(Mathf.Cos(a1) * 0.5f, -0.5f, Mathf.Sin(a1) * 0.5f));
            tri.Add(b); tri.Add(b + 1); tri.Add(b + 2);
        }
        var m = new Mesh();
        m.SetVertices(v);
        m.SetTriangles(tri, 0);
        m.RecalculateNormals();
        return m;
    }

    void Pines()
    {
        var root = new GameObject("Pines");
        var cone = ConeMesh(9);
        var bark = Mat(new Color(0.25f, 0.18f, 0.12f), 0f);
        var needles = new[] { Mat(new Color(0.1f, 0.2f, 0.1f), 0.05f), Mat(new Color(0.14f, 0.23f, 0.12f), 0.05f), Mat(new Color(0.18f, 0.26f, 0.14f), 0.05f) };
        float R(float a, float b) => a + (float)wr.NextDouble() * (b - a);
        for (int i = 0; i < 620; i++)
        {
            float x = R(-110f, 110f), z = R(-275f, -85f);
            if (Mathf.Abs(x) < 8.5f || (Mathf.Abs(x) < 14f && z > -165f && z < -120f)) continue;  // keep the road and checkpoint open
            float h = R(14f, 26f);
            var trunk = Prim(PrimitiveType.Cylinder, bark, root.transform);
            trunk.transform.position = new Vector3(x, h / 2f, z);
            trunk.transform.localScale = new Vector3(0.5f, h / 2f, 0.5f);
            var tint = needles[wr.Next(3)];
            for (int k = 0; k < 3; k++)
            {
                float r = (1f - k * 0.28f) * R(2.2f, 3.2f) * 2f, ch = h * 0.42f;
                var c = new GameObject("tier", typeof(MeshFilter), typeof(MeshRenderer));
                c.transform.SetParent(root.transform, false);
                c.GetComponent<MeshFilter>().sharedMesh = cone;
                c.GetComponent<MeshRenderer>().sharedMaterial = tint;
                c.transform.position = new Vector3(x, h * 0.32f + k * h * 0.2f + ch / 2f, z);
                c.transform.localScale = new Vector3(r, ch, r);
            }
        }
        StaticBatchingUtility.Combine(root);
    }

    void WheelRow(Transform root, float[] xs, float[] zs, float r, Material m)
    {
        foreach (var x in xs) foreach (var z in zs)
        {
            var w = Prim(PrimitiveType.Cylinder, m, root);
            w.transform.localPosition = new Vector3(x, r, z);
            w.transform.localRotation = Quaternion.Euler(0, 0, 90);
            w.transform.localScale = new Vector3(r * 2f, 0.2f, r * 2f);
        }
    }

    void Apc(Vector3 at, float turn, Material paint)
    {
        var root = new GameObject("Wrecked APC").transform;
        root.position = at; root.rotation = Quaternion.Euler(0, turn, 0);
        Box(new Vector3(2.7f, 1.3f, 6.4f), new Vector3(0, 1.35f, 0), paint, root, true);
        Box(new Vector3(2.3f, 0.7f, 2f), new Vector3(0, 2.3f, 2.4f), paint, root);
        Box(new Vector3(1.2f, 0.5f, 1.4f), new Vector3(0, 2.25f, -0.6f), paint, root);
        Box(new Vector3(0.12f, 0.12f, 2.2f), new Vector3(0, 2.3f, 0.9f), Mat(new Color(0.1f, 0.1f, 0.1f), 0.4f, 0.8f), root);
        WheelRow(root, new[] { -1.4f, 1.4f }, new[] { -2.2f, -0.7f, 0.8f, 2.3f }, 0.55f, Mat(new Color(0.06f, 0.06f, 0.06f), 0.1f));
    }

    void Tank(Vector3 at, float turn, Material paint)
    {
        var root = new GameObject("Wrecked tank").transform;
        root.position = at; root.rotation = Quaternion.Euler(0, turn, 0);
        var track = Mat(new Color(0.08f, 0.07f, 0.06f), 0.1f, 0.4f);
        Box(new Vector3(3.4f, 1f, 7f), new Vector3(0, 1f, 0), paint, root, true);
        foreach (var x in new[] { -1.75f, 1.75f }) Box(new Vector3(0.7f, 0.9f, 7.2f), new Vector3(x, 0.45f, 0), track, root);
        var turret = Prim(PrimitiveType.Cylinder, paint, root);
        turret.transform.localPosition = new Vector3(0, 1.9f, -0.4f);
        turret.transform.localScale = new Vector3(2.8f, 0.4f, 2.8f);
        var barrel = Box(new Vector3(0.2f, 0.2f, 4.5f), new Vector3(0.3f, 1.95f, 2.6f), paint, root);
        barrel.transform.localRotation = Quaternion.Euler(-6f, 8f, 0);
    }

    void Shelter(Vector3 at)
    {
        var frame = Mat(new Color(0.35f, 0.3f, 0.26f), 0.2f, 0.5f);
        foreach (var x in new[] { -1.6f, 1.6f }) Box(new Vector3(0.1f, 2.4f, 0.1f), at + new Vector3(x, 1.2f, 0.7f), frame);
        Box(new Vector3(3.4f, 0.1f, 1.8f), at + new Vector3(0, 2.45f, 0), frame);
        var t = new Texture2D(64, 32, TextureFormat.RGB24, false) { filterMode = FilterMode.Point };
        var px = new Color[64 * 32];
        for (int i = 0; i < px.Length; i++) px[i] = new Color(0.7f, 0.68f, 0.62f);
        var ink = new[] { new Color(0.1f, 0.1f, 0.12f), new Color(0.2f, 0.3f, 0.75f), new Color(0.75f, 0.15f, 0.15f) };
        for (int k = 0; k < 260; k++)
        {
            int x0 = wr.Next(0, 61), y0 = wr.Next(4, 27);
            for (int d = 0; d < 3; d++) px[Mathf.Clamp(y0 + (k % 5) - 2, 0, 31) * 64 + Mathf.Clamp(x0 + d, 0, 63)] = ink[k % 3];
        }
        t.SetPixels(px); t.Apply();
        var m = Mat(Color.white, 0.1f);
        m.SetTexture("_BaseMap", t);
        Box(new Vector3(3.3f, 2.2f, 0.06f), at + new Vector3(0, 1.25f, -0.8f), m, null, true);
        Box(new Vector3(2.8f, 0.08f, 0.5f), at + new Vector3(0, 0.5f, -0.4f), frame);
    }

    // ------------------------------------------------------------ the operator
    void Player()
    {
        var go = new GameObject("Operator");
        go.transform.position = new Vector3(3, 1f, 30);
        player = go.AddComponent<CharacterController>();
        player.radius = 0.4f;
        player.height = 1.8f;
        playerBody = new GameObject("Body").transform;
        playerBody.SetParent(go.transform, false);
        var torso = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        Destroy(torso.GetComponent<Collider>());
        torso.transform.SetParent(playerBody, false);
        torso.transform.localPosition = new Vector3(0, -0.1f, 0);
        torso.transform.localScale = new Vector3(0.72f, 0.75f, 0.72f);
        torso.GetComponent<Renderer>().sharedMaterial = Mat(new Color(0.12f, 0.13f, 0.16f), 0.5f, 0.3f);
        var headGo = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        Destroy(headGo.GetComponent<Collider>());
        headGo.transform.SetParent(playerBody, false);
        headGo.transform.localPosition = new Vector3(0, 0.82f, 0);
        headGo.transform.localScale = Vector3.one * 0.4f;
        headGo.GetComponent<Renderer>().sharedMaterial = Mat(new Color(0.36f, 0.24f, 0.17f), 0.4f);
        Box(new Vector3(0.5f, 0.07f, 0.05f), new Vector3(0, 0.85f, 0.19f), Glow(new Color(0.3f, 0.9f, 1f), 4f), playerBody);
        Box(new Vector3(0.06f, 0.9f, 0.06f), new Vector3(0.3f, 0.1f, 0f), Glow(new Color(0.3f, 0.9f, 1f), 2.5f), playerBody);
        camPivot = new GameObject("Camera pivot").transform;
        camPivot.SetParent(go.transform, false);
        camPivot.localPosition = new Vector3(0, 0.9f, 0);
        cam = new GameObject("Camera").AddComponent<Camera>();
        cam.fieldOfView = 65f;
        cam.backgroundColor = new Color(0.05f, 0.04f, 0.1f);
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.transform.SetParent(camPivot, false);
        cam.transform.localPosition = new Vector3(0.6f, 0, -4.2f);
    }

    // ------------------------------------------------------------ input and motion
    void Update()
    {
        float half = Screen.width * 0.5f;
        foreach (var t in Input.touches)
        {
            if (t.phase == TouchPhase.Began)
            {
                if (t.position.x < half && moveTouch == -1) { moveTouch = t.fingerId; moveOrigin = t.position; }
                else if (t.position.x >= half && lookTouch == -1) lookTouch = t.fingerId;
            }
            else if (t.phase == TouchPhase.Moved)
            {
                if (t.fingerId == moveTouch) moveVec = Vector2.ClampMagnitude((t.position - moveOrigin) / 70f, 1f);
                else if (t.fingerId == lookTouch) { yaw += t.deltaPosition.x * 0.35f; pitch = Mathf.Clamp(pitch - t.deltaPosition.y * 0.25f, -60f, 20f); }
            }
            else if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
            {
                if (t.fingerId == moveTouch) { moveTouch = -1; moveVec = Vector2.zero; }
                if (t.fingerId == lookTouch) lookTouch = -1;
            }
        }
        if (Input.touchCount == 0 && Input.GetMouseButton(0))
        {
            Vector2 m = Input.mousePosition, d = m - lastMouse;
            if (!Input.GetMouseButtonDown(0)) { yaw += d.x * 0.35f; pitch = Mathf.Clamp(pitch - d.y * 0.25f, -60f, 20f); }
        }
        lastMouse = Input.mousePosition;

        // touch moves up-screen = forward (screen y grows upward in Unity), keys add on top
        var input = new Vector2(moveVec.x, moveVec.y);
        if (Input.GetKey(KeyCode.W)) input.y += 1;
        if (Input.GetKey(KeyCode.S)) input.y -= 1;
        if (Input.GetKey(KeyCode.A)) input.x -= 1;
        if (Input.GetKey(KeyCode.D)) input.x += 1;
        input = Vector2.ClampMagnitude(input, 1f);
        var dir = Quaternion.Euler(0, yaw, 0) * new Vector3(input.x, 0, input.y);
        player.Move((dir * 5.5f + Vector3.down * 9.8f) * Time.deltaTime);
        if (dir.sqrMagnitude > 0.01f) playerBody.rotation = Quaternion.Slerp(playerBody.rotation, Quaternion.LookRotation(dir), 10f * Time.deltaTime);
        camPivot.rotation = Quaternion.Euler(-pitch, yaw, 0);

        // the car loops up and down the street
        carT += Time.deltaTime * 0.09f;
        float lane = (carT % 2f) < 1f ? 3.2f : -3.2f, u = carT % 1f;
        car.position = new Vector3(lane, 0, lane > 0 ? Mathf.Lerp(-74f, 74f, u) : Mathf.Lerp(74f, -74f, u));
        car.rotation = Quaternion.Euler(0, lane > 0 ? 0 : 180, 0);
        if (Input.GetKeyDown(KeyCode.N)) SetDay(!isDay);
        if (Input.GetKeyDown(KeyCode.T)) Teleport();
        float war = Mathf.Clamp01((-player.transform.position.z - 80f) / 30f);
        RenderSettings.fogDensity = Mathf.Lerp(isDay ? 0.006f : 0.008f, 0.016f, war);
        var cityFog = isDay ? new Color(0.55f, 0.62f, 0.72f) : new Color(0.18f, 0.12f, 0.26f);
        var warFog = isDay ? new Color(0.5f, 0.55f, 0.52f) : new Color(0.1f, 0.12f, 0.13f);
        RenderSettings.fogColor = Color.Lerp(cityFog, warFog, war);
        zone = war > 0.5f ? "war zone" : "Nexus City";
        fps = Mathf.Lerp(fps, 1f / Mathf.Max(Time.unscaledDeltaTime, 0.0001f), 0.05f);
    }

    void OnGUI()
    {
        var s = new GUIStyle(GUI.skin.label) { fontSize = Mathf.Max(14, Screen.height / 40) };
        s.normal.textColor = new Color(0.75f, 0.92f, 1f);
        GUI.Label(new Rect(16, 12, 1400, 40), "UNITY 6 (URP) · World Fracture sample · Nexus City street", s);
        s.normal.textColor = new Color(0.7f, 0.7f, 0.8f);
        GUI.Label(new Rect(16, 12 + s.fontSize * 1.6f, 1400, 40), "Left side: drag to walk   ·   Right side: drag to look   ·   Keyboard: WASD, N day/night, T travel", s);
        s.normal.textColor = new Color(1f, 0.85f, 0.4f);
        GUI.Label(new Rect(16, 12 + s.fontSize * 3.2f, 600, 40), $"{Mathf.RoundToInt(fps)} fps · {zone} · {(isDay ? "day" : "night")}", s);
        var b = new GUIStyle(GUI.skin.button) { fontSize = s.fontSize };
        float bw = Screen.height * 0.3f, bh = Screen.height * 0.075f;
        if (GUI.Button(new Rect(Screen.width - bw - 16, 16, bw, bh), "DAY / NIGHT", b)) SetDay(!isDay);
        if (GUI.Button(new Rect(Screen.width - bw - 16, 24 + bh, bw, bh), "CITY / WAR ZONE", b)) Teleport();
    }
}
