from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


OUTPUT_SIZE = 512
PADDING = 32


def border_connected_background(rgb: np.ndarray) -> np.ndarray:
    """Select neutral light-gray pixels connected to the canvas border."""
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    brightness = rgb.mean(axis=2)
    candidate = (brightness >= 178) & ((high - low) <= 18)
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


def fit_to_canvas(image: Image.Image) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.nonzero(alpha)
    if not len(xs):
        raise ValueError("Background removal produced an empty image")

    crop = image.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    available = OUTPUT_SIZE - PADDING * 2
    scale = min(available / crop.width, available / crop.height)
    size = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    crop = crop.resize(size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE))
    position = ((OUTPUT_SIZE - size[0]) // 2, (OUTPUT_SIZE - size[1]) // 2)
    canvas.alpha_composite(crop, position)
    return canvas


def process(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGB")
    image.thumbnail((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
    rgb = np.asarray(image, dtype=np.uint8)
    background = border_connected_background(rgb)
    alpha = np.where(background, 0, 255).astype(np.uint8)
    rgba = np.dstack((rgb, alpha))
    rgba[background, :3] = 0

    result = fit_to_canvas(Image.fromarray(rgba, "RGBA"))
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove a connected light-gray background from a gift icon."
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    process(args.source, args.destination)


if __name__ == "__main__":
    main()
