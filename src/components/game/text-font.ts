import { configureTextBuilder } from "troika-three-text";

/** In-world text (drei <Text>) uses the game's own HUD face, served locally as WOFF (troika cannot read woff2). With no font set, troika resolves fonts per glyph from
 * cdn.jsdelivr.net, which put every sign label on a third-party CDN and left the world stuck on "Loading world" wherever that CDN was
 * blocked or slow. Imported once by GameCanvas before any text renders. */
configureTextBuilder({ defaultFontURL: "/fonts/rajdhani-latin-600-normal.woff" });
