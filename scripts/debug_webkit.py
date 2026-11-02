import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    b = p.webkit.launch(headless=True)
    page = b.new_page()
    page.on("console", lambda m: print(f"WEBKIT CONSOLE [{m.type}]: {m.text}"))
    page.on("pageerror", lambda e: print(f"WEBKIT PAGE ERROR: {e}"))
    page.on("requestfailed", lambda r: print(f"WEBKIT REQ FAILED: {r.url} -> {r.failure}"))

    print("Navigating to http://127.0.0.1:8000/ on WebKit...")
    res = page.goto("http://127.0.0.1:8000/", wait_until="load")
    print(f"Status: {res.status if res else 'N/A'}")
    page.wait_for_timeout(3000)
    print("Page title:", page.title())
    print("Root element html length:", len(page.content()))
    print("Root element snippet:", page.content()[:300])
    b.close()
