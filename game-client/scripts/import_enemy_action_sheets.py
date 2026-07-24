from __future__ import annotations

from pathlib import Path

from PIL import Image


GAME_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = GAME_ROOT.parent
INPUT_DIR = PROJECT_ROOT / ".tmp" / "enemy-sheets"
PUBLIC_DIR = GAME_ROOT / "public" / "assets" / "generated" / "sprites"
SOURCE_DIR = GAME_ROOT / "art-source" / "generated"

SOURCE_SIZE = 1024
COLUMNS = 4
ROWS = 5
FRAME_SIZE = 256
CONTENT_MARGIN_X = 8
CONTENT_TOP = 8
BASELINE = 248
BOUNDARY_SEARCH_RADIUS = 55


def alpha_crop(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("source frame is fully transparent")
    return image.crop(bbox)


def fit_frame(sprite: Image.Image) -> Image.Image:
    max_width = FRAME_SIZE - 2 * CONTENT_MARGIN_X
    max_height = BASELINE - CONTENT_TOP
    scale = min(1.0, max_width / sprite.width, max_height / sprite.height)
    if scale == 1.0:
        return sprite

    size = (
        max(1, round(sprite.width * scale)),
        max(1, round(sprite.height * scale)),
    )
    return sprite.resize(size, Image.Resampling.LANCZOS)


def row_boundaries(sheet: Image.Image, column: int) -> list[int]:
    x0 = column * (SOURCE_SIZE // COLUMNS)
    x1 = (column + 1) * (SOURCE_SIZE // COLUMNS)
    alpha = sheet.crop((x0, 0, x1, SOURCE_SIZE)).getchannel("A")
    counts = []
    for y in range(SOURCE_SIZE):
        histogram = alpha.crop((0, y, alpha.width, y + 1)).histogram()
        counts.append(alpha.width - histogram[0])

    boundaries = [0]
    for row in range(1, ROWS):
        nominal = round(row * SOURCE_SIZE / ROWS)
        start = nominal - BOUNDARY_SEARCH_RADIUS
        end = nominal + BOUNDARY_SEARCH_RADIUS
        boundary = min(range(start, end + 1), key=lambda y: (counts[y], abs(y - nominal)))
        boundaries.append(boundary)
    boundaries.append(SOURCE_SIZE)
    return boundaries


def source_cell(
    sheet: Image.Image,
    boundaries: list[int],
    row: int,
    column: int,
) -> Image.Image:
    x0 = column * (SOURCE_SIZE // COLUMNS)
    x1 = (column + 1) * (SOURCE_SIZE // COLUMNS)
    return sheet.crop((x0, boundaries[row], x1, boundaries[row + 1]))


def build_sheet(input_path: Path) -> Image.Image:
    source = Image.open(input_path).convert("RGBA")
    if source.size != (SOURCE_SIZE, SOURCE_SIZE):
        raise ValueError(f"{input_path.name}: expected 1024x1024, got {source.size}")

    output = Image.new(
        "RGBA",
        (COLUMNS * FRAME_SIZE, ROWS * FRAME_SIZE),
        (0, 0, 0, 0),
    )
    for column in range(COLUMNS):
        boundaries = row_boundaries(source, column)
        for row in range(ROWS):
            sprite = fit_frame(alpha_crop(source_cell(source, boundaries, row, column)))
            x = column * FRAME_SIZE + (FRAME_SIZE - sprite.width) // 2
            y = row * FRAME_SIZE + BASELINE - sprite.height
            output.alpha_composite(sprite, (x, y))

    return output


def validate_sheet(sheet: Image.Image, name: str) -> None:
    expected_size = (COLUMNS * FRAME_SIZE, ROWS * FRAME_SIZE)
    if sheet.mode != "RGBA" or sheet.size != expected_size:
        raise ValueError(f"{name}: expected RGBA {expected_size}, got {sheet.mode} {sheet.size}")

    for row in range(ROWS):
        for column in range(COLUMNS):
            left = column * FRAME_SIZE
            top = row * FRAME_SIZE
            frame = sheet.crop((left, top, left + FRAME_SIZE, top + FRAME_SIZE))
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                raise ValueError(f"{name}: frame ({row}, {column}) is empty")
            if bbox[0] < CONTENT_MARGIN_X or bbox[2] > FRAME_SIZE - CONTENT_MARGIN_X:
                raise ValueError(f"{name}: frame ({row}, {column}) exceeds horizontal bounds")
            if bbox[1] < CONTENT_TOP or bbox[3] > BASELINE:
                raise ValueError(f"{name}: frame ({row}, {column}) exceeds vertical bounds")
            if row == 3 and (
                bbox[0] == 0
                or bbox[1] == 0
                or bbox[2] == FRAME_SIZE
                or bbox[3] == FRAME_SIZE
            ):
                raise ValueError(f"{name}: death frame ({row}, {column}) touches an edge")


def output_name(input_path: Path) -> str:
    suffix = "-keyed.png"
    if not input_path.name.endswith(suffix):
        raise ValueError(f"unexpected input filename: {input_path.name}")
    return f"{input_path.name.removesuffix(suffix)}-combat-sheet.png"


def main() -> None:
    inputs = sorted(INPUT_DIR.glob("npc-*-keyed.png"))
    if not inputs:
        raise FileNotFoundError(f"no keyed enemy sheets found in {INPUT_DIR}")

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    for input_path in inputs:
        name = output_name(input_path)
        sheet = build_sheet(input_path)
        validate_sheet(sheet, name)
        sheet.save(PUBLIC_DIR / name, optimize=True)
        sheet.save(SOURCE_DIR / name, optimize=True)
        print(f"imported {input_path.name} -> {name}")


if __name__ == "__main__":
    main()
