from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


SOURCE_DIR = Path(r"D:\生成\images")
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "assets" / "generated" / "sprites"

ASSETS = {
    "gen_hist_1784706866348_tnfqq.png": ("village-chief-house.png", 512),
    "gen_hist_1784706873565_6xdf5.png": ("village-general-store.png", 512),
    "gen_hist_1784706874755_ur3hl.png": ("village-smithy.png", 512),
    "gen_hist_1784706876013_a51b3.png": ("village-inn.png", 512),
    "gen_hist_1784706877022_2kyd6.png": ("village-cottage-a.png", 512),
    "gen_hist_1784706877971_enzl5.png": ("village-cottage-b.png", 512),
    "gen_hist_1784706966419_l0bza.png": ("npc-village-chief.png", 256),
    "gen_hist_1784706967459_3gh8z.png": ("npc-shopkeeper.png", 256),
    "gen_hist_1784706968525_gjrb8.png": ("npc-suna.png", 256),
    "gen_hist_1784706970883_w7uho.png": ("npc-forest-guide.png", 256),
    "gen_hist_1784706969732_du3kz.png": ("npc-trainer.png", 256),
}


def border_connected_background(rgb: np.ndarray) -> np.ndarray:
    """Find the baked gray checkerboard without erasing enclosed pale artwork."""
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    candidate = (low >= 205) & ((high - low) <= 18)
    height, width = candidate.shape
    background = np.zeros_like(candidate)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if candidate[0, x]:
            queue.append((0, x))
        if candidate[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if candidate[y, 0]:
            queue.append((y, 0))
        if candidate[y, width - 1]:
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if background[y, x] or not candidate[y, x]:
            continue
        background[y, x] = True
        if y:
            queue.append((y - 1, x))
        if y + 1 < height:
            queue.append((y + 1, x))
        if x:
            queue.append((y, x - 1))
        if x + 1 < width:
            queue.append((y, x + 1))

    return background


def process(source: Path, destination: Path, size: int) -> None:
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.uint8)
    background = border_connected_background(rgb)
    alpha = np.where(background, 0, 255).astype(np.uint8)
    rgba = np.dstack((rgb, alpha))
    rgba[background, :3] = 0

    image = Image.fromarray(rgba, "RGBA")
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, optimize=True)


def main() -> None:
    missing = [name for name in ASSETS if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing source assets: {', '.join(missing)}")

    for source_name, (output_name, size) in ASSETS.items():
        process(SOURCE_DIR / source_name, OUTPUT_DIR / output_name, size)
        print(f"{source_name} -> {output_name} ({size}x{size})")


if __name__ == "__main__":
    main()
