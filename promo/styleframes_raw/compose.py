# Composes styleframe_01..03.png (Sanctum promo, tone-approval pass). Re-run: python3 styleframes_raw/compose.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops
import random
G='/usr/share/fonts/truetype/sand-box/google/'
def font(name,size):
    import glob
    p=sorted(glob.glob(G+name+'/*.ttf'))[0]; f=ImageFont.truetype(p,size)
    try: f.set_variation_by_name('Bold')
    except Exception: pass
    return f
ANTON=lambda s: font('Anton',s); MONO=lambda s: font('JetBrains Mono',s)
MAG=(255,45,149); CY=(25,227,255); OR=(255,106,19); VI=(155,92,255); GOLD=(232,185,49); IV=(244,241,234)
def grain(im,amt=14):
    n=Image.effect_noise(im.size,amt).convert('RGB'); return ImageChops.overlay(im,ImageEnhance.Brightness(n).enhance(1.0)) if False else Image.blend(im,ImageChops.overlay(im,n),0.18)
def glitch_text(base,xy,text,f,fill=IV,split=6):
    lay=Image.new('RGBA',base.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    x,y=xy; d.text((x-split,y),text,font=f,fill=MAG+(200,)); d.text((x+split,y),text,font=f,fill=CY+(170,)); d.text((x,y),text,font=f,fill=fill+(255,))
    base.alpha_composite(lay)
def glow(base,box,color,r=40,w=6):
    lay=Image.new('RGBA',base.size,(0,0,0,0)); d=ImageDraw.Draw(lay); d.rounded_rectangle(box,radius=28,outline=color+(255,),width=w)
    g=lay.filter(ImageFilter.GaussianBlur(r)); base.alpha_composite(g); base.alpha_composite(g); base.alpha_composite(lay)
def vignette(im,s=0.75):
    w,h=im.size; m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m); d.ellipse((-w*0.15,-h*0.15,w*1.15,h*1.15),fill=255)
    m=m.filter(ImageFilter.GaussianBlur(w//6)); black=Image.new('RGB',(w,h),(0,0,0)); return Image.composite(im,black,m.point(lambda v:int(255*(1-s)+v*s)))
def hud(d,xy,text,col=CY,size=26): d.text(xy,text,font=MONO(size),fill=col)
def letterbox(im,bar):
    d=ImageDraw.Draw(im); w,h=im.size; d.rectangle((0,0,w,bar),fill=(0,0,0)); d.rectangle((0,h-bar,w,h),fill=(0,0,0))
def frame_label(d,w,h,n,note):
    d.text((40,h-58),f"SANCTUM // STYLE FRAME {n:02d} // {note}",font=MONO(22),fill=(154,151,168))
    d.text((w-420,h-58),"TIBERIOUS PRODUCTIONS",font=MONO(22),fill=GOLD)

# ---- 01: velocity flash + ripple, hero type
im=Image.open('styleframes_raw/sf01_raw.jpg').convert('RGB').resize((1920,1080),Image.LANCZOS)
im=ImageEnhance.Contrast(im).enhance(1.15); im=vignette(im,0.6); im=grain(im).convert('RGBA')
letterbox(im,70)
glitch_text(im,(90,150),"HIT IT HARD.",ANTON(190))
d=ImageDraw.Draw(im)
hud(d,(98,380),"VEL 127  ·  PAD 1  ·  BANK A  ·  FULL",OR,30)
hud(d,(98,420),"PRE-LIGHT ON TOUCH-DOWN",CY,26)
d.text((1460,150),"VO:",font=MONO(24),fill=(154,151,168)); d.text((1460,180),"\"Hit it hard —\n it answers.\"",font=MONO(30),fill=IV)
frame_label(d,1920,1080,1,"VELOCITY FLASH / RIPPLE · 0:08")
im.convert('RGB').save('styleframe_01.png')

# ---- 02: stage wide, Link
im=Image.open('styleframes_raw/sf02_raw.jpg').convert('RGB').resize((1920,1080),Image.LANCZOS)
im=ImageEnhance.Contrast(im).enhance(1.12); im=grain(im).convert('RGBA'); letterbox(im,70)
f=ANTON(230); t="ONE CLOCK."; tw=ImageDraw.Draw(im).textlength(t,font=f)
glitch_text(im,((1920-tw)//2,640),t,f)
d=ImageDraw.Draw(im)
s="ABLETON LINK  ·  TEMPO + PHASE LOCKED  ·  BAR 4"; sw=d.textlength(s,font=MONO(30)); hud(d,((1920-sw)//2,955),s,CY,30)
frame_label(d,1920,1080,2,"LINK SYNC / STAGE WIDE · 0:24")
im.convert('RGB').save('styleframe_02.png')

# ---- 03: vertical 9:16 social, REAL app capture (smoke run), neon framing
W,H=1080,1920
bg=Image.open('styleframes_raw/sf02_raw.jpg').convert('RGB')
bg=bg.crop((280,0,280+405,720)).resize((W,H),Image.LANCZOS).filter(ImageFilter.GaussianBlur(18))
bg=ImageEnhance.Brightness(bg).enhance(0.45); im=grain(bg).convert('RGBA')
ui=Image.open('app_captures/smoke-phone-dark-playing-loop.png').convert('RGBA')
sc=1180/ui.height; ui=ui.resize((int(ui.width*sc),int(ui.height*sc)),Image.LANCZOS)
x=(W-ui.width)//2; y=380
glow(im,(x-14,y-14,x+ui.width+14,y+ui.height+14),MAG,r=46,w=8)
mask=Image.new('L',ui.size,0); ImageDraw.Draw(mask).rounded_rectangle((0,0)+ui.size,radius=34,fill=255)
im.paste(ui,(x,y),mask)
f=ANTON(170); glitch_text(im,(70,110),"SIXTEEN PADS.",f,split=5)
glitch_text(im,(70,1590),"EIGHT BANKS.",ANTON(150),fill=IV,split=5)
d=ImageDraw.Draw(im)
hud(d,(74,320),"REAL UI · SANCTUM v0.2.0 · LOOPS LOCK TO THE BAR",CY,24)
d.text((40,H-58),"SANCTUM // STYLE FRAME 03 // 9:16 SOCIAL · 0:03",font=MONO(20),fill=(154,151,168))
im.convert('RGB').save('styleframe_03.png')
print('ok')
