
export DISPLAY=:99
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_DISABLE_GPU=1
XVFB_VIDEO_RESOLUTION="1920x1024"
XVFB_BACKGROUND_BASE_RESOLUTION="1920x1024"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_EXPLORER_LOGO="${SCRIPT_DIR}/public/AppExplorer.svg"
XVFB_BACKGROUND_IMAGE="${SCRIPT_DIR}/videos/xvfb-background-1920x1024.png"

# export HEADLESS=0

if [ "${HEADLESS:-1}" -eq 0 ]; then
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

setupXvfbBackground() {
	if ! command -v ffmpeg >/dev/null 2>&1; then
		echo "Skipping Xvfb logo background (requires ffmpeg)."
		return 0
	fi

	if ! command -v xwallpaper >/dev/null 2>&1; then
		echo "Skipping Xvfb logo background (requires xwallpaper)."
		return 0
	fi

	if [ ! -f "$APP_EXPLORER_LOGO" ]; then
		echo "Skipping Xvfb logo background (logo not found: $APP_EXPLORER_LOGO)."
		return 0
	fi

	local width="${XVFB_BACKGROUND_BASE_RESOLUTION%x*}"
	local height="${XVFB_BACKGROUND_BASE_RESOLUTION#*x}"
	local logo_height=$((height * 8 / 10))

	# Build once and reuse on subsequent runs.
	if [ ! -f "$XVFB_BACKGROUND_IMAGE" ]; then
		mkdir -p "$(dirname "$XVFB_BACKGROUND_IMAGE")"
		ffmpeg -hide_banner -loglevel error -y \
			-f lavfi -i "color=c=0xFFFFFF:s=${width}x${height}" \
			-height "$logo_height" -keep_ar 1 -i "$APP_EXPLORER_LOGO" \
			-filter_complex "[0:v][1:v]overlay=(W-w)/2:(H-h)/2:format=auto" \
			-frames:v 1 "$XVFB_BACKGROUND_IMAGE" || {
			echo "Failed to build Xvfb logo background image."
			return 0
		}
	fi

	# Wait briefly for Xvfb to accept root-window updates before applying wallpaper.
	for _ in 1 2 3 4 5; do
		if xwallpaper --no-randr --maximize "$XVFB_BACKGROUND_IMAGE" >/dev/null 2>&1; then
			return 0
		fi
		sleep 0.2
	done

	echo "Failed to apply Xvfb logo background."
}

Xvfb $DISPLAY -screen 0 "${XVFB_VIDEO_RESOLUTION}x24" > /dev/null 2>&1 &
setupXvfbBackground

if [ "${HEADLESS:-1}" -eq 0 ]; then
	if command -v dwm >/dev/null 2>&1; then
		sleep 1
		dwm >/tmp/dwm.log 2>&1 &
	fi
fi


if command -v x11vnc >/dev/null 2>&1; then
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