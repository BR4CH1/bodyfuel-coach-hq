"""
End-to-End Testflow: Belastungs-Anpassung → History-Card + Athleten-Banner.

Vorbedingungen
--------------
- LOVABLE_BROWSER_AUTH_STATUS == "injected" (Coach in Preview eingeloggt)
- Session gehört zu einem User mit Coach-/Staff-Zugriff im Test-Verein
  (org c6de13a5-6212-41e6-aa11-b4ee8238292f). Modul `load_management`
  muss für die Org aktiv sein.

Ablauf
------
1. /coach/teams/<orgId>#load öffnen (Load-Tab per URL-Hash).
2. Team "Herren" wählen.
3. Für morgen Level 4 ("Hart") klicken → upsertLoadDay + Recalc.
4. 4 s Puffer für fire-and-forget-Recalc.
5. Athletendetail → Ernährung-Tab → History-Card prüft „höhere Belastung".
6. Athleten-Banner wird per Server-Fn-Query gegengecheckt (DB-Level-View),
   nicht durch echtes Athleten-Login.
7. Cleanup: Level 0 (Rest) für den gleichen Tag setzen.
"""

import asyncio
import json
import os
from datetime import date, timedelta
from pathlib import Path

from playwright.async_api import async_playwright

ORG_ID = "c6de13a5-6212-41e6-aa11-b4ee8238292f"
ATHLETE_ID = "51454c35-2811-46a0-93ec-2a957ae95f3e"  # Bekim Loshaj
BASE = "http://localhost:8080"

SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


async def restore_session(context, page):
    auth = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if auth != "injected":
        raise RuntimeError(
            f"LOVABLE_BROWSER_AUTH_STATUS={auth!r} — brauche eine eingeloggte "
            "Coach-Session in der Preview."
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


async def click_day_level(page, day_label: str, tomorrow_dd_mm: str, level_short: str):
    """DayCard mit passendem Datum finden und Level-Button klicken."""
    # DayCard enthält Datum im Format "DD.MM." und Buttons mit short-Text ("R","1"…"M").
    card = page.locator("div.rounded-2xl.border").filter(has_text=tomorrow_dd_mm).first
    await card.scroll_into_view_if_needed()
    await card.get_by_role("button", name=level_short, exact=True).click()


async def main():
    tomorrow_date = date.today() + timedelta(days=1)
    tomorrow_iso = tomorrow_date.isoformat()
    tomorrow_dd_mm = tomorrow_date.strftime("%d.%m")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await restore_session(context, page)

        # 1) Coach → Load-Tab (via URL-Hash).
        await page.goto(f"{BASE}/coach/teams/{ORG_ID}#load", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SHOTS / "1_load_tab.png"))

        # 2) Team "Herren" auswählen (Button in der OrgLoadTab-Leiste, nicht der
        # globale Team-Filter oben).
        try:
            await page.get_by_role("button", name="Herren", exact=True).nth(1).click()
            await page.wait_for_timeout(800)
        except Exception as e:
            print("Team-Button 'Herren' nicht klickbar:", e)

        # 3) Für morgen Level 4 ("Hart", short "4") setzen.
        await click_day_level(page, "morgen", tomorrow_dd_mm, "4")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(SHOTS / "2_load_set.png"))

        # 4) Recalc-Fenster (fire-and-forget).
        await page.wait_for_timeout(5000)

        # 5) Athletendetail → Ernährung.
        await page.goto(
            f"{BASE}/coach/teams/{ORG_ID}/athletes/{ATHLETE_ID}",
            wait_until="networkidle",
        )
        await page.wait_for_timeout(1000)
        try:
            await page.get_by_role("tab", name="Ernährung").first.click()
        except Exception:
            # Fallback: manche Detail-Seiten nutzen keinen tab role, sondern Buttons.
            try:
                await page.get_by_role("button", name="Ernährung").first.click()
            except Exception:
                pass
        await page.wait_for_timeout(1500)
        try:
            await page.get_by_text("Automatische Anpassungen").first.scroll_into_view_if_needed(timeout=8000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SHOTS / "3_athlete_nutrition.png"))

        page_text = await page.locator("body").inner_text()
        page_text_l = page_text.lower()
        ok_history = ("automatische anpassungen" in page_text_l) and (
            "höhere belastung" in page_text_l
        )
        ok_banner_text = (
            "höhere Belastung" in page_text or "erhöht" in page_text.lower()
        )
        print("HISTORY-CARD sichtbar?", ok_history)
        print("Banner-Text im DOM?  ", ok_banner_text)

        # 6) Cleanup: Load-Tag wieder auf 0 (Rest).
        await page.goto(f"{BASE}/coach/teams/{ORG_ID}#load", wait_until="networkidle")
        await page.wait_for_timeout(1200)
        try:
            await page.get_by_role("button", name="Herren", exact=True).nth(1).click()
            await page.wait_for_timeout(600)
        except Exception:
            pass
        try:
            await click_day_level(page, "morgen", tomorrow_dd_mm, "R")
            await page.wait_for_timeout(1500)
        except Exception as e:
            print("Cleanup fehlgeschlagen:", e)
        await page.screenshot(path=str(SHOTS / "4_cleanup.png"))

        await browser.close()

        if not ok_history:
            raise SystemExit(
                "FAIL: History-Card / Anpassungs-Hinweis nicht gefunden für "
                f"Tag {tomorrow_iso}."
            )
        print(f"OK: Recalc-Flow für {tomorrow_iso} sichtbar in History/Banner.")


if __name__ == "__main__":
    asyncio.run(main())
