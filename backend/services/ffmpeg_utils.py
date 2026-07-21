import os
import subprocess
import tempfile
import uuid
import logging

logger = logging.getLogger(__name__)

def create_highlight_reel(segments_data: list[dict], output_path: str):
    """
    Given a list of segment data dicts: {"filepath": str, "start": float, "end": float},
    extracts those clips and concatenates them into a single video at output_path.
    """
    if not segments_data:
        raise ValueError("No segments provided for highlight reel.")

    temp_dir = tempfile.mkdtemp(prefix="reel_export_")
    clip_paths = []

    try:
        # 1. Extract and re-encode each segment
        for i, seg in enumerate(segments_data):
            input_file = seg["filepath"]
            start = seg["start"]
            end = seg["end"]
            
            if not os.path.exists(input_file):
                logger.error(f"Input file not found: {input_file}")
                continue
                
            clip_path = os.path.join(temp_dir, f"clip_{i}.mp4")
            clip_paths.append(clip_path)
            
            # Using -ss before -i is faster, but we need exact duration. 
            # Re-encoding video and audio to a standard format to ensure smooth concatenation
            duration = end - start
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(start),
                "-t", str(duration),
                "-i", input_file,
                "-c:v", "libx264", # standard H.264 video
                "-c:a", "aac",     # standard AAC audio
                "-vsync", "1",
                "-async", "1",
                "-strict", "experimental",
                clip_path
            ]
            logger.info(f"Extracting clip {i}: {' '.join(cmd)}")
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
        if not clip_paths:
            raise RuntimeError("Failed to extract any clips.")

        # 2. Create the concat.txt file
        concat_file = os.path.join(temp_dir, "concat.txt")
        with open(concat_file, "w") as f:
            for cp in clip_paths:
                f.write(f"file '{cp}'\n")
                
        # 3. Concatenate all clips
        concat_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            output_path
        ]
        logger.info(f"Concatenating clips: {' '.join(concat_cmd)}")
        subprocess.run(concat_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
    finally:
        # 4. Clean up temp directory
        for cp in clip_paths:
            if os.path.exists(cp):
                os.remove(cp)
        concat_txt = os.path.join(temp_dir, "concat.txt")
        if os.path.exists(concat_txt):
            os.remove(concat_txt)
        os.rmdir(temp_dir)
