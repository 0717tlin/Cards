"""Refresh online placeholder photos from official UFC athlete profiles.

Run with Python + Pillow. Source URLs are recorded beside the downloaded assets.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "packages/frontend/public/images/fighters"
SLUGS = [
    "israel-adesanya", "paulo-costa", "conor-mcgregor", "sean-omalley",
    "joshua-van", "petr-yan", "justin-gaethje", "alexander-volkanovski",
    "benoit-saint-denis", "renato-moicano", "brandon-royval", "amir-albazi",
    "dan-ige", "melquizael-costa", "tatsuro-taira", "sumudaerji",
    "rinat-fakhretdinov", "anthony-hernandez", "khalil-rountree-jr", "roman-dolidze",
    "azamat-murzakanov", "sergei-pavlovich", "tai-tuivasa", "giga-chikadze",
    "caio-borralho", "bobby-green", "khabib-nurmagomedov", "islam-makhachev",
    "umar-nurmagomedov", "charles-oliveira", "merab-dvalishvili", "anshul-jubli",
    "tommy-mcmillen", "cm-punk", "paddy-pimblett", "ilia-topuria", "sean-strickland",
]
ALIASES = {
    "connor-mcgregor": "conor-mcgregor", "secret-juice": "paulo-costa",
    "suga": "sean-omalley", "joshua-van-ex": "joshua-van",
    "the-highlight-ex": "justin-gaethje", "alexander-volkanovski-ex": "alexander-volkanovski",
    "king-green": "bobby-green", "islam-makhachev-ex": "islam-makhachev",
    "do-bronx": "charles-oliveira", "merab": "merab-dvalishvili",
    "tommy-mcmillan": "tommy-mcmillen", "el-matador-ex": "ilia-topuria",
    "khalil-rountree": "khalil-rountree-jr",
}

def fetch(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.ufc.com/"})
    with urlopen(request, timeout=30) as response:
        return response.read()

def download(slug):
    page = f"https://www.ufc.com/athlete/{slug}"
    html = fetch(page).decode("utf-8")
    candidates = re.findall(r'<img\b[^>]*class="[^"]*hero-profile__image[^"]*"[^>]*>', html)
    if not candidates:
        raise ValueError(f"No athlete portrait on {page}")
    source = unescape(re.search(r'src="([^"]+)"', candidates[0]).group(1))
    if not source.startswith("https://"):
        raise ValueError(f"Unexpected image URL: {source}")
    image = Image.open(BytesIO(fetch(source))).convert("RGBA")
    # Keep transparency; only resize/encode for a small local web asset.
    image.thumbnail((640, 900))
    filename = f"{slug}.webp"
    image.save(OUTPUT / filename, "WEBP", quality=88, method=6)
    return slug, {"file": filename, "profile": page, "image": source}

if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = {}
    failures = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(download, slug): slug for slug in SLUGS}
        for job in as_completed(jobs):
            try:
                slug, source = job.result()
                sources[slug] = source
                print(f"OK {slug}", flush=True)
            except Exception as error:
                failures.append(jobs[job])
                print(f"FAILED {jobs[job]}: {error}", flush=True)
    if failures:
        raise SystemExit(f"Missing portraits: {', '.join(failures)}; existing asset map preserved.")
    (OUTPUT / "sources.json").write_text(json.dumps(sources, indent=2) + "\n", encoding="utf-8")
    assets = {slug: f"/images/fighters/{source['file']}" for slug, source in sources.items()}
    assets.update({card: assets[slug] for card, slug in ALIASES.items() if slug in assets})
    target = ROOT / "packages/frontend/src/cards/fighterPhotos.ts"
    target.write_text("// Online placeholders; sources: public/images/fighters/sources.json\nexport const FIGHTER_PHOTOS: Record<string, string> = " + json.dumps(assets, indent=2, sort_keys=True) + ";\n", encoding="utf-8")
