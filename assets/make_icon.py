from PIL import Image, ImageDraw
import os

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# rounded square gradient background
mask = Image.new('L', (size, size), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, size - 1, size - 1], radius=112, fill=255)

bg = Image.new('RGB', (size, size), (79, 70, 229))
bd = ImageDraw.Draw(bg)
for y in range(size):
    t = y / (size - 1)
    r = int(79 + (14 - 79) * t)
    g = int(70 + (165 - 70) * t)
    b = int(229 + (233 - 229) * t)
    bd.line([(0, y), (size, y)], fill=(r, g, b))
img.paste(bg, (0, 0), mask)

d = ImageDraw.Draw(img)

# open book: two pages
white = (255, 255, 255, 255)
page_shadow = (30, 41, 59, 45)
# left page
left = [(112, 322), (112, 196), (236, 168), (236, 300)]
right = [(276, 168), (400, 196), (400, 322), (276, 300)]
# shadow
d.polygon([(x + 6, y + 10) for x, y in left], fill=page_shadow)
d.polygon([(x + 6, y + 10) for x, y in right], fill=page_shadow)
d.polygon(left, fill=white)
d.polygon(right, fill=white)
# center spine
d.rounded_rectangle([246, 172, 266, 306], radius=8, fill=(224, 231, 255, 255))
# page lines
line_color = (99, 102, 241, 150)
for i in range(4):
    y = 220 + i * 22
    d.rounded_rectangle([140, y, 222, y + 5], radius=3, fill=line_color)
    d.rounded_rectangle([290, y, 372, y + 5], radius=3, fill=line_color)

# bookmark / spark
d.ellipse([356, 92, 430, 166], fill=(250, 204, 21, 255))
d.ellipse([374, 110, 412, 148], fill=(255, 255, 255, 235))
# small dots
d.ellipse([92, 96, 120, 124], fill=(255, 255, 255, 80))
d.ellipse([416, 384, 440, 408], fill=(255, 255, 255, 65))

base = os.path.dirname(os.path.abspath(__file__))
os.makedirs(base, exist_ok=True)
img.save(os.path.join(base, 'icon.png'))
img.save(os.path.join(base, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('created assets/icon.png and assets/icon.ico')
