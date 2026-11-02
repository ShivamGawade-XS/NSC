import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    requests = []
    responses = []
    page.on("request", lambda r: requests.append(f"{r.method} {r.url}"))
    page.on("response", lambda r: responses.append(f"{r.status} {r.url}"))
    page.on("console", lambda m: print(f"CONSOLE [{m.type}]: {m.text}"))
    page.on("pageerror", lambda e: print(f"PAGE ERROR: {e}"))

    print("Navigating to http://127.0.0.1:8000/ with domcontentloaded...")
    page.goto("http://127.0.0.1:8000/", wait_until="domcontentloaded")
    print("DOMContentLoaded fired!")
    page.wait_for_timeout(3000)
    print(f"Total requests: {len(requests)}")
    for r in requests[:20]:
        print(" REQ:", r)
    for r in responses[:20]:
        print(" RES:", r)

    browser.close()
