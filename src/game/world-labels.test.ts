import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// drei's Text suspends on a runtime font fetch from a CDN; a direct import outside SafeText lets one blocked or slow fetch
// hold the whole world scene in loading (Interiors.tsx lift labels did, Oct 25). SafeText isolates each label and uses a local font.
test("world labels import Text from SafeText, never straight from drei", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "components", "game");
  const offenders = readdirSync(dir).filter((f) => f.endsWith(".tsx") && f !== "SafeText.tsx")
    .filter((f) => /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*"@react-three\/drei"/.test(readFileSync(join(dir, f), "utf8")));
  expect(offenders).toEqual([]);
});
