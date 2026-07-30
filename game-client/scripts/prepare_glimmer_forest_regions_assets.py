from __future__ import annotations

import hashlib
import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = Path("D:/\u751f\u6210/images")
VERSION = "glimmer-forest-regions-v1"
ART_ROOT = ROOT / "game-client" / "art-source" / "generated" / VERSION
PUBLIC_ROOT = (
    ROOT
    / "game-client"
    / "public"
    / "assets"
    / "generated"
    / "environment"
    / "glimmer-forest"
    / "regions-v1"
)


@dataclass(frozen=True)
class Source:
    code: str
    filename: str
    role: str
    mode: str
    review: str = "accepted_with_processing"

    @property
    def path(self) -> Path:
        return SOURCE_ROOT / self.filename


SOURCES = [
    Source("W07", "gen_hist_1785395128336_0pdjl.png", "wetland reflection mask", "mask"),
    Source("D06-fade", "gen_hist_1785397668217_nkkpb.png", "broken-moon response fade", "mask"),
    Source("D06-active", "gen_hist_1785397428319_r9bvo.png", "broken-moon response active", "mask"),
    Source("D06-idle", "gen_hist_1785397294592_grl58.png", "broken-moon response idle", "mask"),
    Source("W04-horizontal", "gen_hist_1785393390825_xkv7l.png", "fallen-log bridge horizontal", "chroma"),
    Source("N04", "gen_hist_1785396664736_jcq41.png", "night-firefly mask atlas", "mask"),
    Source("W06", "gen_hist_1785394427127_4ig1f.png", "reverse mist-fall mask", "mask"),
    Source("W05", "gen_hist_1785394397423_sbmfr.png", "aquatic foliage atlas", "chroma"),
    Source("N05", "gen_hist_1785396853656_bhqqx.png", "broken-canopy moonlight mask", "mask"),
    Source("E01-left", "gen_hist_1785391445202_6802c.png", "silver-mist valley marker left", "chroma"),
    Source("E01-right", "gen_hist_1785391836632_yufva.png", "silver-mist valley marker right", "chroma"),
    Source("W04-diagonal", "gen_hist_1785392312528_27tdb.png", "fallen-log bridge diagonal", "chroma"),
    Source("D07", "gen_hist_1785397438984_22efk.png", "deep-forest stable exit marker", "chroma"),
    Source("D05", "gen_hist_1785397215774_wltg2.png", "central stage landmark", "chroma"),
    Source("W03", "gen_hist_1785392075602_mm8dz.png", "stream bank and shoal atlas", "chroma"),
    Source("D03", "gen_hist_1785397261629_25j6y.png", "inward-leaning ancient tree atlas", "chroma"),
    Source("N06", "gen_hist_1785397040712_fknyh.png", "false-path marker atlas", "chroma"),
    Source("N07", "gen_hist_1785396896077_go05n.png", "foreground branch atlas", "chroma"),
    Source("N03", "gen_hist_1785396633046_r5rrk.png", "glowing path marker atlas", "chroma"),
    Source("R06-active", "gen_hist_1785396774182_ik8tl.png", "ruin clue slab active", "chroma"),
    Source("R06-idle", "gen_hist_1785396590350_3iedu.png", "ruin clue slab idle", "chroma"),
    Source("N02", "gen_hist_1785396358214_c8jor.png", "dense tree-corridor boundary atlas", "chroma"),
    Source("R03", "gen_hist_1785395200382_y3jbg.png", "weathered ruin component atlas", "chroma"),
    Source("R02", "gen_hist_1785395189480_7h225.png", "giant root arch", "chroma"),
    Source("W02-calm", "gen_hist_1785392765479_bgls7.png", "cold-gray stream calm", "opaque"),
    Source("W02-flow", "gen_hist_1785392256296_js21a.png", "cold-gray stream flowing", "opaque"),
    Source("W04-environment", "gen_hist_1785392127314_xh3rm.png", "fallen log with baked environment", "chroma", "source_only"),
    Source("E02-open", "gen_hist_1785391904072_5c57z.png", "giant root roadblock open", "chroma"),
    Source("W01", "gen_hist_1785391592555_f336z.png", "silver-mist valley ground", "opaque"),
    Source("E02-closed", "gen_hist_1785391455503_jy2z0.png", "giant root roadblock closed", "chroma"),
    Source("D04", "gen_hist_1785397167726_75s4b.png", "mist-convergence basin ground", "opaque"),
    Source("D02", "gen_hist_1785397114321_95zna.png", "broken-canopy tree-wall atlas", "chroma"),
    Source("R01", "gen_hist_1785396918805_f1qtr.png", "root-ruin ground", "opaque"),
    Source("N01", "gen_hist_1785396338118_zttlr.png", "night-firefly path ground", "opaque"),
    Source("R04-open", "gen_hist_1785396312750_0484h.png", "root gate open", "chroma"),
    Source("R05", "gen_hist_1785396113838_rjcr0.png", "sunken courtyard ground", "opaque"),
    Source("R04-closed", "gen_hist_1785396101256_5sqcd.png", "root gate closed", "chroma"),
    Source("D01", "gen_hist_1785395140182_kco0o.png", "broken-moon deep-forest ground", "opaque"),
]

SOURCE_BY_CODE = {source.code: source for source in SOURCES}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def flattened_data(image: Image.Image):
    getter = getattr(image, "get_flattened_data", None)
    return getter() if getter else image.getdata()


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for r, g, b, _ in flattened_data(rgba):
        key_distance = math.sqrt((255 - r) ** 2 + g**2 + (255 - b) ** 2)
        magenta_dominance = min(r, b) - g
        alpha_from_distance = max(0.0, min(1.0, (key_distance - 18) / 105))
        alpha_from_dominance = max(0.0, min(1.0, (185 - magenta_dominance) / 125))
        alpha = int(255 * max(alpha_from_distance, alpha_from_dominance))
        if alpha < 10:
            alpha = 0
        elif alpha > 245:
            alpha = 255

        if alpha < 255:
            spill = max(0, min(r, b) - g)
            r = max(0, int(r - spill * 0.72))
            b = max(0, int(b - spill * 0.72))
        pixels.append((r, g, b, alpha))
    rgba.putdata(pixels)
    return rgba


def mask_to_alpha(image: Image.Image, *, opacity: float = 1.0) -> Image.Image:
    rgb = image.convert("RGB")
    alpha = Image.new("L", rgb.size)
    alpha.putdata([
        max(0, min(255, round(max(r, g, b) * opacity)))
        for r, g, b in flattened_data(rgb)
    ])
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.35))
    result = Image.new("RGBA", rgb.size, (210, 235, 255, 0))
    result.putalpha(alpha)
    return result


def enforce_broken_ring(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    cut = Image.new("L", rgba.size, 255)
    draw = ImageDraw.Draw(cut)
    width, height = rgba.size
    draw.polygon(
        [
            (int(width * 0.48), int(height * 0.48)),
            (int(width * 0.68), 0),
            (int(width * 0.9), 0),
            (int(width * 0.6), int(height * 0.56)),
        ],
        fill=0,
    )
    draw.polygon(
        [
            (int(width * 0.44), int(height * 0.52)),
            (int(width * 0.16), height),
            (int(width * 0.34), height),
            (int(width * 0.53), int(height * 0.58)),
        ],
        fill=0,
    )
    rgba.putalpha(Image.composite(alpha, Image.new("L", rgba.size, 0), cut))
    return rgba


def make_edge_blended_seamless(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    tile = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    feather_x = max(24, size[0] // 8)
    feather_y = max(24, size[1] // 8)

    left = tile.crop((0, 0, feather_x, size[1]))
    right_aligned = tile.crop((size[0] - feather_x, 0, size[0], size[1])).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    horizontal_average = Image.blend(left, right_aligned, 0.5)
    horizontal_mask = Image.new("L", (feather_x, size[1]))
    horizontal_mask.putdata([
        round(255 * (1 - x / max(1, feather_x - 1)))
        for _y in range(size[1])
        for x in range(feather_x)
    ])
    tile.paste(Image.composite(horizontal_average, left, horizontal_mask), (0, 0))
    right_blend = Image.composite(horizontal_average, right_aligned, horizontal_mask).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    tile.paste(right_blend, (size[0] - feather_x, 0))

    top = tile.crop((0, 0, size[0], feather_y))
    bottom_aligned = tile.crop((0, size[1] - feather_y, size[0], size[1])).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    vertical_average = Image.blend(top, bottom_aligned, 0.5)
    vertical_mask = Image.new("L", (size[0], feather_y))
    vertical_mask.putdata([
        round(255 * (1 - y / max(1, feather_y - 1)))
        for y in range(feather_y)
        for _x in range(size[0])
    ])
    tile.paste(Image.composite(vertical_average, top, vertical_mask), (0, 0))
    bottom_blend = Image.composite(vertical_average, bottom_aligned, vertical_mask).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    tile.paste(bottom_blend, (0, size[1] - feather_y))
    return tile


def trim_alpha(image: Image.Image, padding: int = 12) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        return rgba
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(rgba.width, bbox[2] + padding)
    bottom = min(rgba.height, bbox[3] + padding)
    return rgba.crop((left, top, right, bottom))


def fit_canvas(image: Image.Image, size: tuple[int, int], margin: int = 16) -> Image.Image:
    rgba = trim_alpha(image)
    max_width = max(1, size[0] - margin * 2)
    max_height = max(1, size[1] - margin * 2)
    scale = min(max_width / rgba.width, max_height / rgba.height, 1.0)
    if scale < 1:
        rgba = rgba.resize(
            (max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))),
            Image.Resampling.LANCZOS,
        )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(rgba, ((size[0] - rgba.width) // 2, (size[1] - rgba.height) // 2))
    return canvas


def grid_crop(image: Image.Image, columns: int, rows: int, index: int, inset: float = 0.015) -> Image.Image:
    column = index % columns
    row = index // columns
    cell_width = image.width / columns
    cell_height = image.height / rows
    left = int(column * cell_width + cell_width * inset)
    top = int(row * cell_height + cell_height * inset)
    right = int((column + 1) * cell_width - cell_width * inset)
    bottom = int((row + 1) * cell_height - cell_height * inset)
    return image.crop((left, top, right, bottom))


def horizontal_crop(image: Image.Image, count: int, index: int, inset: float = 0.01) -> Image.Image:
    return grid_crop(image, count, 1, index, inset)


def save_runtime(image: Image.Image, relative: str, source_codes: list[str], records: list[dict[str, object]]) -> None:
    art_path = ART_ROOT / "processed" / relative
    public_path = PUBLIC_ROOT / relative
    art_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(art_path, optimize=True)
    shutil.copy2(art_path, public_path)
    records.append(
        {
            "name": Path(relative).name,
            "source_codes": source_codes,
            "art_source": str(art_path.relative_to(ROOT)).replace("\\", "/"),
            "runtime": "/" + str(public_path.relative_to(ROOT / "game-client" / "public")).replace("\\", "/"),
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "sha256": sha256(art_path),
        }
    )


def save_transparent(
    code: str,
    relative: str,
    records: list[dict[str, object]],
    canvas: tuple[int, int],
    *,
    image: Image.Image | None = None,
) -> None:
    source = SOURCE_BY_CODE[code]
    processed = remove_magenta(Image.open(source.path)) if image is None else image
    save_runtime(fit_canvas(processed, canvas), relative, [code], records)


def save_mask(
    code: str,
    relative: str,
    records: list[dict[str, object]],
    canvas: tuple[int, int],
    *,
    opacity: float = 1.0,
    image: Image.Image | None = None,
) -> None:
    source = SOURCE_BY_CODE[code]
    processed = mask_to_alpha(Image.open(source.path), opacity=opacity) if image is None else image
    save_runtime(fit_canvas(processed, canvas), relative, [code], records)


def save_opaque(
    code: str,
    relative: str,
    records: list[dict[str, object]],
    size: tuple[int, int],
    *,
    seamless: bool = False,
) -> None:
    source = Image.open(SOURCE_BY_CODE[code].path)
    image = make_edge_blended_seamless(source, size) if seamless else source.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    save_runtime(image, relative, [code], records)


def save_chroma_grid(
    code: str,
    columns: int,
    rows: int,
    names: list[str],
    folder: str,
    records: list[dict[str, object]],
    canvas: tuple[int, int],
) -> None:
    source = remove_magenta(Image.open(SOURCE_BY_CODE[code].path))
    if len(names) != columns * rows:
        raise ValueError(f"{code}: expected {columns * rows} names, got {len(names)}")
    for index, name in enumerate(names):
        save_runtime(
            fit_canvas(grid_crop(source, columns, rows, index), canvas),
            f"sprites/{folder}/{name}.png",
            [code],
            records,
        )


def save_mask_grid(
    code: str,
    columns: int,
    rows: int,
    names: list[str],
    folder: str,
    records: list[dict[str, object]],
    canvas: tuple[int, int],
) -> None:
    source = mask_to_alpha(Image.open(SOURCE_BY_CODE[code].path))
    if len(names) != columns * rows:
        raise ValueError(f"{code}: expected {columns * rows} names, got {len(names)}")
    for index, name in enumerate(names):
        save_runtime(
            fit_canvas(grid_crop(source, columns, rows, index, inset=0.0), canvas),
            f"effects/{folder}/{name}.png",
            [code],
            records,
        )


def copy_sources() -> list[dict[str, object]]:
    raw_root = ART_ROOT / "raw"
    raw_root.mkdir(parents=True, exist_ok=True)
    provenance = []
    for source in SOURCES:
        if not source.path.exists():
            raise FileNotFoundError(source.path)
        target = raw_root / source.filename
        shutil.copy2(source.path, target)
        with Image.open(source.path) as image:
            provenance.append(
                {
                    "code": source.code,
                    "filename": source.filename,
                    "role": source.role,
                    "mode": source.mode,
                    "review": source.review,
                    "width": image.width,
                    "height": image.height,
                    "image_mode": image.mode,
                    "sha256": sha256(source.path),
                }
            )
    return provenance


def build_source_contact_sheet() -> None:
    thumb_width, thumb_height, label_height = 320, 240, 34
    columns = 4
    rows = math.ceil(len(SOURCES) / columns)
    sheet = Image.new("RGB", (columns * thumb_width, rows * (thumb_height + label_height)), (20, 24, 29))
    draw = ImageDraw.Draw(sheet)
    for index, source in enumerate(SOURCES):
        image = Image.open(source.path).convert("RGB")
        image.thumbnail((thumb_width - 12, thumb_height - 12), Image.Resampling.LANCZOS)
        cell_x = (index % columns) * thumb_width
        cell_y = (index // columns) * (thumb_height + label_height)
        sheet.paste(image, (cell_x + (thumb_width - image.width) // 2, cell_y + (thumb_height - image.height) // 2))
        draw.text((cell_x + 8, cell_y + thumb_height + 5), f"{source.code}  {source.review}", fill=(235, 239, 242))
    sheet.save(ART_ROOT / "source-contact-sheet.jpg", quality=90)


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (38, 45, 51, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(61, 70, 77, 255))
    return image


def build_processed_contact_sheet(records: list[dict[str, object]]) -> None:
    thumb_size, label_height, columns = 180, 28, 6
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (columns * thumb_size, rows * (thumb_size + label_height)), (17, 21, 25))
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        path = ROOT / str(record["art_source"])
        image = Image.open(path).convert("RGBA")
        image.thumbnail((thumb_size - 12, thumb_size - 12), Image.Resampling.LANCZOS)
        tile = checkerboard((thumb_size, thumb_size))
        tile.alpha_composite(image, ((thumb_size - image.width) // 2, (thumb_size - image.height) // 2))
        x = (index % columns) * thumb_size
        y = (index // columns) * (thumb_size + label_height)
        sheet.paste(tile.convert("RGB"), (x, y))
        draw.text((x + 5, y + thumb_size + 5), str(record["name"])[:25], fill=(225, 233, 238))
    sheet.save(ART_ROOT / "processed-contact-sheet.jpg", quality=90)


def build_ground_tile_preview(records: list[dict[str, object]]) -> None:
    grounds = [record for record in records if "/ground/" in str(record["art_source"])]
    tile_size = 160
    columns = 3
    rows = math.ceil(len(grounds) / columns)
    sheet = Image.new("RGB", (columns * tile_size * 2, rows * tile_size * 2), (18, 22, 26))
    for index, record in enumerate(grounds):
        image = Image.open(ROOT / str(record["art_source"])).convert("RGB").resize((tile_size, tile_size), Image.Resampling.LANCZOS)
        block = Image.new("RGB", (tile_size * 2, tile_size * 2))
        for y in (0, tile_size):
            for x in (0, tile_size):
                block.paste(image, (x, y))
        sheet.paste(block, ((index % columns) * tile_size * 2, (index // columns) * tile_size * 2))
    sheet.save(ART_ROOT / "ground-tile-preview.jpg", quality=90)


def validate(records: list[dict[str, object]]) -> dict[str, object]:
    problems = []
    for record in records:
        art_path = ROOT / str(record["art_source"])
        public_path = ROOT / "game-client" / "public" / str(record["runtime"]).lstrip("/")
        with Image.open(art_path) as image:
            if image.size != (record["width"], record["height"]):
                problems.append(f"dimension mismatch: {record['name']}")
            if image.mode == "RGBA":
                corners = [
                    image.getpixel((0, 0))[3],
                    image.getpixel((image.width - 1, 0))[3],
                    image.getpixel((0, image.height - 1))[3],
                    image.getpixel((image.width - 1, image.height - 1))[3],
                ]
                if any(corners):
                    problems.append(f"non-transparent corner: {record['name']} {corners}")
        if sha256(art_path) != sha256(public_path):
            problems.append(f"mirror mismatch: {record['name']}")
    return {"passed": not problems, "problem_count": len(problems), "problems": problems}


def main() -> None:
    provenance = copy_sources()
    build_source_contact_sheet()
    records: list[dict[str, object]] = []

    save_transparent("E01-left", "sprites/common/forest-exit-silver-mist-left.png", records, (512, 512))
    save_transparent("E01-right", "sprites/common/forest-exit-silver-mist-right.png", records, (512, 512))
    save_transparent("E02-closed", "sprites/common/root-roadblock-closed.png", records, (768, 512))
    save_transparent("E02-open", "sprites/common/root-roadblock-open.png", records, (768, 512))

    save_opaque("W01", "ground/part-2-silver-mist-valley-ground.png", records, (512, 512), seamless=True)
    save_opaque("W02-calm", "ground/part-2-stream-water-calm.png", records, (512, 512), seamless=True)
    save_opaque("W02-flow", "ground/part-2-stream-water-flow.png", records, (512, 512), seamless=True)
    save_chroma_grid("W03", 5, 2, [f"stream-bank-{index:02d}" for index in range(1, 11)], "part-2/stream-bank", records, (384, 384))
    save_transparent("W04-horizontal", "sprites/part-2/fallen-log-bridge-horizontal.png", records, (768, 512))
    save_transparent("W04-diagonal", "sprites/part-2/fallen-log-bridge-diagonal.png", records, (768, 512))
    save_chroma_grid("W05", 4, 3, [f"aquatic-foliage-{index:02d}" for index in range(1, 13)], "part-2/aquatic-foliage", records, (256, 256))
    save_mask("W06", "effects/part-2/reverse-mist-fall.png", records, (1024, 512))
    save_mask("W07", "effects/part-2/wetland-reflection.png", records, (1024, 512), opacity=0.82)

    save_opaque("R01", "ground/part-3-root-ruins-ground.png", records, (512, 512), seamless=True)
    save_transparent("R02", "sprites/part-3/giant-root-arch.png", records, (1024, 1024))
    save_chroma_grid("R03", 4, 3, [f"weathered-ruin-{index:02d}" for index in range(1, 13)], "part-3/weathered-ruins", records, (384, 384))
    save_transparent("R04-closed", "sprites/part-3/root-gate-closed.png", records, (768, 768))
    save_transparent("R04-open", "sprites/part-3/root-gate-open.png", records, (768, 768))
    save_opaque("R05", "ground/part-3-sunken-courtyard.png", records, (1024, 1024))
    save_transparent("R06-idle", "sprites/part-3/ruin-clue-slab-idle.png", records, (768, 768))
    save_transparent("R06-active", "sprites/part-3/ruin-clue-slab-active.png", records, (768, 768))

    save_opaque("N01", "ground/part-4-night-firefly-path-ground.png", records, (512, 512), seamless=True)
    n02 = remove_magenta(Image.open(SOURCE_BY_CODE["N02"].path))
    for index, name in enumerate(("straight", "left", "right")):
        save_runtime(fit_canvas(horizontal_crop(n02, 3, index), (1024, 512)), f"sprites/part-4/tree-corridor-{name}.png", ["N02"], records)
    save_chroma_grid("N03", 4, 4, [f"glowing-path-marker-{index:02d}" for index in range(1, 17)], "part-4/glowing-path-markers", records, (256, 256))
    save_mask_grid("N04", 3, 2, [f"night-firefly-group-{index:02d}" for index in range(1, 7)], "part-4/night-fireflies", records, (384, 384))
    save_mask("N05", "effects/part-4/broken-canopy-moonlight.png", records, (1024, 1024), opacity=0.78)
    save_chroma_grid("N06", 4, 4, [f"false-path-marker-{index:02d}" for index in range(1, 17)], "part-4/false-path-markers", records, (256, 256))
    n07 = remove_magenta(Image.open(SOURCE_BY_CODE["N07"].path))
    n07_boxes = ((0.25, 0.0, 0.75, 0.48), (0.0, 0.25, 0.38, 1.0), (0.62, 0.25, 1.0, 1.0))
    for name, box in zip(("top", "left", "right"), n07_boxes, strict=True):
        crop = n07.crop((int(box[0] * n07.width), int(box[1] * n07.height), int(box[2] * n07.width), int(box[3] * n07.height)))
        save_runtime(fit_canvas(crop, (1024, 512)), f"sprites/part-4/foreground-branches-{name}.png", ["N07"], records)

    save_opaque("D01", "ground/part-5-broken-moon-deep-forest-ground.png", records, (512, 512), seamless=True)
    d02 = remove_magenta(Image.open(SOURCE_BY_CODE["D02"].path))
    for index in range(3):
        save_runtime(fit_canvas(horizontal_crop(d02, 3, index), (1024, 768)), f"sprites/part-5/broken-canopy-tree-wall-{index + 1:02d}.png", ["D02"], records)
    d03 = remove_magenta(Image.open(SOURCE_BY_CODE["D03"].path))
    d03_boxes = ((0.0, 0.0, 0.34, 0.58), (0.33, 0.0, 0.67, 0.58), (0.66, 0.0, 1.0, 0.58), (0.12, 0.42, 0.52, 1.0), (0.5, 0.42, 0.92, 1.0))
    for index, box in enumerate(d03_boxes, start=1):
        crop = d03.crop((int(box[0] * d03.width), int(box[1] * d03.height), int(box[2] * d03.width), int(box[3] * d03.height)))
        save_runtime(fit_canvas(crop, (640, 768)), f"sprites/part-5/inward-leaning-tree-{index:02d}.png", ["D03"], records)
    save_opaque("D04", "ground/part-5-mist-convergence-basin.png", records, (1024, 1024))
    save_transparent("D05", "sprites/part-5/central-stage-landmark.png", records, (1024, 1024))
    for code, state, opacity in (
        ("D06-idle", "idle", 0.52),
        ("D06-active", "active", 0.9),
        ("D06-fade", "fade", 0.34),
    ):
        broken = enforce_broken_ring(mask_to_alpha(Image.open(SOURCE_BY_CODE[code].path), opacity=opacity))
        save_mask(code, f"effects/part-5/broken-moon-response-{state}.png", records, (1024, 1024), image=broken)
    save_transparent("D07", "sprites/part-5/deep-forest-stable-exit.png", records, (768, 768))

    build_processed_contact_sheet(records)
    build_ground_tile_preview(records)
    validation = validate(records)
    manifest = {
        "version": VERSION,
        "source_root": str(SOURCE_ROOT),
        "runtime_root": "/assets/generated/environment/glimmer-forest/regions-v1/",
        "notes": [
            "External source files are copied byte-for-byte and never overwritten.",
            "W04-environment is retained as source_only because the bridge is baked into a water-and-ground patch.",
            "D06 states share two enforced transparent gaps; idle and fade states are also opacity-limited so they do not read as a complete portal.",
            "Ground tile preview is diagnostic; generated ground images still require in-engine scale review before repeated tiling.",
        ],
        "sources": provenance,
        "assets": records,
        "validation": validation,
    }
    (ART_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    if not validation["passed"]:
        raise RuntimeError("Validation failed:\n" + "\n".join(validation["problems"]))
    print(f"Prepared {len(records)} runtime assets from {len(SOURCES)} source images")
    print(f"Manifest: {ART_ROOT / 'manifest.json'}")


if __name__ == "__main__":
    main()
