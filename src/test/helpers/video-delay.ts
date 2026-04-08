import { delay } from "./test-utils";

export const videoDelay = async () => {
  if (isRecordingVideo) {
    await delay(500);
  }
};
export const isRecordingVideo = !!process.env.XVFB_FFMPEG_PID;
