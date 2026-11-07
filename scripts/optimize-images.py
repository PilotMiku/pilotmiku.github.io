"""Generate web assets from retained originals. Requires cwebp and macOS sips."""
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def webp(source, target, width, quality=82):
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(quality), "-resize", str(width), "0",
                    str(source), "-o", str(target)], check=True)


if __name__ == "__main__":
    data = (ROOT / "photos.js").read_text()
    photos = json.loads(re.search(r"=\s*(\[.*\]);", data, re.S).group(1))
    for photo in photos:
        source = ROOT / photo["src"]
        for width in (320, 800, 1280):
            if width < photo["width"]:
                webp(source, ROOT / "images/responsive" / f"{source.stem}-{width}.webp", width)
    for width in (480, 960):
        webp(ROOT / "images/self- portrait.jpg", ROOT / f"images/profile-{width}.webp", width, 85)
    with tempfile.TemporaryDirectory() as tmp:
        cropped = Path(tmp) / "share.jpg"
        subprocess.run(["sips", "-c", "658", "1254", str(ROOT / "images/self- portrait.jpg"),
                        "--out", str(cropped)], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["sips", "-z", "630", "1200", "-s", "format", "jpeg", "-s",
                        "formatOptions", "82", str(cropped), "--out", str(ROOT / "images/share-card.jpg")],
                       check=True, stdout=subprocess.DEVNULL)
