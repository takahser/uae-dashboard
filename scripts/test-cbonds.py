import urllib.request, re, sys

req = urllib.request.Request(
    "https://cbonds.com/indexes/189217/",
    headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"}
)
with urllib.request.urlopen(req, timeout=15) as r:
    html = r.read().decode("utf-8", errors="ignore")

# Find context around 112.0 (today's known Oman price)
for m in re.finditer(r'112\.0', html):
    print("CONTEXT:", html[max(0,m.start()-150):m.start()+100])
    print("---")

# Look for date + value patterns
pairs = re.findall(r'(\d{4}-\d{2}-\d{2})[^0-9]{1,30}(1[0-2]\d\.\d+)', html)
print("Date+price pairs:", pairs[:10])

# Look for JSON-like structures with dates
json_dates = re.findall(r'"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"[^}]{1,50}"value"\s*:\s*([\d.]+)', html)
print("JSON date+value:", json_dates[:10])
