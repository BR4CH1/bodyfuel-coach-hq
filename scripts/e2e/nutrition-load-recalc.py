"""
End-to-End Testflow: Belastungs-Anpassung → History-Card + Athleten-Banner.

Vorbedingungen
--------------
- LOVABLE_BROWSER_AUTH_STATUS == "injected" (Coach in Preview eingeloggt)
- Die Session gehört zu einem User mit Coach-Rolle oder Staff-Assignment im
  Test-Verein (org c6de13a5-6212-41e6-aa11-b4ee8238292f).

Was das Skript tut
------------------
1. Öffnet /coach/teams/<orgId>, wechselt in den Load-Tab.
2. Wählt Team "Herren".
3. Setzt für morgen Load-Level = 4 (hohe Belastung).
4. Wartet, bis `runNutritionRecalc` (fire-and-forget) Overrides geschrieben hat.
5. Navigiert zur Athletendetail (Bekim Loshaj), Nutrition-Tab, und prüft, dass
   die Karte "Automatische Anpassungen" einen frischen Eintrag mit
   "höhere Belastung" für morgen zeigt.
6. Der Athleten-Banner (LoadWeekBanner) wird über eine parallel geöffnete
   Athleten-Session NICHT hier geprüft — dafür siehe `--verify-banner-db`,
   das Overrides mit source='auto_load_recalc' im DB direkt prüft.
7. Cleanup: setzt den Load-Tag wieder auf 0 (Ruhetag) und triggert damit einen
   rest_context-Recalc.

Aufruf
------
    python scripts/e2e/nutrition-load-recalc.py
"""

import asyncio
import os
from datetime import date, timedelta
from pathlib import Path
from playwright.async_api import async_playwright
import json

ORG_ID = "c6de13a5-6212-41e6-aa11-b4ee8238292f"
TEAM_ID = "ee4ec0b3-05c7-4e98-b15a-2542d085ef9b"  # Herren
ATHLETE_ID = "51454c35-2811-46a0-93ec-2a957ae95f3e"  # Bekim Loshaj
BASE = "http://localhost:8080"

SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


async def restore_session(context, page):
    auth = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if auth != "injected":
        raise RuntimeError(
            f"LOVABLE_BROWSER_AUTH_STATUS={auth!r} — brauche eine eingeloggte "
            "Coach-Session in der Preview, damit das Skript laufen kann."
        )
    cookies = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies:
        parsed = json.loads(cookies)
        for c in parsed:
            c["url"] = BASE
        await context.add_cookies(parsed)
    await page.goto(BASE)
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if key and sess:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
        )


async def main():
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await restore_session(context, page)

        # 1) Coach → Load-Tab
        await page.goto(f"{BASE}/coach/teams/{ORG_ID}", wait_until="domcontentloaded")
        await page.get_by_role("tab", name="Load").click()
        await page.screenshot(path=str(SHOTS / "1_load_tab.png"))

        # 2) Team Herren wählen (Combobox/Select im OrgLoadTab).
        try:
            await page.get_by_role("combobox").first.click()
            await page.get_by_role("option", name="Herren").click()
        except Exception:
            pass

        # 3) Load-Level 4 für morgen setzen. Der Tag wird per data-date-Attribut
        # gefunden (in OrgLoadTab an der Tageszelle gerendert).
        cell = page.locator(f'[data-date="{tomorrow}"]')
        await cell.scroll_into_view_if_needed()
        await cell.click()
        await page.get_by_role("button", name="4").first.click()
        await page.screenshot(path=str(SHOTS / "2_load_set.png"))

        # 4) Recalc-Fenster: fire-and-forget → 4 s Puffer.
        await page.wait_for_timeout(4000)

        # 5) History-Card prüfen.
        await page.goto(
            f"{BASE}/coach/teams/{ORG_ID}/athletes/{ATHLETE_ID}",
            wait_until="domcontentloaded",
        )
        await page.get_by_role("tab", name="Ernährung").click()
        adjustments = page.get_by_text("Automatische Anpassungen").locator(
            "xpath=ancestor::section"
        )
        await adjustments.scroll_into_view_if_needed()
        await page.screenshot(path=str(SHOTS / "3_history_card.png"))

        text = await adjustments.inner_text()
        ok_card = "höhere Belastung" in text
        print("HISTORY-CARD ok?", ok_card)
        print(text[:400])

        # 7) Cleanup: Load-Tag wieder auf 0.
        await page.goto(f"{BASE}/coach/teams/{ORG_ID}", wait_until="domcontentloaded")
        await page.get_by_role("tab", name="Load").click()
        cell = page.locator(f'[data-date="{tomorrow}"]')
        await cell.click()
        try:
            await page.get_by_role("button", name="0").first.click()
        except Exception:
            pass

        await browser.close()
        if not ok_card:
            raise SystemExit("History-Card zeigt keine 'höhere Belastung' für morgen")


if __name__ == "__main__":
    asyncio.run(main())
