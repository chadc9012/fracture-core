"""Real-browser Gamepad API regressions. Run: python3 scripts/tests/gamepad_onboarding.py

Requires the running game at localhost:8080 and Python Playwright. All saves are
isolated by ?profile=test; artifacts go to /tmp/browser/gamepad-onboarding.
No menu handlers, keyboard input, gameplay state or model loaders are mocked.
"""
import json
import os
import unittest
from pathlib import Path

from playwright.async_api import async_playwright, expect

expect.set_options(timeout=60000)

ARTIFACTS = Path("/tmp/browser/gamepad-onboarding")
ORIGIN = os.environ.get("GAME_TEST_ORIGIN", "http://localhost:8080")
SAVE_KEY = "world-fracture.progression.v1.test-profile"

INSTALL_PAD = """(id) => {
  window.testPad = {id, index: 1, connected: true, mapping: 'standard',
    timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({length: 17}, () => ({pressed:false,touched:false,value:0}))};
  window.padReads = 0;
  Object.defineProperty(navigator, 'getGamepads', {configurable: true, value: () => {
    window.padReads++;
    const snapshot = {...window.testPad, axes:[...window.testPad.axes],
      buttons:window.testPad.buttons.map(b => ({...b}))};
    if (window.padPulse) {
      window.padPulse=false;
      window.testPad.buttons.forEach(b => {b.pressed=false;b.touched=false;b.value=0});
      window.testPad.axes.fill(0);
    }
    return [null, window.testPad.connected ? snapshot : null, null, null];
  }});
  const event = new Event('gamepadconnected');
  Object.defineProperty(event, 'gamepad', {value: window.testPad});
  window.dispatchEvent(event);
}"""


class GamepadOnboarding(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        self.pw = await async_playwright().start()
        self.browser = await self.pw.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            viewport={"width": 1280, "height": 1800}, reduced_motion="reduce")
        self.page = await self.context.new_page()
        self.page.set_default_timeout(60000)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        await self.page.goto(f"{ORIGIN}/?profile=test", wait_until="domcontentloaded")
        await self.page.evaluate("sessionStorage.setItem('world-fracture-boot-seen','1')")
        await self.page.reload(wait_until="domcontentloaded")
        await expect(self.page.get_by_role("navigation", name="Main menu")).to_be_visible()

    async def asyncTearDown(self):
        await self.browser.close()
        await self.pw.stop()

    async def frames(self, count=2):
        start = await self.page.evaluate("window.padReads")
        await self.page.wait_for_function("n => window.padReads >= n", arg=start + count)

    async def release(self):
        await self.page.evaluate("""() => {
          testPad.buttons.forEach(b => {b.pressed=false;b.touched=false;b.value=0});
          testPad.axes.fill(0); testPad.timestamp=performance.now();
        }""")
        await self.frames()

    async def press(self, button=None, axis=None):
        await self.page.evaluate("""([button, axis]) => {
          if (button !== null) testPad.buttons[button]={pressed:true,touched:true,value:1};
          if (axis !== null) testPad.axes[1]=axis;
          testPad.timestamp=performance.now(); window.padPulse=true;
        }""", [button, axis])
        await self.frames()
        await self.release()

    async def saved(self):
        return await self.page.evaluate("k => JSON.parse(localStorage.getItem(k) || 'null')", SAVE_KEY)

    async def operator_flow(self, name, cls, moves, subclass, default_subclass, pad_id):
        await self.page.evaluate(INSTALL_PAD, pad_id)
        await self.press(0)  # Main menu New Game
        await expect(self.page.get_by_role("button", name="Imprint GOLIATH", exact=True)).to_be_visible()
        await self.release()  # neutral frame after the new screen attaches its poll

        # Disconnected slots must not navigate, even with a stale pressed button.
        await self.page.evaluate("testPad.connected=false; testPad.buttons[13].pressed=true")
        await self.frames()
        await expect(self.page.get_by_role("button", name="Imprint GOLIATH", exact=True)).to_be_visible()
        await self.page.evaluate("testPad.buttons[13].pressed=false; testPad.connected=true")
        await self.release()
        for _ in range(moves):
            await self.press(13)
        await expect(self.page.get_by_role("button", name=f"Imprint {name}", exact=True)).to_be_visible()
        # Up/down round trip uses both D-pad and the real stick-Y API path.
        await self.press(12)
        await self.press(axis=0.9)
        preview = self.page.get_by_role("img", name=f"{name} male preview", exact=True)
        await expect(preview).to_be_visible()
        await expect(preview.locator("canvas")).to_be_visible()
        await preview.screenshot(path=str(ARTIFACTS / f"{name}-preview.png"), timeout=90000)

        await self.press(0)
        await expect(self.page.get_by_role("button", name="Choose body profile", exact=True)).to_be_visible()
        await self.press(13)  # choose the second subclass
        await self.press(0)
        await expect(self.page.get_by_role("heading", name="Choose your silhouette")).to_be_visible()
        await self.press(13)  # male -> robot preview
        await expect(self.page.get_by_role("img", name=f"{name} robot preview", exact=True)).to_be_visible()
        await self.press(1)  # B/Circle backs out, retaining subclass/body
        await expect(self.page.get_by_role("button", name="Choose body profile", exact=True)).to_be_visible()
        await self.press(0)
        await expect(self.page.get_by_role("img", name=f"{name} robot preview", exact=True)).to_be_visible()

        # Hold A/Cross through the save/assembly: no second save or auto-launch.
        await self.page.evaluate("testPad.buttons[0]={pressed:true,touched:true,value:1}")
        await expect(self.page.get_by_role("button", name="Launch mission", exact=True)).to_be_visible()
        await self.release()
        save = await self.saved()
        self.assertIsNotNone(save)
        self.assertEqual(save["character"]["classId"], cls)
        self.assertEqual(save["character"]["operatorId"], name.lower())
        self.assertEqual(save["character"]["subclassId"], subclass)
        self.assertNotEqual(subclass, default_subclass)
        self.assertEqual(save["character"]["bodyType"], "robot")
        self.assertFalse(save.get("introSeen", False), "Held confirm must not skip the briefing")
        deployment_id = save["character"]["deploymentId"]
        await self.page.screenshot(path=str(ARTIFACTS / f"{name}-briefing.png"), timeout=90000)
        await self.press(0)
        await expect(self.page.get_by_role("button", name="Launch mission", exact=True)).to_have_count(0)
        await self.page.wait_for_function("k => JSON.parse(localStorage.getItem(k) || '{}').introSeen === true", arg=SAVE_KEY)
        deployed = await self.saved()
        self.assertEqual(deployed["identityClass"], cls)
        self.assertEqual(deployed["character"]["deploymentId"], deployment_id)
        self.assertEqual(deployed["character"]["subclassId"], subclass)
        self.assertEqual(self.errors, [], "No uncaught runtime errors during controller onboarding")
        (ARTIFACTS / f"{name}-result.json").write_text(json.dumps({
            "operator": name, "class": cls, "subclass": subclass,
            "bodyType": "robot", "launched": True, "runtimeErrors": self.errors}, indent=2))

    async def test_goliath_xbox(self):
        await self.operator_flow("GOLIATH", "TITAN", 0, "BERSERKER_TITAN", "SHIELD_TITAN", "Xbox 360 Controller (XInput STANDARD GAMEPAD)")

    async def test_nyx_playstation(self):
        await self.operator_flow("NYX", "HUNTER", 1, "TRACKER_HUNTER", "SHADOW_HUNTER", "DualSense Wireless Controller (054c)")

    async def test_cipher_generic(self):
        await self.operator_flow("CIPHER", "WARLOCK", 2, "VOID_WARLOCK", "CODE_WARLOCK", "Generic STANDARD GAMEPAD")


if __name__ == "__main__":
    unittest.main(verbosity=2)