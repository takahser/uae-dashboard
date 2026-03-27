import urllib.request, re, sys

req = urllib.request.Request(
    "https://cbonds.com/indexes/189217/",
    headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
)
with urllib.request.urlopen(req, timeout=15) as r:
    html = r.read().decode("utf-8", errors="ignore")

print(f"Page size: {len(html)}")
print(f"Has Cloudflare: {'__cf_chl' in html or 'cf-ray' in html.lower()}")

# Try to find the price
prices = re.findall(r'"current_value"\s*:\s*([\d.]+)', html)
print("current_value:", prices[:5])

vals = re.findall(r'"value"\s*:\s*([\d.]+)', html)
print("value fields:", vals[:5])

# Large numbers likely to be oil prices
big_nums = re.findall(r'\b(\d{2,3}\.\d{1,3})\b', html)
unique = sorted(set(float(x) for x in big_nums if 50 < float(x) < 300), reverse=True)
print("Plausible oil prices:", unique[:10])

print("First 500 chars:", html[:500])
