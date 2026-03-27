import urllib.request, re

# Try a broader range and also search for "Dubai" in title
for idx in range(189100, 189250):
    url = f"https://cbonds.com/indexes/{idx}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            html = r.read().decode("utf-8", errors="ignore")
        name = re.search(r'<title>([^<|]+)', html)
        title = name.group(1).strip().lower() if name else ''
        if 'dubai' in title or 'dme' in title:
            actual = re.search(r'"actual_value"\s*:\s*"([\d.]+)"', html)
            date = re.search(r'"actual_date"\s*:\s*"([\d\\/]+)"', html)
            print(f"FOUND ID {idx}: {title} | ${actual.group(1) if actual else 'N/A'} | {date.group(1) if date else 'N/A'}")
    except:
        pass
print("Scan complete")
