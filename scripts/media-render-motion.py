"""Render six quiet, silent loop scenes from FlowTask's original scene artwork.

These are original procedural animations over generated artwork, not recorded
video. All motion is periodic over an eight-second loop. The app must make
motion opt-in, retain a poster, and respect reduced-motion and data-saving.
"""
import json
import math
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/media/backgrounds/v1'
W,H,FPS,SECONDS = 1280,720,24,8
COUNT = FPS*SECONDS
SCENES = [
 ('rain-window-motion','Rain Window','cozy','rainy-desk','rain'),
 ('fireplace-motion','Fireplace','cozy','fireplace-evening','fire'),
 ('ocean-motion','Ocean','ocean','quiet-coast','water'),
 ('snowfall-motion','Snowfall','mountains','snowbound-cabin','snow'),
 ('forest-light-motion','Forest Light','nature','misty-pines','light'),
 ('space-drift-motion','Space Drift','space','violet-nebula','stars'),
]

def render_scene(asset_id,title,category,source_id,effect):
    base_img = ImageOps.fit(Image.open(OUT/f'{source_id}.webp').convert('RGB'),(W,H),method=Image.Resampling.LANCZOS)
    base = np.array(base_img).astype(np.float32)
    yy,xx = np.mgrid[0:H,0:W]
    rng = np.random.default_rng(42)
    particles = rng.random((140,5))
    path = OUT/f'{asset_id}.mp4'
    cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(path)]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
    first_frame=None
    for index in range(COUNT):
        phase=2*math.pi*index/COUNT
        frame=base.copy()
        if effect=='fire':
            # Warm local light, not whole-scene pulsing. Fire position is found
            # from the artwork's warm highlights within the lower half.
            warmth=np.clip((base[:,:,0]-base[:,:,2]-22)/110,0,1)
            warmth*=np.clip((yy/H-.25)*2,0,1)
            flicker=.045*math.sin(phase*7)+.022*math.sin(phase*11+.7)
            frame+=warmth[:,:,None]*flicker*np.array([180,88,28])
        elif effect=='water':
            # A restrained, periodic refraction over the foreground sea.
            strength=np.clip((yy/H-.35),0,1)
            delta=(np.sin(yy*.055+phase*2)+.35*np.sin(xx*.012+phase))*2.2*strength
            source_x=np.clip((xx+delta).astype(int),0,W-1)
            frame=base[yy,source_x].copy()
        elif effect=='light':
            # Slow light rays pass through trees; landscape geometry is still.
            ray=np.exp(-((xx/W-(.18+.035*math.sin(phase))-(yy/H)*.23)/.14)**2)
            light=ray*(.018+.012*math.sin(phase))
            frame+=light[:,:,None]*np.array([245,224,173])
        overlay=Image.new('RGBA',(W,H),(0,0,0,0))
        draw=ImageDraw.Draw(overlay)
        if effect in ('rain','snow','stars'):
            for px,py,depth,speed,offset in particles:
                if effect=='rain':
                    x=int((px*W+24*math.sin(phase+offset*6.28))%W)
                    y=int((py*H+index/COUNT*H*2)%H)
                    length=int(12+depth*27)
                    draw.line((x,y,x-3,y+length),fill=(190,214,235,int(20+depth*45)),width=1)
                elif effect=='snow':
                    progress=(index/COUNT+offset)%1
                    x=int((px*W+8*math.sin(phase+offset*6.28))%W)
                    y=int((py*H+75*progress)%H)
                    radius=1+depth*1.7
                    alpha=int((55+depth*80)*math.sin(math.pi*progress)**2)
                    draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(241,245,255,alpha))
                else:
                    # Fine foreground dust/stars move laterally in a slow loop.
                    progress=(index/COUNT+offset)%1
                    x=int((px*W+25*progress)%W)
                    y=int(py*H)
                    radius=.5+depth*.8
                    alpha=int(math.sin(math.pi*progress)**2*(30+depth*50))
                    draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(215,229,255,alpha))
        if effect in ('rain','snow'):
            overlay=overlay.filter(ImageFilter.GaussianBlur(.3 if effect=='rain' else .55))
        image=Image.fromarray(np.clip(frame,0,255).astype(np.uint8)).convert('RGBA')
        image=Image.alpha_composite(image,overlay).convert('RGB')
        if first_frame is None: first_frame=image.copy()
        process.stdin.write(np.asarray(image).tobytes())
    process.stdin.close()
    if process.wait()!=0: raise RuntimeError(f'Video encoding failed: {asset_id}')
    first_frame.save(OUT/f'{asset_id}-poster.webp','WEBP',quality=86,method=6)
    thumbnail=first_frame.copy()
    thumbnail.thumbnail((400,225),Image.Resampling.LANCZOS)
    thumbnail.save(OUT/f'{asset_id}-thumb.webp','WEBP',quality=78,method=6)
    print(f'Rendered {asset_id}: {path.stat().st_size/1024/1024:.2f} MiB',flush=True)
    return {'id':asset_id,'title':title,'category':category,'kind':'video','src':f'/media/backgrounds/v1/{asset_id}.mp4',
        'poster':f'/media/backgrounds/v1/{asset_id}-poster.webp','thumbnail':f'/media/backgrounds/v1/{asset_id}-thumb.webp',
        'width':W,'height':H,'durationSeconds':SECONDS,'bytes':path.stat().st_size,'silent':True,
        'license':'Original AI-generated artwork and original procedural animation; project use',
        'creator':'FlowTask / OpenAI image generation and original procedural motion',
        'sourceUrl':None,'verifiedAt':'2026-10-16','provenance':'Original generated still with original procedural atmospheric motion; not live-action footage.',
        'sourceAssetId':source_id,'motionTechnique':effect}

if __name__=='__main__':
    catalog_path=OUT.parent/'catalog.json'
    catalog=[x for x in json.loads(catalog_path.read_text(encoding='utf-8')) if x['kind']!='video']
    for scene in SCENES:
        catalog.append(render_scene(*scene))
    catalog_path.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
