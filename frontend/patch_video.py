import re

path = "/Users/volt/Documents/docsfull/softs/opensource/papom/project-root/frontend/src/pages/TranscriptViewer.tsx"
with open(path, "r") as f:
    content = f.read()

content = content.replace("const audioRef = useRef<HTMLAudioElement>(null);", "const videoRef = useRef<HTMLVideoElement>(null);")
content = content.replace("audioRef.current", "videoRef.current")
content = content.replace("audioSrc", "mediaSrc")
content = content.replace("setAudioDuration", "setMediaDuration")
content = content.replace("audioDuration", "mediaDuration")
content = content.replace("audioError", "mediaError")
content = content.replace("setAudioError", "setMediaError")

# Replace the separate <audio> tag with nothing, we'll inject <video> into tv2-video-area
audio_block = r"""      {mediaSrc && \(
        <audio ref={videoRef} src={mediaSrc} preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={\(\) => { const a = videoRef\.current; if \(a\) setMediaDuration\(a\.duration\); }}
          onPlay={\(\) => setIsPlaying\(true\)} onPause={\(\) => setIsPlaying\(false\)}
          onEnded={\(\) => setIsPlaying\(false\)} onError={\(\) => setMediaError\(true\)}
        />
      \)}

"""
content = re.sub(audio_block, "", content)

# Inject <video> into tv2-video-area
video_tag = """            <div className="tv2-video-area" onClick={() => { const a=videoRef.current; if(!a) return; isPlaying?a.pause():a.play(); }}>
              {mediaSrc && (
                <video ref={videoRef} src={mediaSrc} preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => { const a = videoRef.current; if (a) setMediaDuration(a.duration); }}
                  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)} onError={() => setMediaError(true)}
                />
              )}"""

content = content.replace("""            <div className="tv2-video-area" onClick={() => { const a=videoRef.current; if(!a) return; isPlaying?a.pause():a.play(); }}>""", video_tag)

with open(path, "w") as f:
    f.write(content)
