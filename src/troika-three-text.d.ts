/** troika-three-text ships no types; only the builder config is used directly (drei's <Text> wraps the rest). */
declare module "troika-three-text" {
  export function configureTextBuilder(config: { defaultFontURL?: string | null; unicodeFontsURL?: string | null; sdfGlyphSize?: number; useWorker?: boolean }): void;
}
