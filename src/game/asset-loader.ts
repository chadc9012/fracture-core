/** Resilient model/image loading. Every asset resolves to *something*: on error or timeout a
 * simple placeholder is returned, so one broken file can never suspend or crash the 3D world. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const TIMEOUT_MS = 12000;

type Entry<T> = { status: "pending" | "done"; value?: T; promise: Promise<void> };
const models = new Map<string, Entry<THREE.Object3D>>();
const textures = new Map<string, Entry<THREE.Texture>>();

function withTimeout<T>(p: Promise<T>, fallback: () => T, label: string): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => { console.warn("[assets] timed out, using fallback:", label); resolve(fallback()); }, TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => {
      clearTimeout(t);
      console.warn("[assets] failed, using fallback:", label, e);
      resolve(fallback());
    });
  });
}

export function fallbackModel(): THREE.Object3D {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: "#3a4650", roughness: 0.8, metalness: 0.2 }),
  );
  g.add(mesh);
  return g;
}

export function fallbackTexture(): THREE.Texture {
  const data = new Uint8Array([0, 0, 0, 0]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

export function preloadModel(url: string): Promise<void> {
  const hit = models.get(url);
  if (hit) return hit.promise;
  const entry: Entry<THREE.Object3D> = { status: "pending", promise: Promise.resolve() };
  const load = new Promise<THREE.Object3D>((res, rej) => new GLTFLoader().load(url, (g) => res(g.scene), undefined, rej));
  entry.promise = withTimeout(load, fallbackModel, url).then((v) => { entry.value = v; entry.status = "done"; });
  models.set(url, entry);
  return entry.promise;
}

export function preloadTexture(url: string): Promise<void> {
  const hit = textures.get(url);
  if (hit) return hit.promise;
  const entry: Entry<THREE.Texture> = { status: "pending", promise: Promise.resolve() };
  const load = new THREE.TextureLoader().loadAsync(url).then((t) => { t.colorSpace = THREE.SRGBColorSpace; return t; });
  entry.promise = withTimeout(load, fallbackTexture, url).then((v) => { entry.value = v; entry.status = "done"; });
  textures.set(url, entry);
  return entry.promise;
}

/** Suspense-friendly read: suspends while loading, never throws an error. */
export function readModel(url: string): THREE.Object3D {
  const e = models.get(url) ?? (preloadModel(url), models.get(url)!);
  if (e.status !== "done") throw e.promise;
  return e.value!;
}

export function readTexture(url: string): THREE.Texture {
  const e = textures.get(url) ?? (preloadTexture(url), textures.get(url)!);
  if (e.status !== "done") throw e.promise;
  return e.value!;
}

/** Browser image warm-up for plain <img>/CSS images (no-op on the server). */
export function preloadImages(urls: string[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return Promise.all(urls.map((u) => new Promise<void>((res) => {
    const img = new Image();
    img.onload = img.onerror = () => res();
    img.src = u;
  }))).then(() => undefined);
}
