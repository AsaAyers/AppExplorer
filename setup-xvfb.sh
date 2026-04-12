
export DISPLAY=:99
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_DISABLE_GPU=1
XVFB_VIDEO_RESOLUTION="1920x1024"

# export HEADLESS=0

if [ "$HEADLESS" -eq 0 ]; then
	XVFB_VIDEO_RESOLUTION="3440x1440"
fi

# Internal variable to store ffmpeg PID
export XVFB_FFMPEG_PID=""

# Usage: recordVideo output.mp4
recordVideo() {
	local output_file="$1"
	if [ -z "$output_file" ]; then
		echo "Usage: recordVideo <output_file>"
		return 1
	fi

	echo "Recording video to $output_file"
  nohup ffmpeg -video_size "$XVFB_VIDEO_RESOLUTION" -framerate 25 -f x11grab -i $DISPLAY "$output_file" > ffmpeg.log 2>&1 &
	XVFB_FFMPEG_PID=$!
	export XVFB_FFMPEG_PID
	echo "Recording video to $output_file (PID $XVFB_FFMPEG_PID)"
}

# Usage: stopVideo
stopVideo() {
	if [ -z "$XVFB_FFMPEG_PID" ]; then
		echo "No ffmpeg recording process found."
		return 1
	fi
	kill "$XVFB_FFMPEG_PID" 2>/dev/null
	wait "$XVFB_FFMPEG_PID" 2>/dev/null
	echo "Stopped video recording (PID $XVFB_FFMPEG_PID)"
	unset XVFB_FFMPEG_PID
}

Xvfb $DISPLAY -screen 0 "${XVFB_VIDEO_RESOLUTION}x24" > /dev/null 2>&1 &

if [ "$HEADLESS" -eq 0 ]; then
	if which -s dwm; then
		sleep 1
		dwm >/tmp/dwm.log 2>&1 &
	fi
fi


if which -s x11vnc; then
# -viewonly 
	x11vnc -display :99 -localhost -forever -nopw -shared >/tmp/x11nvc.log 2>&1 &
fi

recordTests() {
  mkdir -p videos
  rm videos/vscode.mp4
  recordVideo "videos/vscode.mp4"
  npm test
  stopVideo
}

extractScreenshots() {
  mkdir screenshots || true
  rm screenshots/frame_*.png || true
  ffmpeg -i videos/vscode.mp4 -vf "select='gt(scene,0.003)',showinfo" -vsync vfr screenshots/frame_%03d.png >/dev/null 2>&1
}

viewLive() {
	gvncviewer localhost
}