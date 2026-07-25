from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


GAME_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = GAME_ROOT / "art-source" / "generated" / "npc-walk"
OUTPUT_DIR = GAME_ROOT / "public" / "assets" / "generated" / "sprites"

NPC_NAMES = (
    "village-chief",
    "shopkeeper",
    "suna",
    "forest-guide",
    "trainer",
    "luna",
)
SOURCE_SIZE = 1024
FRAME_COUNT = 4
FRAME_SIZE = 256
CONTENT_MARGIN_X = 10
CONTENT_TOP = 8
BASELINE = 248
BOUNDARY_SEARCH_RADIUS = 96


def is_magenta(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    return (
        red >= 110
        and blue >= 110
        and green <= 180
        and min(red, blue) - green >= 18
        and red + blue >= 245
        and abs(red - blue) <= 140
    )


def is_magenta_background_core(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    return red >= 210 and blue >= 210 and green <= 80 and abs(red - blue) <= 60


def remove_magenta_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    foreground = Image.new("L", (width, height), 255)
    alpha_pixels = foreground.load()
    candidates = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            candidates[y * width + x] = is_magenta(pixels[x, y])

    queue: deque[tuple[int, int]] = deque()

    def add_edge_candidate(x: int, y: int) -> None:
        index = y * width + x
        if not candidates[index]:
            return
        candidates[index] = 0
        alpha_pixels[x, y] = 0
        queue.append((x, y))

    for x in range(width):
        add_edge_candidate(x, 0)
        add_edge_candidate(x, height - 1)
    for y in range(1, height - 1):
        add_edge_candidate(0, y)
        add_edge_candidate(width - 1, y)

    def remove_connected_candidates() -> None:
        while queue:
            x, y = queue.popleft()
            for next_x, next_y in (
                (x - 1, y - 1),
                (x, y - 1),
                (x + 1, y - 1),
                (x - 1, y),
                (x + 1, y),
                (x - 1, y + 1),
                (x, y + 1),
                (x + 1, y + 1),
            ):
                if not (0 <= next_x < width and 0 <= next_y < height):
                    continue
                index = next_y * width + next_x
                if not candidates[index]:
                    continue
                candidates[index] = 0
                alpha_pixels[next_x, next_y] = 0
                queue.append((next_x, next_y))

    remove_connected_candidates()

    # Limbs and props can enclose islands of background that cannot reach an image edge.
    # Seed only pixels close to the source key color, then consume their tolerant halo.
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if candidates[index] and is_magenta_background_core(pixels[x, y]):
                candidates[index] = 0
                alpha_pixels[x, y] = 0
                queue.append((x, y))
    remove_connected_candidates()

    # A sub-pixel feather avoids hard keyed edges while retaining opaque character detail.
    foreground = foreground.filter(ImageFilter.GaussianBlur(0.65))
    alpha_pixels = foreground.load()
    interior = foreground.filter(ImageFilter.MinFilter(5)).load()
    output = rgba.copy()
    output_pixels = output.load()
    for y in range(height):
        for x in range(width):
            alpha = alpha_pixels[x, y]
            red, green, blue, _ = output_pixels[x, y]
            if alpha == 0:
                output_pixels[x, y] = (0, 0, 0, 0)
                continue
            if alpha < 250 or interior[x, y] < 250:
                spill = max(0, min(red, blue) - green)
                red = max(0, red - spill)
                blue = max(0, blue - spill)
            output_pixels[x, y] = (red, green, blue, alpha)
    return output


def frame_boundaries(image: Image.Image) -> list[int]:
    alpha = image.getchannel("A")
    counts = []
    for x in range(SOURCE_SIZE):
        histogram = alpha.crop((x, 0, x + 1, SOURCE_SIZE)).histogram()
        counts.append(SOURCE_SIZE - histogram[0])

    boundaries = [0]
    for index in range(1, FRAME_COUNT):
        nominal = index * SOURCE_SIZE // FRAME_COUNT
        start = nominal - BOUNDARY_SEARCH_RADIUS
        end = nominal + BOUNDARY_SEARCH_RADIUS
        transparent_runs: list[tuple[int, int]] = []
        run_start: int | None = None
        for x in range(start, end + 1):
            if counts[x] <= 2:
                if run_start is None:
                    run_start = x
            elif run_start is not None:
                transparent_runs.append((run_start, x - 1))
                run_start = None
        if run_start is not None:
            transparent_runs.append((run_start, end))

        if transparent_runs:
            left, right = max(
                transparent_runs,
                key=lambda run: (run[1] - run[0], -abs((run[0] + run[1]) / 2 - nominal)),
            )
            boundary = (left + right) // 2
        else:
            boundary = min(range(start, end + 1), key=lambda x: (counts[x], abs(x - nominal)))
        boundaries.append(boundary)
    boundaries.append(SOURCE_SIZE)
    return boundaries


def content_crop(frame: Image.Image, source_name: str, index: int) -> Image.Image:
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{source_name}: frame {index} is empty after background removal")
    return frame.crop(bbox)


def remove_small_components(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    width, height = frame.size
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            start_index = y * width + x
            if visited[start_index] or alpha_pixels[x, y] <= 24:
                continue
            visited[start_index] = 1
            queue = [(x, y)]
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.pop()
                component.append((current_x, current_y))
                for next_x, next_y in (
                    (current_x - 1, current_y - 1),
                    (current_x, current_y - 1),
                    (current_x + 1, current_y - 1),
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x - 1, current_y + 1),
                    (current_x, current_y + 1),
                    (current_x + 1, current_y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_index = next_y * width + next_x
                    if visited[next_index] or alpha_pixels[next_x, next_y] <= 24:
                        continue
                    visited[next_index] = 1
                    queue.append((next_x, next_y))
            components.append(component)

    if not components:
        return frame
    minimum_area = max(80, round(max(len(component) for component in components) * 0.008))
    cleaned = frame.copy()
    cleaned_pixels = cleaned.load()
    for component in components:
        if len(component) >= minimum_area:
            continue
        for x, y in component:
            cleaned_pixels[x, y] = (0, 0, 0, 0)
    return cleaned


def build_sheet(source_path: Path) -> Image.Image:
    source = Image.open(source_path).convert("RGBA")
    if source.size != (SOURCE_SIZE, SOURCE_SIZE):
        raise ValueError(
            f"{source_path.name}: expected {SOURCE_SIZE}x{SOURCE_SIZE}, got {source.size}"
        )

    keyed = remove_magenta_background(source)
    boundaries = frame_boundaries(keyed)
    crops = []
    for index in range(FRAME_COUNT):
        frame = keyed.crop((boundaries[index], 0, boundaries[index + 1], SOURCE_SIZE))
        frame = remove_small_components(frame)
        crops.append(content_crop(frame, source_path.name, index))

    max_width = max(frame.width for frame in crops)
    max_height = max(frame.height for frame in crops)
    scale = min(
        (FRAME_SIZE - CONTENT_MARGIN_X * 2) / max_width,
        (BASELINE - CONTENT_TOP) / max_height,
    )
    output = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(crops):
        size = (
            max(1, round(frame.width * scale)),
            max(1, round(frame.height * scale)),
        )
        sprite = frame.resize(size, Image.Resampling.LANCZOS)
        x = index * FRAME_SIZE + (FRAME_SIZE - sprite.width) // 2
        y = BASELINE - sprite.height
        output.alpha_composite(sprite, (x, y))
    return output


def validate_sheet(sheet: Image.Image, output_name: str) -> None:
    expected_size = (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE)
    if sheet.mode != "RGBA" or sheet.size != expected_size:
        raise ValueError(f"{output_name}: expected RGBA {expected_size}, got {sheet.mode} {sheet.size}")
    if sheet.getchannel("A").getextrema()[0] != 0:
        raise ValueError(f"{output_name}: expected transparent background")

    for index in range(FRAME_COUNT):
        frame = sheet.crop((index * FRAME_SIZE, 0, (index + 1) * FRAME_SIZE, FRAME_SIZE))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"{output_name}: frame {index} is empty")
        if bbox[0] < CONTENT_MARGIN_X or bbox[2] > FRAME_SIZE - CONTENT_MARGIN_X:
            raise ValueError(f"{output_name}: frame {index} exceeds horizontal bounds")
        if bbox[1] < CONTENT_TOP or bbox[3] > BASELINE:
            raise ValueError(f"{output_name}: frame {index} exceeds vertical bounds")


def main() -> None:
    expected_sources = [SOURCE_DIR / f"npc-{name}-walk-source.png" for name in NPC_NAMES]
    missing = [path.name for path in expected_sources if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"missing NPC walk sources in {SOURCE_DIR}: {', '.join(missing)}")
    expected_names = {path.name for path in expected_sources}
    unexpected = sorted(path.name for path in SOURCE_DIR.glob("*.png") if path.name not in expected_names)
    if unexpected:
        raise ValueError(f"unexpected NPC walk sources in {SOURCE_DIR}: {', '.join(unexpected)}")

    generated: list[tuple[Path, str, Image.Image]] = []
    for source_path in expected_sources:
        output_name = source_path.name.replace("-source.png", "-sheet.png")
        sheet = build_sheet(source_path)
        validate_sheet(sheet, output_name)
        generated.append((source_path, output_name, sheet))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for source_path, output_name, sheet in generated:
        sheet.save(OUTPUT_DIR / output_name, optimize=True)
        print(f"imported {source_path.name} -> {output_name}")


if __name__ == "__main__":
    main()
