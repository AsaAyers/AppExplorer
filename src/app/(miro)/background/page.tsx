import { BackgroundBoot } from "@/app/(miro)/background/background-boot";

export default function BackgroundPage() {
  return (
    <>
      <BackgroundBoot />

      <div className="container">
        <h1>AppExplorer Miro Extension</h1>

        <div className="content">
          <h2>Getting Started</h2>
          <ol>
            <li>
              <a href="https://miro.com/oauth/authorize/?response_type=code&client_id=3458764531189693223&redirect_uri=%2Fconfirm-app-install%2F">
                Authorize AppExplorer
              </a>
              for your Miro team
            </li>
            <li>Create a new Miro board in your account</li>
            <li>
              Add AppExplorer to the board.
              <div>
                <strong>Tip:</strong> At the moment, the AppExplorer icon only
                shows up on boards that have NOT been authorized. Once you
                authorize it, the icon goes away and it just loads this page in
                the background.
              </div>
            </li>
            <li>
              From VSCode run &quot;AppExplorer: Create Card&quot; command
            </li>
          </ol>
        </div>
        <div className="getting-started">
          <h2>Miro Extension</h2>

          <p>
            When you have a Miro board open, it uses an iframe to load this page
            you&apos;re looking at. Its main purpose is to coordinate
            communication between Miro and the local webserver running in
            VSCode.
          </p>

          <p>
            These instructions stay here so that if you open this page directly
            to verify the host is running, you can also see the next steps to
            get started with the extension.
          </p>
        </div>
      </div>
    </>
  );
}
