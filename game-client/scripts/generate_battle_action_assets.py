from __future__ import annotations

from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "assets" / "generated"
SOURCE = ROOT / "art-source" / "generated"
FRAME = 256


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    return alpha.getbbox() or (0, 0, image.width, image.height)


def fitted_character(image: Image.Image, max_size: tuple[int, int]) -> Image.Image:
    rgba = image.convert("RGBA").crop(alpha_bbox(image.convert("RGBA")))
    rgba.thumbnail(max_size, Image.Resampling.LANCZOS)
    return rgba


def paste_centered(canvas: Image.Image, sprite: Image.Image, x: int, baseline: int) -> None:
    canvas.alpha_composite(sprite, (x - sprite.width // 2, baseline - sprite.height))


def shield_layer(size: int, strength: float = 1.0) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    pad = int(size * 0.13)
    box = (pad, pad, size - pad, size - pad)
    draw.ellipse(box, fill=(46, 196, 182, int(32 * strength)), outline=(194, 255, 244, int(215 * strength)), width=max(3, size // 45))
    inner = tuple(value + (size // 14 if index < 2 else -size // 14) for index, value in enumerate(box))
    draw.ellipse(inner, outline=(111, 236, 225, int(120 * strength)), width=max(2, size // 70))
    return layer.filter(ImageFilter.GaussianBlur(max(0.2, size / 300)))


def sparkle(draw: ImageDraw.ImageDraw, x: int, y: int, radius: int, color: tuple[int, int, int, int]) -> None:
    draw.line((x - radius, y, x + radius, y), fill=color, width=max(1, radius // 3))
    draw.line((x, y - radius, x, y + radius), fill=color, width=max(1, radius // 3))


def transformed(sprite: Image.Image, *, scale: float = 1.0, angle: float = 0.0, tint: tuple[int, int, int] | None = None, alpha: float = 1.0) -> Image.Image:
    width = max(1, round(sprite.width * scale))
    height = max(1, round(sprite.height * scale))
    result = sprite.resize((width, height), Image.Resampling.LANCZOS)
    if tint is not None:
        overlay = Image.new("RGBA", result.size, (*tint, 0))
        overlay.putalpha(result.getchannel("A").point(lambda value: int(value * 0.45)))
        result = Image.alpha_composite(result, overlay)
    if alpha < 1:
        result.putalpha(result.getchannel("A").point(lambda value: int(value * alpha)))
    if angle:
        result = result.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    return result


def action_frame(sprite: Image.Image, action: Literal["attack", "defense", "hit", "death", "victory"], index: int) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    progress = index / 3
    x = FRAME // 2
    baseline = 232
    angle = 0.0
    scale = 1.0
    tint = None
    alpha = 1.0

    if action == "attack":
        x += (0, 10, 23, 7)[index]
        angle = (0, -3, 7, 1)[index]
        scale = (0.96, 1.0, 1.06, 1.0)[index]
    elif action == "defense":
        x += (0, -3, -5, 0)[index]
        baseline += (0, 3, 6, 2)[index]
        scale = (1.0, 0.97, 0.94, 0.98)[index]
    elif action == "hit":
        x -= (0, 8, 17, 5)[index]
        angle = (0, -5, -10, -2)[index]
        tint = (231, 70, 70) if index in (1, 2) else None
    elif action == "death":
        angle = -72 * progress
        x -= round(22 * progress)
        baseline += round(18 * progress)
        alpha = 1 - 0.35 * progress
    elif action == "victory":
        baseline -= (0, 10, 18, 4)[index]
        scale = (1.0, 1.04, 1.08, 1.02)[index]

    character = transformed(sprite, scale=scale, angle=angle, tint=tint, alpha=alpha)
    paste_centered(canvas, character, x, baseline)
    draw = ImageDraw.Draw(canvas)

    if action == "attack" and index in (1, 2):
        arc_box = (112, 54, 248, 218)
        draw.arc(arc_box, start=285, end=75, fill=(255, 222, 113, 220), width=5)
    elif action == "defense" and index > 0:
        shield = shield_layer(188, (0.55, 0.85, 1.0, 0.65)[index])
        canvas.alpha_composite(shield, (34, 30))
    elif action == "hit" and index == 2:
        draw.polygon([(205, 66), (216, 87), (241, 83), (224, 102), (236, 124), (211, 113), (197, 132), (201, 106), (177, 96), (203, 91)], fill=(255, 221, 115, 235))
    elif action == "victory" and index > 0:
        sparkle(draw, 54, 66, 10 + index * 2, (255, 230, 128, 230))
        sparkle(draw, 204, 82, 7 + index, (255, 245, 184, 210))

    return canvas


def build_enemy_sheet(source_path: Path, output_name: str) -> None:
    source = Image.open(source_path).convert("RGBA")
    if source.getchannel("A").getextrema() == (255, 255):
        source = source.crop((0, 0, source.width, source.height))
    sprite = fitted_character(source, (178, 210))
    sheet = Image.new("RGBA", (FRAME * 4, FRAME * 5), (0, 0, 0, 0))
    for row, action in enumerate(("attack", "defense", "hit", "death", "victory")):
        for column in range(4):
            sheet.alpha_composite(action_frame(sprite, action, column), (column * FRAME, row * FRAME))
    destination = PUBLIC / "sprites" / output_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)
    sheet.save(SOURCE / output_name, optimize=True)


def build_player_defense(source_path: Path, output_name: str, source_frame: int, margin: int = 0) -> None:
    sheet = Image.open(source_path).convert("RGBA")
    x = margin + 3 * source_frame
    idle = sheet.crop((x, margin, x + source_frame, margin + source_frame))
    sprite = fitted_character(idle, (round(source_frame * 0.74), round(source_frame * 0.82)))
    output = Image.new("RGBA", (source_frame * 4, source_frame), (0, 0, 0, 0))
    for index in range(4):
        canvas = Image.new("RGBA", (source_frame, source_frame), (0, 0, 0, 0))
        scale = (1.0, 0.97, 0.94, 0.98)[index]
        character = transformed(sprite, scale=scale)
        paste_centered(canvas, character, source_frame // 2 - (0, 2, 4, 0)[index], source_frame - round(source_frame * 0.06))
        if index > 0:
            shield = shield_layer(round(source_frame * 0.76), (0.55, 0.85, 1.0, 0.65)[index])
            canvas.alpha_composite(shield, ((source_frame - shield.width) // 2, round(source_frame * 0.08)))
        output.alpha_composite(canvas, (index * source_frame, 0))
    destination = PUBLIC / "sprites" / output_name
    output.save(destination, optimize=True)
    output.save(SOURCE / output_name, optimize=True)


def radial_background(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    center = size * 0.48
    for y in range(size):
        for x in range(size):
            distance = min(1.0, (((x - center) ** 2 + (y - center) ** 2) ** 0.5) / (size * 0.72))
            pixels[x, y] = (
                round(22 + 7 * (1 - distance)),
                round(73 + 68 * (1 - distance)),
                round(82 + 77 * (1 - distance)),
            )
    return image.convert("RGBA")


def build_defense_card() -> None:
    size = 1024
    canvas = radial_background(size)
    draw = ImageDraw.Draw(canvas, "RGBA")
    for radius, alpha in ((410, 28), (330, 40), (250, 55)):
        box = (size // 2 - radius, size // 2 - radius, size // 2 + radius, size // 2 + radius)
        draw.ellipse(box, outline=(151, 255, 239, alpha), width=10)
    for x, y, radius in ((130, 190, 12), (850, 220, 9), (160, 770, 8), (864, 720, 14), (730, 110, 7)):
        sparkle(draw, x, y, radius, (230, 255, 238, 180))

    shield = shield_layer(720, 0.72)
    canvas.alpha_composite(shield, ((size - shield.width) // 2, 145))

    character_path = PUBLIC / "sprites" / "adventurer-female.png"
    character = fitted_character(Image.open(character_path).convert("RGBA"), (620, 740))
    target_height = 650
    if character.height < target_height:
        target_width = round(character.width * target_height / character.height)
        character = character.resize((target_width, target_height), Image.Resampling.LANCZOS)
    character = ImageEnhance.Color(character).enhance(0.92)
    paste_centered(canvas, character, size // 2, 950)
    foreground = shield_layer(760, 0.34)
    canvas.alpha_composite(foreground, ((size - foreground.width) // 2, 125))

    source_path = SOURCE / "basic-defense-card.png"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(source_path, optimize=True)
    runtime = canvas.resize((512, 512), Image.Resampling.LANCZOS)
    runtime.save(PUBLIC / "cards" / "basic-defense.webp", "WEBP", quality=92, method=6)


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    build_defense_card()
    build_player_defense(PUBLIC / "sprites" / "adventurer-female-combat-sheet.png", "adventurer-female-defense-sheet.png", 313, 1)
    build_player_defense(PUBLIC / "sprites" / "adventurer-male-combat-sheet.png", "adventurer-male-defense-sheet.png", 256)

    enemies = {
        "npc-village-chief.png": "npc-village-chief-combat-sheet.png",
        "npc-shopkeeper.png": "npc-shopkeeper-combat-sheet.png",
        "npc-suna.png": "npc-suna-combat-sheet.png",
        "npc-forest-guide.png": "npc-forest-guide-combat-sheet.png",
        "npc-trainer.png": "npc-trainer-combat-sheet.png",
    }
    for source_name, output_name in enemies.items():
        build_enemy_sheet(PUBLIC / "sprites" / source_name, output_name)
    build_enemy_sheet(PUBLIC / "portraits" / "luna.webp", "npc-luna-combat-sheet.png")


if __name__ == "__main__":
    main()
