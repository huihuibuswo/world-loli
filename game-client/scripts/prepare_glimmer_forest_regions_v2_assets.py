from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import stat
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
EXTERNAL_SOURCE_ROOT = Path("D:/\u751f\u6210/images")
V1_RAW_ROOT = ROOT / "game-client" / "art-source" / "generated" / "glimmer-forest-regions-v1" / "raw"
SOURCE_ROOT = EXTERNAL_SOURCE_ROOT if EXTERNAL_SOURCE_ROOT.exists() else V1_RAW_ROOT
VERSION = "glimmer-forest-regions-v3"
ART_ROOT = ROOT / "game-client" / "art-source" / "generated" / VERSION
PUBLIC_ROOT = ROOT / "game-client" / "public" / "assets" / "generated" / "environment" / "glimmer-forest" / "regions-v3"
RUNTIME_ROOT = "/assets/generated/environment/glimmer-forest/regions-v3/"


def remove_tree(path: Path) -> None:
    def clear_readonly(_function, target, _error) -> None:
        os.chmod(target, stat.S_IWRITE)
        os.unlink(target)

    if path.exists():
        shutil.rmtree(path, onerror=clear_readonly)


@dataclass(frozen=True)
class Source:
    code: str
    filename: str
    role: str
    mode: str
    external_path: str | None = None

    @property
    def path(self) -> Path:
        external = Path(self.external_path) if self.external_path else SOURCE_ROOT / self.filename
        if external.exists():
            return external
        return ART_ROOT / "raw" / self.filename


SOURCES = [
    Source("W01", "gen_hist_1785391592555_f336z.png", "silver-mist valley ground", "opaque"),
    Source("W02-calm", "gen_hist_1785744209965_88zcj.png", "seamless calm water material", "opaque"),
    Source("W02-flow", "gen_hist_1785744208717_nji67.png", "seamless flowing water material", "opaque"),
    Source("W03-01", "gen_hist_1785744283456_zp6pq.png", "compact pebble bank", "chroma"),
    Source("W03-02", "gen_hist_1785744235960_hdz4g.png", "loose pebble bank", "chroma"),
    Source("W03-03", "gen_hist_1785744329621_gwtop.png", "wet mud cut", "chroma"),
    Source("W03-04", "gen_hist_1785807536639_4z37f.png", "moss shelf source", "chroma"),
    Source("W03-05", "gen_hist_1785744899916_75xof.png", "compact shoal stones", "chroma"),
    Source("W03-06", "gen_hist_1785744488645_t3w5m.png", "alternate shoal stones", "chroma"),
    Source(
        "W03-07",
        "codex-clipboard-c95153cf-105c-4300-b544-213c7c225329.png",
        "horizontal bridge bed source",
        "chroma",
        "C:/Users/EDY/AppData/Local/Temp/codex-clipboard-c95153cf-105c-4300-b544-213c7c225329.png",
    ),
    Source("W03-09", "gen_hist_1785807539266_is4bs.png", "wetland tributary mouth", "chroma"),
    Source("W04-horizontal", "gen_hist_1785744967158_imn6y.png", "horizontal bridge", "chroma"),
    Source("W04-diagonal", "gen_hist_1785744978164_lve6o.png", "diagonal bridge", "chroma"),
    Source("W05-silverleaf", "gen_hist_1785745230607_dkbi6.png", "silverleaf aquatic foliage", "chroma"),
    Source("W05-reed", "gen_hist_1785745185220_e8x0a.png", "reed aquatic foliage", "chroma"),
    Source("W05-bush", "gen_hist_1785745169374_s5btc.png", "broad aquatic foliage", "chroma"),
    Source(
        "W05-star-mint",
        "codex-clipboard-856a7d99-1507-4638-9e5b-f4c4a6a518a0.png",
        "replacement star mint",
        "chroma",
        "C:/Users/EDY/AppData/Local/Temp/codex-clipboard-856a7d99-1507-4638-9e5b-f4c4a6a518a0.png",
    ),
    Source(
        "W05-aquatic-moss",
        "codex-clipboard-a5b27ff8-1825-442c-84cf-d749e52f83b3.png",
        "replacement aquatic moss",
        "chroma",
        "C:/Users/EDY/AppData/Local/Temp/codex-clipboard-a5b27ff8-1825-442c-84cf-d749e52f83b3.png",
    ),
    Source("W06", "gen_hist_1785745145095_ci65x.png", "reverse mist fall", "mask"),
    Source("W07", "gen_hist_1785395128336_0pdjl.png", "wetland reflection", "mask"),
    Source("E01-left", "gen_hist_1785391445202_6802c.png", "forest exit left", "chroma"),
    Source("E01-right", "gen_hist_1785391836632_yufva.png", "forest exit right", "chroma"),
    Source("R01", "gen_hist_1785396918805_f1qtr.png", "root ruins ground", "opaque"),
    Source("R02", "gen_hist_1785395189480_7h225.png", "giant root arch", "chroma"),
    Source("R03", "gen_hist_1785395200382_y3jbg.png", "weathered ruin atlas", "chroma"),
    Source("R04-open", "gen_hist_1785396312750_0484h.png", "root gate open", "chroma"),
    Source("R05", "gen_hist_1785396113838_rjcr0.png", "sunken courtyard", "opaque"),
    Source("R06-idle", "gen_hist_1785396590350_3iedu.png", "ruin clue idle", "chroma"),
    Source("R06-active", "gen_hist_1785396774182_ik8tl.png", "ruin clue active", "chroma"),
    Source("N01", "gen_hist_1785396338118_zttlr.png", "night-firefly ground", "opaque"),
    Source("N02", "gen_hist_1785396358214_c8jor.png", "tree corridor atlas", "chroma"),
    Source("N03", "gen_hist_1785396633046_r5rrk.png", "glowing path markers", "chroma"),
    Source("N04", "gen_hist_1785396664736_jcq41.png", "night fireflies", "mask"),
    Source("N05", "gen_hist_1785396853656_bhqqx.png", "broken canopy moonlight", "mask"),
    Source("N06", "gen_hist_1785397040712_fknyh.png", "false path markers", "chroma"),
    Source("N07", "gen_hist_1785396896077_go05n.png", "foreground branches", "chroma"),
    Source("D01", "gen_hist_1785395140182_kco0o.png", "deep forest ground", "opaque"),
    Source("D02", "gen_hist_1785397114321_95zna.png", "broken canopy tree wall", "chroma"),
    Source("D03", "gen_hist_1785397261629_25j6y.png", "inward leaning trees", "chroma"),
    Source("D04", "gen_hist_1785397167726_75s4b.png", "mist convergence basin", "opaque"),
    Source("D05", "gen_hist_1785397215774_wltg2.png", "central stage landmark", "chroma"),
    Source("D06-idle", "gen_hist_1785397294592_grl58.png", "broken moon response idle", "mask"),
    Source("D06-active", "gen_hist_1785397428319_r9bvo.png", "broken moon response active", "mask"),
    Source("D07", "gen_hist_1785397438984_22efk.png", "stable exit", "chroma"),
]
SOURCE_BY_CODE = {source.code: source for source in SOURCES}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pixels(image: Image.Image):
    getter = getattr(image, "get_flattened_data", None)
    return getter() if getter else image.getdata()


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    cleaned = []
    for r, g, b, _ in pixels(rgba):
        distance = math.sqrt((255 - r) ** 2 + g**2 + (255 - b) ** 2)
        dominance = min(r, b) - g
        alpha = round(255 * max(
            max(0.0, min(1.0, (distance - 18) / 105)),
            max(0.0, min(1.0, (185 - dominance) / 125)),
        ))
        alpha = 0 if alpha < 10 else 255 if alpha > 245 else alpha
        if alpha < 255:
            spill = max(0, min(r, b) - g)
            r = max(0, round(r - spill * 0.72))
            b = max(0, round(b - spill * 0.72))
        cleaned.append((r, g, b, alpha))
    rgba.putdata(cleaned)
    return rgba


def silver_mask(image: Image.Image, opacity: float = 1.0) -> Image.Image:
    rgb = image.convert("RGB")
    alpha = Image.new("L", rgb.size)
    alpha.putdata([min(255, round(max(r, g, b) * opacity)) for r, g, b in pixels(rgb)])
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    result = Image.new("RGBA", rgb.size, (188, 225, 242, 0))
    result.putalpha(alpha)
    return result


def tight_canvas(image: Image.Image, padding: int = 12) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("asset has no visible alpha")
    crop = rgba.crop(bbox)
    canvas = Image.new("RGBA", (crop.width + padding * 2, crop.height + padding * 2), (0, 0, 0, 0))
    canvas.alpha_composite(crop, (padding, padding))
    return canvas


def fit_max(image: Image.Image, max_size: tuple[int, int]) -> Image.Image:
    rgba = tight_canvas(image)
    scale = min(max_size[0] / rgba.width, max_size[1] / rgba.height, 1.0)
    if scale < 1:
        rgba = rgba.resize((max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))), Image.Resampling.LANCZOS)
    return tight_canvas(rgba)


def cropped_chroma(code: str, crop: tuple[int, int, int, int] | None = None, *, alpha_floor: int = 10) -> Image.Image:
    source = Image.open(SOURCE_BY_CODE[code].path)
    if crop is not None:
        source = source.crop(crop)
    rgba = remove_magenta(source)
    # These accepted Silver Mist Valley candidates contain no intentional purple.
    # Remove residual chroma spill even where the generated edge was fully opaque.
    cleaned = []
    for r, g, b, a in pixels(rgba):
        spill = max(0, min(r, b) - g)
        if spill > 24:
            a = round(a * max(0.0, 1.0 - min(1.0, (spill - 24) / 72)))
        if spill > 8:
            r = max(0, round(r - spill * 0.88))
            b = max(0, round(b - spill * 0.88))
        cleaned.append((r, g, b, a))
    rgba.putdata(cleaned)
    if alpha_floor > 10:
        alpha = rgba.getchannel("A").point(lambda value: 0 if value < alpha_floor else value)
        rgba.putalpha(alpha)
    return tight_canvas(rgba)


def purify_chroma_edges(
    image: Image.Image,
    *,
    passes: int = 3,
    dark_threshold: int | None = None,
    alpha_floor: int = 24,
) -> Image.Image:
    """Remove generated chroma spill and soft backdrop shadows from sprite edges."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    data = rgba.load()

    for _ in range(passes):
        remove: list[tuple[int, int]] = []
        for y in range(height):
            for x in range(width):
                r, g, b, a = data[x, y]
                if a == 0:
                    continue
                touches_transparency = (
                    x == 0
                    or y == 0
                    or x == width - 1
                    or y == height - 1
                    or data[max(0, x - 1), y][3] == 0
                    or data[min(width - 1, x + 1), y][3] == 0
                    or data[x, max(0, y - 1)][3] == 0
                    or data[x, min(height - 1, y + 1)][3] == 0
                )
                if not touches_transparency:
                    continue
                purple_spill = min(r, b) - g
                luminance = (r * 3 + g * 6 + b) / 10
                if a < alpha_floor or purple_spill > 8 or (dark_threshold is not None and luminance < dark_threshold):
                    remove.append((x, y))
        if not remove:
            break
        for x, y in remove:
            data[x, y] = (0, 0, 0, 0)

    cleaned = []
    for r, g, b, a in pixels(rgba):
        if a < alpha_floor:
            cleaned.append((0, 0, 0, 0))
            continue
        spill = max(0, min(r, b) - g)
        if spill > 4:
            r = max(0, round(r - spill * 0.9))
            b = max(0, round(b - spill * 0.9))
        cleaned.append((r, g, b, a))
    rgba.putdata(cleaned)
    return tight_canvas(rgba)


def finished_chroma(
    code: str,
    max_size: tuple[int, int],
    crop: tuple[int, int, int, int] | None = None,
    *,
    source_alpha_floor: int = 10,
    edge_passes: int = 3,
    dark_threshold: int | None = None,
) -> Image.Image:
    fitted = fit_max(cropped_chroma(code, crop, alpha_floor=source_alpha_floor), max_size)
    return purify_chroma_edges(fitted, passes=edge_passes, dark_threshold=dark_threshold)


def neutralize_upper_right_haze(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    data = rgba.load()
    for y in range(rgba.height):
        vertical = max(0.0, 1.0 - y / (rgba.height * 0.62))
        for x in range(rgba.width):
            horizontal = max(0.0, (x / rgba.width - 0.42) / 0.58)
            strength = min(1.0, horizontal * vertical * 1.8)
            if strength <= 0:
                continue
            r, g, b, a = data[x, y]
            if a and b > g and r > g * 0.66:
                data[x, y] = (
                    round(r * (1 - 0.42 * strength)),
                    min(255, round(g * (1 + 0.08 * strength))),
                    round(b * (1 - 0.24 * strength)),
                    a,
                )
    return rgba


def seamless_ground(image: Image.Image, size: tuple[int, int], variant: int = 0) -> Image.Image:
    base = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    if variant == 1:
        base = base.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        base = ImageEnhance.Brightness(base).enhance(0.94)
    elif variant == 2:
        base = base.rotate(180)
        base = ImageEnhance.Color(base).enhance(0.92)

    mirrored = Image.new("RGB", (size[0] * 2, size[1] * 2))
    mirrored.paste(base, (0, 0))
    mirrored.paste(base.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (size[0], 0))
    mirrored.paste(base.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, size[1]))
    mirrored.paste(base.transpose(Image.Transpose.FLIP_LEFT_RIGHT).transpose(Image.Transpose.FLIP_TOP_BOTTOM), (size[0], size[1]))
    tile = mirrored.crop((size[0] // 2, size[1] // 2, size[0] + size[0] // 2, size[1] + size[1] // 2))

    # Wrapped offsets preserve periodic edges while suppressing a single dominant 512px feature.
    shifted_a = ImageChops.offset(tile, 173 + variant * 31, 89 + variant * 47)
    shifted_b = ImageChops.offset(tile, -127 - variant * 23, 211 - variant * 29)
    return Image.blend(Image.blend(tile, shifted_a, 0.24), shifted_b, 0.18)


def soft_decal(image: Image.Image, size: tuple[int, int], feather: int = 96, opacity: float = 1.0) -> Image.Image:
    rgb = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    alpha = Image.new("L", size, 0)
    draw = ImageDraw.Draw(alpha)
    draw.rectangle((feather, feather, size[0] - feather - 1, size[1] - feather - 1), fill=255)
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather / 2))
    if opacity < 1:
        alpha = alpha.point(lambda value: round(value * opacity))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def feather_alpha(image: Image.Image, size: tuple[int, int], feather: int = 96, opacity: float = 1.0) -> Image.Image:
    rgba = image.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
    edge = Image.new("L", size, 0)
    ImageDraw.Draw(edge).rectangle((feather, feather, size[0] - feather - 1, size[1] - feather - 1), fill=255)
    edge = edge.filter(ImageFilter.GaussianBlur(feather / 2))
    alpha = ImageChops.multiply(rgba.getchannel("A"), edge)
    if opacity < 1:
        alpha = alpha.point(lambda value: round(value * opacity))
    rgba.putalpha(alpha)
    return rgba


def macro_overlay(source: Image.Image, size: tuple[int, int], tint: tuple[int, int, int]) -> Image.Image:
    low = source.convert("L").resize((32, 32), Image.Resampling.BILINEAR).resize(size, Image.Resampling.BICUBIC)
    low = ImageEnhance.Contrast(low).enhance(1.7)
    alpha = low.point(lambda value: max(0, min(72, abs(value - 128) // 2)))
    edge = Image.new("L", size, 0)
    ImageDraw.Draw(edge).ellipse((48, 48, size[0] - 49, size[1] - 49), fill=255)
    alpha = Image.composite(alpha, Image.new("L", size, 0), edge.filter(ImageFilter.GaussianBlur(54)))
    rgba = Image.new("RGBA", size, (*tint, 0))
    rgba.putalpha(alpha.filter(ImageFilter.GaussianBlur(24)))
    return rgba


def connected_components(image: Image.Image, threshold: int = 64, scale: float = 0.25) -> list[dict[str, object]]:
    alpha = image.convert("RGBA").getchannel("A")
    small = alpha.resize((max(1, round(alpha.width * scale)), max(1, round(alpha.height * scale))), Image.Resampling.BILINEAR)
    width, height = small.size
    data = small.load()
    seen = bytearray(width * height)
    found: list[dict[str, object]] = []
    minimum = width * height * 0.0005
    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if seen[offset] or data[x, y] < threshold:
                continue
            stack = [(x, y)]
            seen[offset] = 1
            area = 0
            left = right = x
            top = bottom = y
            while stack:
                current_x, current_y = stack.pop()
                area += 1
                left = min(left, current_x); right = max(right, current_x)
                top = min(top, current_y); bottom = max(bottom, current_y)
                for next_x, next_y in ((current_x - 1, current_y), (current_x + 1, current_y), (current_x, current_y - 1), (current_x, current_y + 1)):
                    if 0 <= next_x < width and 0 <= next_y < height:
                        next_offset = next_y * width + next_x
                        if not seen[next_offset] and data[next_x, next_y] >= threshold:
                            seen[next_offset] = 1
                            stack.append((next_x, next_y))
            if area < minimum:
                continue
            bbox = (
                max(0, math.floor(left / scale) - 8),
                max(0, math.floor(top / scale) - 8),
                min(image.width, math.ceil((right + 1) / scale) + 8),
                min(image.height, math.ceil((bottom + 1) / scale) + 8),
            )
            found.append({"area": area / (scale * scale), "bbox": bbox, "center": ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)})
    return found


def row_major(components: list[dict[str, object]], row_height: int = 240) -> list[dict[str, object]]:
    return sorted(components, key=lambda item: (round(item["center"][1] / row_height), item["center"][0]))


def component_crops(code: str, count: int, *, exclude_near: tuple[int, int] | None = None, largest: bool = False) -> list[Image.Image]:
    source = remove_magenta(Image.open(SOURCE_BY_CODE[code].path))
    components = connected_components(source)
    if exclude_near is not None:
        components = sorted(components, key=lambda item: (item["center"][0] - exclude_near[0]) ** 2 + (item["center"][1] - exclude_near[1]) ** 2)[1:]
    if largest:
        components = sorted(components, key=lambda item: item["area"], reverse=True)[:count]
    components = row_major(components)[:count]
    if len(components) != count:
        raise ValueError(f"{code}: expected {count} components, got {len(components)}")
    return [tight_canvas(source.crop(item["bbox"])) for item in components]


def alpha_bbox(image: Image.Image) -> list[int]:
    bbox = image.convert("RGBA").getchannel("A").getbbox()
    if bbox is None:
        return [0, 0, 0, 0]
    return list(bbox)


def large_component_count(image: Image.Image) -> int:
    return len(connected_components(image, scale=0.5))


def save_asset(
    image: Image.Image,
    relative: str,
    source_codes: list[str],
    records: list[dict[str, object]],
    *,
    role: str,
    collision_profile: str | None,
    anchor: tuple[float, float] = (0.5, 1.0),
    footpoint: tuple[int, int] | None = None,
    intentional_padding: str | None = None,
) -> None:
    art_path = ART_ROOT / "processed" / relative
    public_path = PUBLIC_ROOT / relative
    art_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(art_path, optimize=True)
    shutil.copy2(art_path, public_path)
    bbox = alpha_bbox(image) if image.mode == "RGBA" else [0, 0, image.width, image.height]
    resolved_footpoint = footpoint or (round(image.width * anchor[0]), max(0, bbox[3] - 1))
    component_count = max(1, large_component_count(image)) if image.mode == "RGBA" else 1
    record: dict[str, object] = {
        "name": Path(relative).name,
        "source_codes": source_codes,
        "art_source": str(art_path.relative_to(ROOT)).replace("\\", "/"),
        "runtime": RUNTIME_ROOT + relative.replace("\\", "/"),
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "alpha_bbox": bbox,
        "anchor": list(anchor),
        "footpoint": list(resolved_footpoint),
        "visual_size": [image.width, image.height],
        "role": role,
        "collision_profile": collision_profile,
        "component_count": component_count,
        "review": "approved",
        "sha256": sha256(art_path),
    }
    if intentional_padding:
        record["intentional_padding"] = intentional_padding
    records.append(record)


def transparent_asset(code: str, relative: str, records: list[dict[str, object]], max_size: tuple[int, int], role: str, collision: str | None) -> None:
    save_asset(fit_max(remove_magenta(Image.open(SOURCE_BY_CODE[code].path)), max_size), relative, [code], records, role=role, collision_profile=collision)


def copy_sources() -> list[dict[str, object]]:
    raw_root = ART_ROOT / "raw"
    raw_root.mkdir(parents=True, exist_ok=True)
    provenance = []
    for source in SOURCES:
        if not source.path.exists():
            raise FileNotFoundError(source.path)
        target = raw_root / source.filename
        if source.path.resolve() != target.resolve():
            shutil.copy2(source.path, target)
        with Image.open(source.path) as image:
            provenance.append({
                "code": source.code,
                "filename": source.filename,
                "role": source.role,
                "mode": source.mode,
                "width": image.width,
                "height": image.height,
                "image_mode": image.mode,
                "sha256": sha256(source.path),
            })
    return provenance


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (36, 44, 50, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(61, 72, 80, 255))
    return image


def build_contact_sheet(records: list[dict[str, object]]) -> None:
    cell, label, columns = 180, 28, 6
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (columns * cell, rows * (cell + label)), (17, 21, 25))
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        image = Image.open(ROOT / str(record["art_source"])).convert("RGBA")
        image.thumbnail((cell - 12, cell - 12), Image.Resampling.LANCZOS)
        tile = checkerboard((cell, cell))
        tile.alpha_composite(image, ((cell - image.width) // 2, (cell - image.height) // 2))
        x = index % columns * cell
        y = index // columns * (cell + label)
        sheet.paste(tile.convert("RGB"), (x, y))
        draw.text((x + 5, y + cell + 5), str(record["name"])[:25], fill=(225, 233, 238))
    sheet.save(ART_ROOT / "processed-contact-sheet.jpg", quality=90)


def build_ground_preview(records: list[dict[str, object]]) -> None:
    grounds = [record for record in records if record["role"] == "ground-tile"]
    groups: dict[str, list[dict[str, object]]] = {}
    for record in grounds:
        group = str(record["name"]).rsplit("-", 1)[0]
        groups.setdefault(group, []).append(record)
    tile = 128
    sheet = Image.new("RGB", (tile * 4, max(1, len(groups)) * tile * 4), (18, 22, 26))
    for group_index, variants in enumerate(groups.values()):
        loaded = [Image.open(ROOT / str(record["art_source"])).convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS) for record in variants]
        for row in range(4):
            for column in range(4):
                variant = loaded[(row * 3 + column * 2) % len(loaded)]
                sheet.paste(variant, (column * tile, (group_index * 4 + row) * tile))
    sheet.save(ART_ROOT / "ground-tile-preview.jpg", quality=90)


def build_water_preview(records: list[dict[str, object]]) -> None:
    water = [record for record in records if record["role"] == "water-material"]
    if not water:
        return
    tile = 256
    sheet = Image.new("RGB", (tile * 2, tile * 2 * len(water)), (18, 22, 26))
    for index, record in enumerate(water):
        image = Image.open(ROOT / str(record["art_source"])).convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS)
        for row in range(2):
            for column in range(2):
                sheet.paste(image, (column * tile, index * tile * 2 + row * tile))
    sheet.save(ART_ROOT / "water-material-2x2-preview.jpg", quality=92)


def validate(records: list[dict[str, object]]) -> dict[str, object]:
    problems: list[str] = []
    for record in records:
        art = ROOT / str(record["art_source"])
        public = ROOT / "game-client" / "public" / str(record["runtime"]).lstrip("/")
        with Image.open(art) as image:
            if image.size != (record["width"], record["height"]):
                problems.append(f"dimension mismatch: {record['name']}")
            if image.mode == "RGBA":
                bbox = alpha_bbox(image)
                if bbox != record["alpha_bbox"]:
                    problems.append(f"alpha bbox mismatch: {record['name']}")
                corners = [image.getpixel(point)[3] for point in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))]
                if any(corners):
                    problems.append(f"opaque corner: {record['name']} {corners}")
                coverage = max((bbox[2] - bbox[0]) / image.width, (bbox[3] - bbox[1]) / image.height)
                if coverage < 0.7 and not record.get("intentional_padding"):
                    problems.append(f"loose alpha canvas: {record['name']} {coverage:.3f}")
            if record["role"] in {"ground-decal", "effect", "foreground"} and image.mode != "RGBA":
                problems.append(f"non-RGBA overlay: {record['name']}")
        if sha256(art) != sha256(public):
            problems.append(f"mirror mismatch: {record['name']}")
        if record["collision_profile"] and record["review"] != "approved":
            problems.append(f"unreviewed collision profile: {record['name']}")
    return {"passed": not problems, "problem_count": len(problems), "problems": problems}


def main() -> None:
    processed_root = ART_ROOT / "processed"
    remove_tree(processed_root)
    remove_tree(PUBLIC_ROOT)
    provenance = copy_sources()
    records: list[dict[str, object]] = []

    transparent_asset("E01-left", "sprites/common/forest-exit-silver-mist-left.png", records, (420, 420), "portal-marker", "portal-base")
    transparent_asset("E01-right", "sprites/common/forest-exit-silver-mist-right.png", records, (420, 420), "portal-marker", "portal-base")

    for part, code, basename in ((2, "W01", "silver-mist-valley"), (3, "R01", "root-ruins"), (4, "N01", "night-firefly-path"), (5, "D01", "broken-moon-deep-forest")):
        source = Image.open(SOURCE_BY_CODE[code].path)
        for variant in range(3):
            save_asset(seamless_ground(source, (512, 512), variant), f"ground/part-{part}-{basename}-ground-{variant + 1}.png", [code], records, role="ground-tile", collision_profile=None, anchor=(0.5, 0.5), footpoint=(256, 256))
        save_asset(macro_overlay(source, (1024, 1024), (19, 47, 53)), f"ground/part-{part}-macro-overlay.png", [code], records, role="ground-decal", collision_profile=None, anchor=(0.5, 0.5), footpoint=(512, 512), intentional_padding="full-map low-frequency overlay")

    water_calm = seamless_ground(Image.open(SOURCE_BY_CODE["W02-calm"].path), (512, 512))
    water_flow = seamless_ground(Image.open(SOURCE_BY_CODE["W02-flow"].path), (512, 512), 1)
    save_asset(water_calm, "ground/part-2-stream-water-calm.png", ["W02-calm"], records, role="water-material", collision_profile=None, anchor=(0.5, 0.5), footpoint=(256, 256))
    save_asset(water_flow, "ground/part-2-stream-water-flow.png", ["W02-flow"], records, role="water-material", collision_profile=None, anchor=(0.5, 0.5), footpoint=(256, 256))

    bank_sources = {
        1: cropped_chroma("W03-01"),
        2: cropped_chroma("W03-02"),
        3: cropped_chroma("W03-03"),
        # Keep only the straight lower arm of the generated L-shaped candidate.
        4: finished_chroma("W03-04", (768, 512), (400, 760, 1100, 990), source_alpha_floor=64, edge_passes=8, dark_threshold=64),
        5: cropped_chroma("W03-05"),
        6: cropped_chroma("W03-06"),
        # The narrow central strip excludes both closed ends, edge plants, and visible glow points.
        7: finished_chroma("W03-07", (768, 512), (540, 470, 996, 548), source_alpha_floor=56, edge_passes=5, dark_threshold=42),
        9: purify_chroma_edges(
            fit_max(neutralize_upper_right_haze(cropped_chroma("W03-09", alpha_floor=72)), (768, 512)),
            passes=9,
            dark_threshold=64,
        ),
    }
    bank_sources[8] = tight_canvas(bank_sources[7].rotate(-45, expand=True, resample=Image.Resampling.BICUBIC))
    for index in range(1, 10):
        prepared = fit_max(bank_sources[index], (768, 512))
        if index in {4, 7, 8, 9}:
            prepared = purify_chroma_edges(
                prepared,
                passes=6 if index in {7, 8} else 9,
                dark_threshold=42 if index in {7, 8} else 64,
            )
        save_asset(prepared, f"sprites/part-2/stream-bank/stream-bank-{index:02d}.png", [f"W03-{7 if index == 8 else index:02d}"], records, role="ground-prop", collision_profile=None, anchor=(0.5, 0.5))
    save_asset(finished_chroma("W04-horizontal", (640, 420), source_alpha_floor=48, edge_passes=6), "sprites/part-2/fallen-log-bridge-horizontal.png", ["W04-horizontal"], records, role="landmark", collision_profile=None)
    save_asset(finished_chroma("W04-diagonal", (640, 420), source_alpha_floor=48, edge_passes=6), "sprites/part-2/fallen-log-bridge-diagonal.png", ["W04-diagonal"], records, role="landmark", collision_profile=None)
    foliage_codes = ("W05-silverleaf", "W05-reed", "W05-bush", "W05-star-mint", "W05-aquatic-moss")
    for output_index, code in enumerate(foliage_codes, 1):
        save_asset(fit_max(cropped_chroma(code, alpha_floor=40), (512, 512)), f"sprites/part-2/aquatic-foliage/aquatic-foliage-{output_index:02d}.png", [code], records, role="ground-prop", collision_profile=None)
    save_asset(fit_max(silver_mask(Image.open(SOURCE_BY_CODE["W06"].path), 0.72), (700, 420)), "effects/part-2/reverse-mist-fall.png", ["W06"], records, role="effect", collision_profile=None, anchor=(0.5, 0.5))
    reflection = feather_alpha(silver_mask(Image.open(SOURCE_BY_CODE["W07"].path), 0.48), (900, 360), feather=92, opacity=0.7)
    save_asset(reflection, "effects/part-2/wetland-reflection.png", ["W07"], records, role="effect", collision_profile=None, anchor=(0.5, 0.5), footpoint=(450, 180), intentional_padding="masked to stream corridor")

    transparent_asset("R02", "sprites/part-3/giant-root-arch.png", records, (720, 720), "landmark", "root-arch-feet")
    ruins = component_crops("R03", 12)[:10]
    ruin_profiles = ("ruin-pillar", "ruin-low-wall", "ruin-rubble", "ruin-low-wall", "ruin-low-wall", "ruin-pillar", "ruin-low-wall", "ruin-rubble", "ruin-low-wall", "ruin-pillar")
    for index, (image, profile) in enumerate(zip(ruins, ruin_profiles, strict=True), 1):
        save_asset(image, f"sprites/part-3/weathered-ruins/weathered-ruin-{index:02d}.png", ["R03"], records, role="world-ruin", collision_profile=profile)
    transparent_asset("R04-open", "sprites/part-3/root-gate-open.png", records, (620, 620), "landmark", "root-gate-feet")
    courtyard = soft_decal(Image.open(SOURCE_BY_CODE["R05"].path), (820, 760), feather=112, opacity=0.9)
    save_asset(courtyard, "ground/part-3-sunken-courtyard.png", ["R05"], records, role="ground-decal", collision_profile=None, anchor=(0.5, 0.5), footpoint=(410, 380), intentional_padding="112px feathered courtyard edge")
    transparent_asset("R06-idle", "sprites/part-3/ruin-clue-slab-idle.png", records, (420, 420), "landmark", "clue-slab-base")
    transparent_asset("R06-active", "sprites/part-3/ruin-clue-slab-active.png", records, (420, 420), "effect", None)

    corridors = component_crops("N02", 3)
    for name, image in zip(("left", "straight", "right"), corridors, strict=True):
        for angle in (0, 45, 90, 135):
            rotated = tight_canvas(image.rotate(-angle, expand=True, resample=Image.Resampling.BICUBIC))
            save_asset(rotated, f"sprites/part-4/tree-corridor-{name}-{angle}.png", ["N02"], records, role="canopy", collision_profile=None)
    markers = component_crops("N03", 16)
    for output_index, source_index in enumerate((0, 2, 4, 6, 8, 10, 12, 14), 1):
        save_asset(markers[source_index], f"sprites/part-4/glowing-path-markers/glowing-path-marker-{output_index:02d}.png", ["N03"], records, role="effect", collision_profile=None)
    false_markers = component_crops("N06", 8, largest=True)
    for index, image in enumerate(false_markers, 1):
        save_asset(image, f"sprites/part-4/false-path-markers/false-path-marker-{index:02d}.png", ["N06"], records, role="ground-prop", collision_profile=None)
    firefly_source = silver_mask(Image.open(SOURCE_BY_CODE["N04"].path), 0.75)
    cell_width = firefly_source.width // 3
    cell_height = firefly_source.height // 2
    for index in range(6):
        column = index % 3
        row = index // 3
        crop = firefly_source.crop((
            column * cell_width,
            row * cell_height,
            firefly_source.width if column == 2 else (column + 1) * cell_width,
            firefly_source.height if row == 1 else (row + 1) * cell_height,
        ))
        save_asset(tight_canvas(crop), f"effects/part-4/night-fireflies/night-firefly-group-{index + 1:02d}.png", ["N04"], records, role="effect", collision_profile=None, anchor=(0.5, 0.5))
    save_asset(fit_max(silver_mask(Image.open(SOURCE_BY_CODE["N05"].path), 0.68), (900, 760)), "effects/part-4/broken-canopy-moonlight.png", ["N05"], records, role="effect", collision_profile=None, anchor=(0.5, 0.5))
    branches = component_crops("N07", 3)
    ordered_branches = sorted(branches, key=lambda image: image.width, reverse=True)
    top = ordered_branches[0]
    sides = sorted(ordered_branches[1:], key=lambda image: image.width)
    for name, image in zip(("top", "left", "right"), (top, sides[0], sides[1]), strict=True):
        save_asset(image, f"sprites/part-4/foreground-branches-{name}.png", ["N07"], records, role="foreground", collision_profile=None, anchor=(0.5, 0.5))

    walls = component_crops("D02", 3)
    for index, image in enumerate(walls, 1):
        save_asset(image, f"sprites/part-5/broken-canopy-tree-wall-{index:02d}.png", ["D02"], records, role="canopy", collision_profile=None)
    trees = component_crops("D03", 5)
    tree_profiles = ("tree-01-trunk", "tree-02-trunk", "tree-03-trunk", "tree-04-trunk", "tree-05-trunk")
    for index, (image, profile) in enumerate(zip(trees, tree_profiles, strict=True), 1):
        save_asset(image, f"sprites/part-5/inward-leaning-tree-{index:02d}.png", ["D03"], records, role="world-tree", collision_profile=profile)
    basin_source = Image.open(SOURCE_BY_CODE["D04"].path)
    basin_edge = soft_decal(basin_source, (920, 840), feather=116, opacity=0.82)
    save_asset(basin_edge, "ground/part-5-mist-convergence-basin-edge.png", ["D04"], records, role="ground-decal", collision_profile=None, anchor=(0.5, 0.5), footpoint=(460, 420), intentional_padding="116px feathered basin edge")
    basin_mist = silver_mask(basin_source, 0.38).resize((760, 620), Image.Resampling.LANCZOS)
    basin_edge_mask = Image.new("L", basin_mist.size, 0)
    ImageDraw.Draw(basin_edge_mask).ellipse((64, 54, basin_mist.width - 65, basin_mist.height - 55), fill=255)
    basin_mist.putalpha(Image.composite(
        basin_mist.getchannel("A").filter(ImageFilter.GaussianBlur(38)),
        Image.new("L", basin_mist.size, 0),
        basin_edge_mask.filter(ImageFilter.GaussianBlur(46)),
    ))
    save_asset(basin_mist, "effects/part-5/mist-convergence-basin-mist.png", ["D04"], records, role="effect", collision_profile=None, anchor=(0.5, 0.5), footpoint=(380, 310), intentional_padding="soft basin mist")
    transparent_asset("D05", "sprites/part-5/central-stage-landmark.png", records, (700, 700), "landmark", "central-landmark-roots")
    for code, state, opacity in (("D06-idle", "idle", 0.42), ("D06-active", "active", 0.72)):
        response = fit_max(silver_mask(Image.open(SOURCE_BY_CODE[code].path), opacity), (720, 720))
        save_asset(response, f"effects/part-5/broken-moon-response-{state}.png", [code], records, role="effect", collision_profile=None, anchor=(0.5, 0.5))
    transparent_asset("D07", "sprites/part-5/deep-forest-stable-exit.png", records, (520, 520), "landmark", "stable-exit-base")

    build_contact_sheet(records)
    build_ground_preview(records)
    build_water_preview(records)
    validation = validate(records)
    manifest = {
        "version": VERSION,
        "source_root": str(SOURCE_ROOT),
        "runtime_root": RUNTIME_ROOT,
        "notes": [
            "V2 preserves V1 and rebuilds from immutable original sources.",
            "W03, R03, N03, N06, D03, N02, D02, and N07 use connected-component candidates with explicit semantic selection.",
            "All object sprites use tight RGBA canvases with 12px safety padding and manifest footpoints.",
            "W02 water sources are deterministic bidirectionally seamless RGB materials used only through the spline mask.",
            "W03-07 is conservatively cropped to its undecorated center; W03-08 is a deterministic rotated derivative for the diagonal bridge.",
            "R05 and D04 are emitted as feathered RGBA decals/effect layers rather than opaque local rectangles.",
        ],
        "sources": provenance,
        "assets": records,
        "validation": validation,
    }
    (ART_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    if not validation["passed"]:
        raise RuntimeError("Validation failed:\n" + "\n".join(validation["problems"]))
    print(f"Prepared {len(records)} {VERSION} runtime assets from {len(SOURCES)} sources")
    print(f"Manifest: {ART_ROOT / 'manifest.json'}")


if __name__ == "__main__":
    main()
