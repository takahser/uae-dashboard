import urllib.request, re

# Wider search around 189217 (Oman) and try cbonds search API for Dubai
# Also check IDs around the OPEC basket (189215) 
for idx in [189210, 189211, 189212, 189213, 189214, 189220, 189221, 189222, 189223, 189224, 189225]:
    url = f"https://cbonds.com/indexes/{idx}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read().decode("utf-8", errors="ignore")
        name = re.search(r'<title>([^<|]+)', html)
        actual = re.search(r'"actual_value"\s*:\s*"([\d.]+)"', html)
        actual_date = re.search(r'"actual_date"\s*:\s*"([\d\\/]+)"', html)
        title = name.group(1).strip()[:50] if name else 'N/A'
        price = actual.group(1) if actual else 'N/A'
        date = actual_date.group(1) if actual_date else 'N/A'
        if price != 'N/A':
            print(f"ID {idx}: {title} | ${price} | {date}")
    except:
        pass
