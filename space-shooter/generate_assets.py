#!/usr/bin/env python3
"""
Generate placeholder PNG assets for the Space Shooter game.
Requires: pip install Pillow
Run from the space-shooter/ directory: python generate_assets.py
"""
import math, os, random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), 'assets', 'images')
os.makedirs(OUT, exist_ok=True)

def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path)
    print(f'  wrote {path}')

# ── Background tile ──────────────────────────────────────────────────────
def make_bg():
    img = Image.new('RGBA', (64, 64), (13, 0, 24, 255))
    d = ImageDraw.Draw(img)
    rng = random.Random(42)
    for _ in range(12):
        x, y = rng.randint(0,63), rng.randint(0,63)
        brightness = rng.randint(140, 255)
        d.point((x, y), fill=(brightness, brightness, brightness, 255))
    for _ in range(4):
        x, y = rng.randint(0,62), rng.randint(0,62)
        d.rectangle([x, y, x+1, y+1], fill=(180, 180, 255, 255))
    save(img, 'darkPurple.png')

# ── Player ship ──────────────────────────────────────────────────────────
def make_player():
    img = Image.new('RGBA', (48, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Body
    d.polygon([(24,0),(42,50),(24,42),(6,50)], fill=(34, 136, 255, 255))
    # Wings
    d.polygon([(6,50),(0,58),(18,44)],  fill=(20, 100, 200, 255))
    d.polygon([(42,50),(48,58),(30,44)], fill=(20, 100, 200, 255))
    # Cockpit
    for r in range(8, 0, -1):
        alpha = int(255 * r / 8)
        c = int(200 + 55 * r / 8)
        d.ellipse([24-r, 22-r*1.3, 24+r, 22+r*1.3], fill=(c, c, 255, alpha))
    # Engine
    d.ellipse([18, 48, 30, 56], fill=(255, 140, 0, 220))
    d.ellipse([21, 50, 27, 54], fill=(255, 240, 180, 255))
    save(img, 'playerShip1_blue.png')

# ── Enemy ships ──────────────────────────────────────────────────────────
def make_enemy(name, body_color, variant):
    img = Image.new('RGBA', (48, 42), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if variant == 1:
        d.polygon([(24,42),(4,10),(24,18),(44,10)], fill=body_color)
        d.polygon([(4,10),(0,20),(12,18)],  fill=tuple(max(c-40,0) for c in body_color[:3])+(255,))
        d.polygon([(44,10),(48,20),(36,18)], fill=tuple(max(c-40,0) for c in body_color[:3])+(255,))
    elif variant == 2:
        d.polygon([(24,42),(0,15),(12,0),(36,0),(48,15)], fill=body_color)
        d.rectangle([18,0,30,10], fill=tuple(max(c-50,0) for c in body_color[:3])+(255,))
    else:
        d.polygon([(24,42),(2,20),(10,2),(38,2),(46,20)], fill=body_color)
        d.ellipse([16,2,32,14], fill=tuple(max(c-40,0) for c in body_color[:3])+(255,))
    # Engine glow
    d.ellipse([19,34,29,42], fill=(255, 80, 80, 200))
    d.ellipse([22,36,26,40], fill=(255, 200, 200, 255))
    save(img, name)

# ── Laser beams ──────────────────────────────────────────────────────────
def make_laser(name, r, g, b):
    img = Image.new('RGBA', (8, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for row in range(32):
        t = row / 31.0
        dist_center = abs(t - 0.5) * 2        # 0 at mid, 1 at ends
        width_factor = 1.0 - dist_center * 0.5
        alpha = int(255 * (1 - dist_center ** 1.5))
        half = int(3 * width_factor)
        if half > 0:
            d.rectangle([4-half, row, 4+half, row], fill=(r, g, b, alpha))
    # bright core line
    for row in range(4, 28):
        d.point((4, row), fill=(255, 255, 255, 200))
    save(img, name)

# ── Boss ship ────────────────────────────────────────────────────────────
def make_boss():
    img = Image.new('RGBA', (96, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Main body — wide flat saucer shape
    d.polygon([(48,10),(88,40),(80,70),(16,70),(8,40)], fill=(120, 0, 160, 255))
    # Side appendages
    d.polygon([(8,40),(0,55),(20,52),(16,70)],  fill=(90, 0, 130, 255))
    d.polygon([(88,40),(96,55),(76,52),(80,70)], fill=(90, 0, 130, 255))
    # Cockpit dome
    for r in range(18, 0, -1):
        t = r / 18
        alpha = int(255 * t)
        c_r = int(255 * (1 - t * 0.5))
        c_g = int(80 * t)
        c_b = int(255 * t)
        d.ellipse([48-r, 22-r*0.8, 48+r, 22+r*0.8], fill=(c_r, c_g, c_b, alpha))
    # Glowing core (center)
    d.ellipse([38, 40, 58, 60], fill=(255, 80, 255, 200))
    d.ellipse([43, 45, 53, 55], fill=(255, 220, 255, 255))
    # Engine nozzles across bottom
    for bx in [24, 40, 56, 72]:
        d.ellipse([bx-5, 66, bx+5, 78], fill=(255, 100, 50, 200))
        d.ellipse([bx-2, 68, bx+2, 76], fill=(255, 230, 180, 255))
    # Menacing eye-like sensors
    d.ellipse([30, 30, 40, 38], fill=(255, 40, 40, 230))
    d.ellipse([56, 30, 66, 38], fill=(255, 40, 40, 230))
    d.point((35, 34), fill=(255, 255, 255, 255))
    d.point((61, 34), fill=(255, 255, 255, 255))
    save(img, 'boss.png')

# ── Power-up capsule ─────────────────────────────────────────────────────
def make_powerup(name, r, g, b):
    img = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Outer glow ring
    for radius in range(11, 7, -1):
        alpha = int(80 * (11 - radius) / 4)
        d.ellipse([12 - radius, 12 - radius, 12 + radius, 12 + radius],
                  outline=(r, g, b, alpha), width=1)
    # Capsule body
    d.ellipse([3, 3, 20, 20], fill=(min(r + 30, 255), min(g + 30, 255), min(b + 30, 255), 220))
    # Bright core
    d.ellipse([8, 8, 15, 15], fill=(255, 255, 255, 200))
    save(img, name)

# ── Explosion spritesheet (9 frames × 64px wide) ─────────────────────────
def make_explosion():
    frames = 9
    fw, fh = 64, 64
    img = Image.new('RGBA', (fw * frames, fh), (0, 0, 0, 0))
    for i in range(frames):
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        progress = i / (frames - 1)
        max_r = 26
        r = int(max_r * math.sin(progress * math.pi))
        if r < 1:
            img.paste(frame, (i * fw, 0))
            continue
        cx, cy = fw // 2, fh // 2
        alpha_base = int(255 * (1 - progress * 0.6))
        # Draw rings from outside in
        for ring in range(r, 0, -1):
            t = ring / r
            a = int(alpha_base * t)
            color = (
                min(255, int(50 + 200 * t)),
                min(255, int(20 + 100 * (1-t))),
                0, a
            )
            d.ellipse([cx-ring, cy-ring, cx+ring, cy+ring], outline=color)
        # Bright core
        cr = max(1, r // 4)
        d.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=(255, 255, 200, alpha_base))
        img.paste(frame, (i * fw, 0), frame)
    save(img, 'explosion.png')

if __name__ == '__main__':
    print('Generating assets...')
    make_bg()
    make_player()
    make_enemy('enemyBlack1.png', (180,  30,  30, 255), 1)
    make_enemy('enemyBlack2.png', (140,  20,  20, 255), 2)
    make_enemy('enemyBlack3.png', (160,  10,  10, 255), 3)
    make_laser('laserBlue01.png', 68, 170, 255)
    make_laser('laserRed01.png',  255, 60, 40)
    make_explosion()
    make_boss()
    make_powerup('powerupSpeed.png', 255, 220,   0)   # yellow/gold
    make_powerup('powerupPower.png',   0, 200, 255)   # cyan
    print('Done! Assets written to assets/images/')
