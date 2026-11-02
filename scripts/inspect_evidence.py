import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto("http://127.0.0.1:8000/dashboard", wait_until="load")
    page.wait_for_selector("button:has-text('Texas Basin')", timeout=15000)
    page.wait_for_selector("button:has-text('#1')", timeout=15000)
    page.locator("button:has-text('#1')").first.click()
    page.wait_for_timeout(1000)

    cards = page.locator(".interface-card")
    print(f"Cards count: {cards.count()}")
    for i in range(cards.count()):
        print(f"=== CARD {i} ===\n{cards.nth(i).inner_text()}\n")

    prov = page.locator("text=Verified NASA CF-1.8 Observations")
    print(f"PROVENANCE BADGE COUNT: {prov.count()}")
    if prov.count() > 0:
        print(f"PROVENANCE TEXT: {prov.first.inner_text()}")

    b.close()
