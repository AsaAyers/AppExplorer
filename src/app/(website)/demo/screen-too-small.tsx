const demoVideoUrl = new URL(
  "../../../demo-test.webm",
  import.meta.url,
).toString();

export function ScreenTooSmall() {
  return (
    <div className="visible lg:hidden col-span-12 bg-secondary text-secondary-foreground ">
      <div className="h-screen flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl  font-bold">Screen Too Small</h1>
        <p className="text-center max-w-md">
          This demo is best experienced on a larger screen. It needs a panel to
          represent VSCode, the AppExplorer sidebar inside Miro, and a simple
          board.
        </p>
        <video
          src={demoVideoUrl}
          controls
          autoPlay
          loop
          muted
          className="rounded-lg shadow-lg"
          width={600}
          height={400}
        />
      </div>
    </div>
  );
}
