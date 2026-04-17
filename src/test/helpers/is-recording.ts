export const isRecording = !!process.env.XVFB_FFMPEG_PID;
export const isHeadless = (process.env.HEADLESS || "true") === "true";
