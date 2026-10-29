"""Reproducible local video assembly from browser frames and offline narration.

Only project demo screenshots are consumed; no desktop or account UI is captured.
Run prepare, then generate_demo_voice.ps1, then assemble after capture finishes.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[4]
SUBMISSION = Path(__file__).resolve().parent
WORK = ROOT / 'backend/.private/video-work'
FFMPEG = Path.home() / 'AppData/Local/ffmpeg/ffmpeg-win32-x64.exe'
FFPROBE = FFMPEG.with_name('ffprobe.exe')
OUTPUT = SUBMISSION / '作品演示-充储场站证据诊断助手.mp4'
TOTAL = 265.0
# Voice starts follow the actual autoplay timing, including the 15-second title.
SLOTS = [(1, 22), (24, 46), (47, 72), (74, 107),
         (109, 142), (144, 177), (179, 212), (215, 262)]


def command(args):
    result = subprocess.run([str(x) for x in args], cwd=WORK, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
    (WORK / 'last-ffmpeg.log').write_text(result.stderr, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result.stdout


def probe(path):
    return json.loads(command([FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]))


def prepare():
    WORK.mkdir(parents=True, exist_ok=True)
    scenes = []
    for line in (SUBMISSION / 'MP4-demo-storyboard.md').read_text(encoding='utf-8').splitlines():
        columns = [s.strip() for s in line.split('|')]
        if len(columns) > 6 and columns[1].isdigit():
            index = int(columns[1])
            start, end = SLOTS[index - 1]
            scenes.append({'id': index, 'start': start, 'end': end,
                           'narration': columns[5], 'source_time': columns[2]})
    assert len(scenes) == 8
    plan = {'duration': TOTAL, 'intro_duration': 15, 'capture_duration': 250,
            'voice': 'Microsoft Huihui Desktop', 'narration_source': 'MP4-demo-storyboard.md',
            'scenes': scenes}
    (WORK / 'voice-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
    shutil.copyfile('C:/Windows/Fonts/msyh.ttc', WORK / 'msyh.ttc')
    for name, text in (
        ('title-main.txt', '2026 云桥杯 · 充储场站证据诊断助手'),
        ('title-sub.txt', '证据不足不妄断 · 主动只读补证 · 无法定论转人工'),
        ('title-data.txt', 'INDUSTRY_DEMO_FIXTURE（演示）· 非真实场站遥测'),
    ):
        (WORK / name).write_text(text, encoding='utf-8')
    print(json.dumps({'prepared_scenes': len(scenes), 'work': str(WORK)}))


def ass_time(seconds):
    cs = round(seconds * 100)
    return f'{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}'


def subtitles(plan, voice_times):
    header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,30,&H00FFFFFF,&H00FFFFFF,&H00101D16,&H900C160F,0,0,0,0,100,100,0,0,3,1,0,2,170,170,36,1
Style: Origin,Microsoft YaHei,22,&H00FFFFFF,&H00FFFFFF,&H00101D16,&H900C160F,0,0,0,0,100,100,0,0,3,1,0,9,30,30,18,1
Style: Note,Microsoft YaHei,24,&H00FFFFFF,&H00FFFFFF,&H00101D16,&H900C160F,0,0,0,0,100,100,0,0,3,1,0,8,50,50,62,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    lines = [header, f'Dialogue: 0,0:00:15.00,{ass_time(TOTAL)},Origin,,0,0,0,,演示回放 · INDUSTRY_DEMO_FIXTURE（演示）· 非现场遥测\n']
    lines.append('Dialogue: 0,0:00:47.00,0:01:13.00,Note,,0,0,0,,仅有两个端点：可确认同窗下降，无法确认精确同步\n')
    lines.append('Dialogue: 1,0:03:35.00,0:04:23.00,Default,,0,0,0,,{\\an5\\pos(960,740)\\fs25}Agent 入口：https://www.wanzhi.com/studio/agent/d86bc562cb9b450b\n')
    for scene, timing in zip(plan['scenes'], voice_times):
        # Short clauses keep the source narration readable without covering cards.
        import re
        clauses = [x for x in re.split(r'(?<=[。！？；，：])', scene['narration']) if x]
        chunks, current = [], ''
        for clause in clauses:
            if len(current + clause) > 42 and current:
                chunks.append(current); current = ''
            current += clause
        if current:
            chunks.append(current)
        count = sum(len(x) for x in chunks)
        position = float(scene['start'])
        for chunk in chunks:
            duration = timing['duration'] * len(chunk) / count
            lines.append(f'Dialogue: 1,{ass_time(position)},{ass_time(position + duration)},Default,,0,0,0,,{chunk}\n')
            position += duration
    (WORK / 'demo-subtitles.ass').write_text(''.join(lines), encoding='utf-8-sig')


def assemble():
    plan = json.loads((WORK / 'voice-plan.json').read_text(encoding='utf-8'))
    capture = json.loads((WORK / 'capture.json').read_text(encoding='utf-8'))
    assert capture['done'] and not capture['error']
    captured_frames = capture['frames']
    assert captured_frames[0]['t'] < 1 and captured_frames[-1]['t'] > 248
    # Browser reload can restore the prior scroll position. Use the verified
    # browser hero preflight for the first eight seconds, then the continuous take.
    frames = [f for f in captured_frames if f['t'] >= 8]
    concat = ['ffconcat version 1.0\n', "file 'browser-preflight.jpg'\n",
              f"duration {frames[0]['t']:.6f}\n"]
    for i, frame in enumerate(frames):
        end = frames[i + 1]['t'] if i + 1 < len(frames) else 250
        concat += [f"file 'frames/{frame['file']}'\n", f"duration {end-frame['t']:.6f}\n"]
    concat.append(f"file 'frames/{frames[-1]['file']}'\n")
    (WORK / 'frames.ffconcat').write_text(''.join(concat), encoding='utf-8')
    voice_times = []
    rate = 48000
    mixed = bytearray(round(TOTAL * rate) * 2)
    for scene in plan['scenes']:
        source = WORK / 'voices' / f"voice-{scene['id']:02d}.wav"
        duration = float(probe(source)['format']['duration'])
        # Preserve natural speech where possible, only accelerate when a slot needs it.
        speed = max(1.0, duration / (scene['end'] - scene['start'] - 0.8))
        aligned = WORK / f"aligned-{scene['id']:02d}.wav"
        command([FFMPEG, '-y', '-i', source, '-af', f'atempo={speed:.8f}',
                 '-ar', rate, '-ac', 1, '-c:a', 'pcm_s16le', aligned])
        with wave.open(str(aligned), 'rb') as handle:
            data = handle.readframes(handle.getnframes())
        offset = round(scene['start'] * rate) * 2
        mixed[offset:offset+len(data)] = data
        voice_times.append({'scene': scene['id'], 'start': scene['start'],
                            'duration': len(data) / 2 / rate, 'speed': speed})
    narration = WORK / 'narration-aligned.wav'
    with wave.open(str(narration), 'wb') as handle:
        handle.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        handle.writeframes(mixed)
    subtitles(plan, voice_times)
    filters = (
        "[0:v]drawtext=fontfile=msyh.ttc:textfile=title-main.txt:fontsize=48:fontcolor=white:x=(w-tw)/2:y=420,"
        "drawtext=fontfile=msyh.ttc:textfile=title-sub.txt:fontsize=31:fontcolor=0xC4D9BB:x=(w-tw)/2:y=520,"
        "drawtext=fontfile=msyh.ttc:textfile=title-data.txt:fontsize=23:fontcolor=0xA0AAA1:x=(w-tw)/2:y=640,"
        "fade=t=in:st=0:d=1,fade=t=out:st=14:d=1,setsar=1[intro];"
        "[1:v]fps=24,scale=1920:1080,setsar=1,trim=duration=250,setpts=PTS-STARTPTS[replay];"
        "[intro][replay]concat=n=2:v=1:a=0,ass=demo-subtitles.ass:fontsdir=.,fade=t=out:st=263.5:d=1.5[v];"
        "[2:a]loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=duration=265[a]"
    )
    (WORK / 'video-filter.txt').write_text(filters, encoding='utf-8')
    command([FFMPEG, '-hide_banner', '-y', '-f', 'lavfi', '-i',
             'color=c=black:s=1920x1080:r=24:d=15', '-f', 'concat', '-safe', 0,
             '-i', 'frames.ffconcat', '-i', narration, '-filter_complex_script',
             'video-filter.txt', '-map', '[v]', '-map', '[a]', '-t', TOTAL,
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', 20, '-pix_fmt', 'yuv420p',
             '-r', 24, '-threads', 8, '-progress', 'render-progress.txt',
             '-c:a', 'aac', '-b:a', '160k', '-ar', 48000,
             '-ac', 2, '-movflags', '+faststart', OUTPUT])
    info = probe(OUTPUT)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    assert video['codec_name'] == 'h264' and (video['width'], video['height']) == (1920,1080)
    assert audio['codec_name'] == 'aac' and video['pix_fmt'] == 'yuv420p'
    assert float(info['format']['duration']) <= 300 and OUTPUT.stat().st_size <= 200_000_000
    report = {'capture_method': 'CONTINUOUS_BROWSER_VIEWPORT_CAPTURE_NOT_DESKTOP',
              'capture_frames': len(captured_frames), 'capture_last_frame_seconds': frames[-1]['t'],
              'capture_average_fps': len(captured_frames) / 250, 'encoding_fps': 24,
              'hero_source': 'Verified browser-preflight.jpg held for first eight replay seconds',
              'voice_source': 'Offline Microsoft Huihui Desktop; eight storyboard paragraphs',
              'narration_exact_storyboard_text': True, 'voice_timing': voice_times,
              'technical_requirements_passed': True, 'probe': info,
              'sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
              'visual_review': 'PENDING', 'full_playback_review': 'PENDING'}
    (SUBMISSION / 'video-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'output':str(OUTPUT),'duration':info['format']['duration'],'bytes':OUTPUT.stat().st_size}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'assemble'])
    args = parser.parse_args()
    prepare() if args.action == 'prepare' else assemble()
