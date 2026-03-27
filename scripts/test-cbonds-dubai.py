import urllib.request, re

# Try cbonds Dubai crude - search for nearby index IDs around 189217
# Also try the cbonds search
for url in [
    "https://cbonds.com/indexes/189218/",
    "https://cbonds.com/indexes/189216/",
    "https://cbonds.com/indexes/189215/",
    "https://cbonds.com/indexes/189219/",
]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            html = r.read().decode("utf-8", errors="ignore")
        name = re.search(r'<title>([^<]+)</title>', html)
        actual = re.search(r'"actual_value"\s*:\s*"([\d.]+)"', html)
        actual_date = re.search(r'"actual_date"\s*:\s*"([\d\\/]+)"', html)
        print(f"{url}")
        print(f"  Title: {name.group(1)[:60] if name else 'N/A'}")
        print(f"  Price: {actual.group(1) if actual else 'N/A'} | Date: {actual_date.group(1) if actual_date else 'N/A'}")
    except Exception as e:
        print(f"{url} → ERROR: {e}")
