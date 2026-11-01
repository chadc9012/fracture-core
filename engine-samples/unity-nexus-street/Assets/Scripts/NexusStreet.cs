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
        Player();
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
        var moon = new GameObject("Moon").AddComponent<Light>();
        moon.type = LightType.Directional;
        moon.color = new Color(0.55f, 0.62f, 0.9f);
        moon.intensity = 0.35f;
        moon.shadows = LightShadows.Soft;
        moon.transform.rotation = Quaternion.Euler(50f, 30f, 0f);
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
        return root;
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
        fps = Mathf.Lerp(fps, 1f / Mathf.Max(Time.unscaledDeltaTime, 0.0001f), 0.05f);
    }

    void OnGUI()
    {
        var s = new GUIStyle(GUI.skin.label) { fontSize = Mathf.Max(14, Screen.height / 40) };
        s.normal.textColor = new Color(0.75f, 0.92f, 1f);
        GUI.Label(new Rect(16, 12, 1400, 40), "UNITY 6 (URP) · World Fracture sample · Nexus City street", s);
        s.normal.textColor = new Color(0.7f, 0.7f, 0.8f);
        GUI.Label(new Rect(16, 12 + s.fontSize * 1.6f, 1400, 40), "Left side: drag to walk   ·   Right side: drag to look   ·   Keyboard: WASD + mouse drag", s);
        s.normal.textColor = new Color(1f, 0.85f, 0.4f);
        GUI.Label(new Rect(16, 12 + s.fontSize * 3.2f, 400, 40), $"{Mathf.RoundToInt(fps)} fps", s);
    }
}
