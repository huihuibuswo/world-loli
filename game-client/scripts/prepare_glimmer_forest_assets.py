from __future__ import annotations

import json
import math
import random
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = Path(r"D:\生成\images")
ART_ROOT = ROOT / "game-client" / "art-source" / "generated" / "glimmer-forest-v1"
PUBLIC_ROOT = ROOT / "game-client" / "public" / "assets" / "generated"


@dataclass(frozen=True)
class Source:
    filename: str
    role: str

    @property
    def path(self) -> Path:
        return SOURCE_ROOT / self.filename


SOURCES = {
    "core_tree": Source("gen_hist_1785294532094_wqg5b.png", "core ancient tree"),
    "roots": Source("gen_hist_1785294533046_27e4r.png", "root obstacle atlas"),
    "obstacles": Source("gen_hist_1785294612094_r6lxq.png", "rock and stump atlas"),
    "foliage": Source("gen_hist_1785294613148_bcz9l.png", "foliage atlas"),
    "particles": Source("gen_hist_1785294726469_0rh7q.png", "particle atlas"),
    "mist": Source("gen_hist_1785294723959_fleg1.png", "reverse mist layer"),
    "tracks": Source("gen_hist_1785294811941_sp4sr.png", "broken wolf tracks"),
    "mist_core": Source("gen_hist_1785294813035_tcllg.png", "mist core states"),
    "moon_mark": Source("gen_hist_1785294890477_u5064.png", "broken moon mark states"),
    "entry": Source("gen_hist_1785295019342_drtrx.png", "forest entry marker variants"),
    "trees": Source("gen_hist_1785294346933_z1qzs.png", "common tree atlas"),
    "tree_wall": Source("gen_hist_1785294530894_gi0x7.png", "forest boundary tree wall"),
    "clearing": Source("gen_hist_1785294635374_2w29t.png", "moon clearing overlay"),
    "ruins": Source("gen_hist_1785294810781_ims23.png", "ruin component atlas"),
    "ground": Source("gen_hist_1785294327453_594ij.png", "cold wet forest ground"),
    "path": Source("gen_hist_1785294336127_ciaxs.png", "forest path and path overlay"),
}


def flattened_data(image: Image.Image):
    getter = getattr(image, "get_flattened_data", None)
    return getter() if getter else image.getdata()


def sample_background_palette(image: Image.Image, *, dark: bool = False) -> list[tuple[int, int, int]]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    samples: list[tuple[int, int, int]] = []
    step = max(1, min(width, height) // 160)
    border = max(8, min(width, height) // 14)
    for y in range(0, height, step):
        for x in range(0, width, step):
            if border < x < width - border and border < y < height - border:
                continue
            r, g, b = rgb.getpixel((x, y))
            spread = max(r, g, b) - min(r, g, b)
            value = (r + g + b) / 3
            if spread <= 16 and ((dark and 35 <= value <= 150) or (not dark and value >= 205)):
                samples.append((r, g, b))
    if not samples:
        raise RuntimeError("Could not sample a checkerboard background palette")

    buckets: dict[tuple[int, int, int], int] = {}
    for r, g, b in samples:
        key = (round(r / 8) * 8, round(g / 8) * 8, round(b / 8) * 8)
        buckets[key] = buckets.get(key, 0) + 1
    return [item[0] for item in sorted(buckets.items(), key=lambda item: item[1], reverse=True)[:8]]


def distance(color: tuple[int, int, int], target: tuple[int, int, int]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(color, target)))


def remove_checker(
    image: Image.Image,
    *,
    dark: bool = False,
    effect: bool = False,
    threshold: float = 16,
    feather: float = 34,
) -> Image.Image:
    palette = sample_background_palette(image, dark=dark)
    rgba = image.convert("RGBA")
    source = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, _ = source[x, y]
            nearest = min(palette, key=lambda color: distance((r, g, b), color))
            delta = distance((r, g, b), nearest)
            alpha = int(max(0, min(255, (delta - threshold) * 255 / feather)))
            if effect and alpha > 0:
                if dark:
                    residual = max(0, b - nearest[2]) + max(0, g - nearest[1]) * 0.6
                    intensity = max(0, min(1, residual / 120))
                    r = int(150 + 85 * intensity)
                    g = int(200 + 50 * intensity)
                    b = 255
                    alpha = min(220, int(alpha * 0.88))
                else:
                    blue_bias = max(0, b - min(r, g))
                    brightness = max(r, g, b)
                    alpha = max(alpha, int(max(0, brightness - 226) * 8 + blue_bias * 5))
                    alpha = max(0, min(230, alpha))
                    r, g, b = 222, 241, 255
            source[x, y] = (r, g, b, alpha)
    return rgba


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            magenta_score = min(r, b) - g
            if r > 180 and b > 170 and magenta_score > 90:
                strength = min(1.0, max(0.0, (magenta_score - 90) / 90))
                alpha = int(255 * (1 - strength))
                if alpha < 32:
                    alpha = 0
                pixels[x, y] = (r, g, b, alpha)
            else:
                pixels[x, y] = (r, g, b, 255)
    return rgba


def crop_box(image: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
    width, height = image.size
    left, top, right, bottom = box
    return image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))


def trim_alpha(image: Image.Image, padding: int = 16) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return rgba
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(rgba.width, bbox[2] + padding)
    bottom = min(rgba.height, bbox[3] + padding)
    return rgba.crop((left, top, right, bottom))


def keep_largest_component(image: Image.Image, threshold: int = 36) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    width, height = rgba.size
    mask = bytearray(1 if value >= threshold else 0 for value in flattened_data(alpha))
    visited = bytearray(width * height)
    largest: list[int] = []
    for start, active in enumerate(mask):
        if not active or visited[start]:
            continue
        component: list[int] = []
        queue = deque([start])
        visited[start] = 1
        while queue:
            index = queue.popleft()
            component.append(index)
            x = index % width
            y = index // width
            if x > 0:
                neighbor = index - 1
                if mask[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = index + 1
                if mask[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = index - width
                if mask[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = index + width
                if mask[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        if len(component) > len(largest):
            largest = component

    keep = bytearray(width * height)
    for index in largest:
        keep[index] = 1
    output = rgba.copy()
    pixels = list(flattened_data(output))
    output.putdata([
        (r, g, b, a if keep[index] else 0)
        for index, (r, g, b, a) in enumerate(pixels)
    ])
    return output


def suppress_white_halo(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for r, g, b, a in flattened_data(rgba):
        spread = max(r, g, b) - min(r, g, b)
        value = (r + g + b) / 3
        if a and spread < 24 and value > 165:
            factor = max(0.0, min(1.0, (225 - value) / 60))
            a = int(a * factor)
            r = min(r, 155)
            g = min(g, 190)
            b = min(b, 205)
        pixels.append((r, g, b, a))
    rgba.putdata(pixels)
    return rgba


def apply_elliptical_fade(image: Image.Image, inner: float = 0.72) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    center_x = (width - 1) / 2
    center_y = (height - 1) / 2
    radius_x = width / 2
    radius_y = height / 2
    pixels = rgba.load()
    for y in range(height):
        normalized_y = (y - center_y) / radius_y
        for x in range(width):
            r, g, b, a = pixels[x, y]
            normalized_x = (x - center_x) / radius_x
            distance_from_center = math.sqrt(normalized_x ** 2 + normalized_y ** 2)
            if distance_from_center <= inner:
                continue
            factor = max(0.0, min(1.0, (1.0 - distance_from_center) / (1.0 - inner)))
            factor = factor * factor * (3 - 2 * factor)
            pixels[x, y] = (r, g, b, int(a * factor))
    return rgba


def cubic_point(points: tuple[tuple[float, float], ...], t: float) -> tuple[float, float]:
    inverse = 1 - t
    x = (
        inverse ** 3 * points[0][0]
        + 3 * inverse ** 2 * t * points[1][0]
        + 3 * inverse * t ** 2 * points[2][0]
        + t ** 3 * points[3][0]
    )
    y = (
        inverse ** 3 * points[0][1]
        + 3 * inverse ** 2 * t * points[1][1]
        + 3 * inverse * t ** 2 * points[2][1]
        + t ** 3 * points[3][1]
    )
    return x, y


def make_reverse_mist(seed: int, density: int, width: int) -> Image.Image:
    randomizer = random.Random(seed)
    sharp = Image.new("RGBA", (1024, 512), (0, 0, 0, 0))
    soft = Image.new("RGBA", sharp.size, (0, 0, 0, 0))
    sharp_draw = ImageDraw.Draw(sharp)
    soft_draw = ImageDraw.Draw(soft)
    for index in range(density):
        start_y = randomizer.randint(170, 470)
        end_y = max(20, start_y - randomizer.randint(80, 230))
        points = (
            (1080, start_y),
            (760, start_y + randomizer.randint(-80, 80)),
            (360, end_y + randomizer.randint(-70, 70)),
            (-80, end_y),
        )
        line = [cubic_point(points, step / 48) for step in range(49)]
        alpha = randomizer.randint(28, 60)
        sharp_draw.line(line, fill=(178, 225, 255, alpha + 16), width=max(2, width // 4))
        soft_draw.line(line, fill=(150, 210, 255, alpha), width=width + index % 3 * 8)
    soft = soft.filter(ImageFilter.GaussianBlur(radius=18 + width / 5))
    result = Image.alpha_composite(soft, sharp.filter(ImageFilter.GaussianBlur(radius=2.2)))
    particle_draw = ImageDraw.Draw(result)
    for _ in range(16 + density * 2):
        x = randomizer.randint(20, 1000)
        y = randomizer.randint(80, 470)
        radius = randomizer.choice((1, 1, 2, 3))
        particle_draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(220, 244, 255, randomizer.randint(70, 150)))
    return result


def make_particle(variant: int) -> Image.Image:
    canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    if variant == 1:
        draw.ellipse((45, 45, 83, 83), fill=(205, 238, 255, 150))
        draw.ellipse((57, 57, 71, 71), fill=(245, 252, 255, 235))
    elif variant == 2:
        draw.line([(96, 34), (65, 52), (38, 84)], fill=(185, 228, 255, 135), width=8)
        draw.ellipse((30, 76, 50, 96), fill=(240, 252, 255, 225))
    elif variant == 3:
        draw.polygon([(64, 24), (75, 57), (64, 104), (53, 57)], fill=(198, 235, 255, 170))
        draw.line([(64, 30), (64, 98)], fill=(245, 253, 255, 210), width=3)
    else:
        draw.polygon([(62, 35), (84, 57), (72, 91), (43, 82), (38, 54)], fill=(190, 225, 255, 145))
        draw.line([(48, 50), (73, 76)], fill=(241, 251, 255, 210), width=3)
    blurred = glow.filter(ImageFilter.GaussianBlur(radius=10))
    return Image.alpha_composite(blurred, glow)


def fit_canvas(image: Image.Image, size: tuple[int, int], margin: int = 24) -> Image.Image:
    rgba = trim_alpha(image)
    max_width = max(1, size[0] - margin * 2)
    max_height = max(1, size[1] - margin * 2)
    scale = min(max_width / rgba.width, max_height / rgba.height, 1.0)
    if scale < 1:
        rgba = rgba.resize((max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(rgba, ((size[0] - rgba.width) // 2, (size[1] - rgba.height) // 2))
    return canvas


def save_asset(
    image: Image.Image,
    relative: str,
    *,
    public: bool = True,
    canvas: tuple[int, int] | None = None,
) -> dict[str, object]:
    final = fit_canvas(image, canvas) if canvas else trim_alpha(image)
    art_path = ART_ROOT / relative
    art_path.parent.mkdir(parents=True, exist_ok=True)
    final.save(art_path, optimize=True)
    public_path = None
    if public:
        public_path = PUBLIC_ROOT / relative
        public_path.parent.mkdir(parents=True, exist_ok=True)
        final.save(public_path, optimize=True)
    return {
        "name": Path(relative).name,
        "art_source": str(art_path.relative_to(ROOT)).replace("\\", "/"),
        "public": str(public_path.relative_to(ROOT)).replace("\\", "/") if public_path else None,
        "width": final.width,
        "height": final.height,
    }


def save_ground(image: Image.Image, relative: str, size: tuple[int, int]) -> dict[str, object]:
    rgb = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    art_path = ART_ROOT / relative
    public_path = PUBLIC_ROOT / relative
    art_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(art_path, quality=88, method=6)
    rgb.save(public_path, quality=88, method=6)
    return {
        "name": Path(relative).name,
        "art_source": str(art_path.relative_to(ROOT)).replace("\\", "/"),
        "public": str(public_path.relative_to(ROOT)).replace("\\", "/"),
        "width": size[0],
        "height": size[1],
    }


def atlas_cells(
    image: Image.Image,
    boxes: list[tuple[float, float, float, float]],
    names: list[str],
    processor: Callable[[Image.Image], Image.Image],
    folder: str,
    canvas: tuple[int, int],
) -> list[dict[str, object]]:
    output = []
    for box, name in zip(boxes, names, strict=True):
        output.append(save_asset(processor(crop_box(image, box)), f"sprites/{folder}/{name}.png", canvas=canvas))
    return output


def build_preview(records: list[dict[str, object]]) -> None:
    selected = [record for record in records if record["public"] and str(record["public"]).endswith(".png")][:24]
    thumb_size = 220
    label_height = 32
    columns = 4
    rows = math.ceil(len(selected) / columns)
    preview = Image.new("RGB", (columns * thumb_size, rows * (thumb_size + label_height)), (22, 31, 40))
    draw = ImageDraw.Draw(preview)
    for index, record in enumerate(selected):
        path = ROOT / str(record["public"])
        image = Image.open(path).convert("RGBA")
        backdrop = Image.new("RGBA", (thumb_size, thumb_size), (24, 40, 48, 255))
        fitted = fit_canvas(image, (thumb_size, thumb_size), 12)
        backdrop.alpha_composite(fitted)
        x = (index % columns) * thumb_size
        y = (index // columns) * (thumb_size + label_height)
        preview.paste(backdrop.convert("RGB"), (x, y))
        draw.text((x + 8, y + thumb_size + 7), str(record["name"])[:32], fill=(220, 232, 238))
    preview_path = ART_ROOT / "glimmer-forest-asset-preview.jpg"
    preview.save(preview_path, quality=90)


def main() -> None:
    for source in SOURCES.values():
        if not source.path.exists():
            raise FileNotFoundError(source.path)

    records: list[dict[str, object]] = []

    core = keep_largest_component(remove_checker(Image.open(SOURCES["core_tree"].path)))
    records.append(save_asset(core, "sprites/forest/forest-ancient-moon-tree.png", canvas=(1024, 1024)))

    roots = Image.open(SOURCES["roots"].path)
    records += atlas_cells(
        roots,
        [(0, 0, .5, .5), (.5, 0, 1, .5), (0, .5, .5, 1), (.5, .5, 1, 1)],
        [f"forest-root-obstacle-{letter}" for letter in "abcd"],
        lambda image: keep_largest_component(remove_checker(image)),
        "forest",
        (512, 512),
    )

    obstacles = Image.open(SOURCES["obstacles"].path)
    records += atlas_cells(
        obstacles,
        [(0, 0, .5, .5), (.5, 0, 1, .5), (0, .5, .5, 1), (.5, .5, 1, 1)],
        ["forest-rock-cluster", "forest-hollow-stump", "forest-stump-cold", "forest-fallen-log"],
        lambda image: keep_largest_component(remove_checker(image)),
        "forest",
        (512, 512),
    )

    trees = Image.open(SOURCES["trees"].path)
    records += atlas_cells(
        trees,
        [(0, 0, .32, .53), (.34, 0, .66, .53), (.68, 0, 1, .53), (.12, .47, .52, 1), (.55, .47, .93, 1)],
        [f"forest-tree-common-{letter}" for letter in "abcde"],
        lambda image: keep_largest_component(remove_checker(image)),
        "forest",
        (640, 640),
    )

    foliage = remove_checker(Image.open(SOURCES["foliage"].path))
    foliage_boxes = []
    foliage_names = []
    for row in range(5):
        for column in range(4):
            foliage_boxes.append((column / 4, row / 5, (column + 1) / 4, (row + 1) / 5))
            foliage_names.append(f"forest-foliage-{row * 4 + column + 1:02d}")
    for box, name in zip(foliage_boxes, foliage_names, strict=True):
        records.append(save_asset(keep_largest_component(crop_box(foliage, box)), f"sprites/forest/foliage/{name}.png", canvas=(256, 256)))

    tracks = remove_checker(Image.open(SOURCES["tracks"].path))
    records.append(save_asset(tracks, "textures/forest/forest-wolf-tracks-broken.png", canvas=(1024, 768)))

    moon_mark = Image.open(SOURCES["moon_mark"].path)
    records += atlas_cells(
        moon_mark,
        [(0, 0, 1, .5), (0, .5, 1, 1)],
        ["forest-broken-moon-mark-idle", "forest-broken-moon-mark-active"],
        lambda image: keep_largest_component(remove_checker(image)),
        "forest/effects",
        (512, 512),
    )

    mist_core = Image.open(SOURCES["mist_core"].path)
    records += atlas_cells(
        mist_core,
        [(0, 0, .5, 1), (.5, 0, 1, 1)],
        ["forest-broken-moon-mist-core-idle", "forest-broken-moon-mist-core-active"],
        lambda image: keep_largest_component(remove_checker(image)),
        "forest/effects",
        (512, 512),
    )

    entry = Image.open(SOURCES["entry"].path)
    records += atlas_cells(
        entry,
        [(0, 0, .5, 1), (.5, 0, 1, 1)],
        ["forest-entry-marker-left", "forest-entry-marker-right"],
        lambda image: keep_largest_component(remove_checker(image)),
        "forest",
        (512, 512),
    )

    clean_ruins_path = ART_ROOT / "ruins-clean-atlas.png"
    ruins = Image.open(clean_ruins_path).convert("RGBA") if clean_ruins_path.exists() else remove_magenta(Image.open(SOURCES["ruins"].path))
    ruin_boxes = [
        (0, 0, .58, .38), (.58, 0, 1, .4),
        (0, .34, .52, .68), (.52, .36, 1, .69),
        (0, .66, .55, 1), (.55, .66, 1, 1),
    ]
    for index, box in enumerate(ruin_boxes, start=1):
        records.append(save_asset(crop_box(ruins, box), f"sprites/forest/ruins/forest-ruin-piece-{index:02d}.png", canvas=(512, 512)))

    wall = remove_checker(Image.open(SOURCES["tree_wall"].path))
    records.append(save_asset(wall, "sprites/forest/forest-tree-wall-a.png", canvas=(1024, 512)))

    clearing = apply_elliptical_fade(
        suppress_white_halo(remove_checker(Image.open(SOURCES["clearing"].path), threshold=12, feather=42)),
    )
    records.append(save_asset(clearing, "textures/forest/forest-moon-clearing-overlay.png", canvas=(1024, 1024)))

    for index in range(1, 5):
        records.append(save_asset(make_particle(index), f"textures/forest/effects/forest-glimmer-particle-{index}.png", canvas=(128, 128)))

    mist_layers = {
        "back": make_reverse_mist(4101, 5, 70),
        "mid": make_reverse_mist(4102, 4, 44),
        "front": make_reverse_mist(4103, 3, 24),
    }
    for name, image in mist_layers.items():
        records.append(save_asset(image, f"textures/forest/effects/forest-reverse-mist-{name}.png", canvas=(1024, 512)))

    ground = Image.open(SOURCES["ground"].path)
    records.append(save_ground(ground, "textures/forest/forest-ground-cold-wet.webp", (512, 512)))

    path_source = Image.open(SOURCES["path"].path)
    crossing = crop_box(path_source, (0, 0, 1, .745))
    path_overlay = keep_largest_component(
        remove_checker(crop_box(path_source, (.12, .74, .88, 1)), threshold=14, feather=34),
    )
    records.append(save_ground(crossing, "textures/forest/forest-path-crossing.webp", (1024, 768)))
    records.append(save_asset(path_overlay, "textures/forest/forest-path-wet-soil-overlay.png", canvas=(1024, 384)))

    manifest = {
        "version": 1,
        "source_root": str(SOURCE_ROOT),
        "note": "Generated sources were normalized non-destructively. Visual QA is still required before runtime integration.",
        "assets": records,
    }
    ART_ROOT.mkdir(parents=True, exist_ok=True)
    (ART_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    build_preview(records)
    print(f"Prepared {len(records)} assets")
    print(ART_ROOT)


if __name__ == "__main__":
    main()
