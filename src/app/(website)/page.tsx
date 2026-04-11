import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import appExplorerLogo from "@/assets/app-explorer.svg";
import { routeMetrics } from "@/utils/metrics";

export const metadata: Metadata = {
  title: "Public Preview",
};

export default function Home() {
  routeMetrics.onRouteLoaded("/");
  const contactFormUrl = "https://forms.gle/y7XqNbyrsps943sb7";
  const boardUrl =
    "https://miro.com/app/board/uXjVJpT6jCA=/?moveToWidget=3458764665695719632&cot=14";

  return (
    <div className="min-h-screen bg-surface-1 text-on-surface-1 antialiased">
      <div className="min-h-screen">
        <header className="border-b border-borders bg-surface-1/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={appExplorerLogo}
                alt="AppExplorer logo"
                className="h-10 w-10 rounded-full border border-borders bg-surface-1 object-contain"
              />
              <div className="hidden h-10 w-10 place-items-center rounded-full border border-borders bg-surface-1 text-sm font-semibold text-on-surface-1-quiet">
                AE
              </div>
              <span className="text-lg font-semibold tracking-tight">
                AppExplorer
              </span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-on-surface-1-quiet md:flex">
              <a
                href="#how-it-works"
                className="transition hover:text-on-surface-1"
              >
                How it works
              </a>
              <a href="#preview" className="transition hover:text-on-surface-1">
                Preview
              </a>
              <a href="#updates" className="transition hover:text-on-surface-1">
                Updates
              </a>
            </nav>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-8 lg:pb-24 lg:pt-16">
            <div className="twgrid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sun bg-sun-muted px-4 py-2 text-sm font-medium text-on-sun-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-sun"></span>
                  Public preview — self-serve onboarding is not open yet
                </div>

                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-on-surface-1 sm:text-5xl lg:text-6xl">
                  Understand your system through diagrams linked to real code.
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-on-surface-1-strong">
                  AppExplorer helps developers build architecture diagrams that
                  stay connected to the code they describe. Explore the demo and
                  public board while install flow and billing are finalized.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/demo"
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary-hover"
                  >
                    Open interactive demo
                  </Link>
                  <Link
                    href={boardUrl}
                    className="inline-flex items-center justify-center rounded-xl border border-borders bg-surface-1 px-5 py-3 text-sm font-semibold text-on-surface-1 transition hover:border-primary hover:bg-surface-2"
                  >
                    Open architecture board
                  </Link>
                </div>

                <dl className="mt-10 twgrid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-borders bg-surface-2 p-4 shadow-surface-1">
                    <dt className="text-sm font-medium text-on-surface-2-quiet">
                      What is live now
                    </dt>
                    <dd className="mt-2 text-base font-semibold text-on-surface-2">
                      Demo + public board
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-borders bg-surface-2 p-4 shadow-surface-1">
                    <dt className="text-sm font-medium text-on-surface-2-quiet">
                      Current status
                    </dt>
                    <dd className="mt-2 text-base font-semibold text-on-surface-2">
                      Public preview
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-borders bg-surface-2 p-4 shadow-surface-1">
                    <dt className="text-sm font-medium text-on-surface-2-quiet">
                      Best fit
                    </dt>
                    <dd className="mt-2 text-base font-semibold text-on-surface-2">
                      Developers mapping real systems
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-3xl border border-borders bg-surface-1 p-6 shadow-surface-2 lg:p-8">
                <div className="rounded-2xl border border-borders bg-surface-2 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-2">
                    What you can do today
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-on-surface-2-normal">
                    <li className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-secondary"></span>
                      <span>
                        Try the interactive demo to see cards move between code
                        and diagram.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-secondary"></span>
                      <span>
                        Explore the public Miro board to see the product explain
                        its own codebase.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-secondary"></span>
                      <span>
                        Request updates or early access while the self-serve
                        setup flow is still closed.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-borders bg-surface-2 p-5 shadow-surface-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-2">
                    What AppExplorer is not
                  </p>
                  <p className="mt-3 text-base leading-7 text-on-surface-2-strong">
                    It does not auto-generate architecture diagrams. Developers
                    build the map by attaching meaningful parts of the codebase
                    to a diagram over time.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            id="how-it-works"
            className="border-y border-borders bg-surface-1"
          >
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-1-normal">
                  How it works
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-on-surface-1 sm:text-4xl">
                  Build a diagram by walking the codebase.
                </h2>
                <p className="mt-4 text-lg leading-8 text-on-surface-1-strong">
                  AppExplorer sits between VS Code and Miro. Developers discover
                  meaningful code elements, turn them into cards, and assemble a
                  diagram that remains useful as the implementation evolves.
                </p>
              </div>

              <div className="mt-12 twgrid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-borders bg-surface-2 p-6 shadow-surface-1">
                  <div className="text-2xl font-semibold text-on-surface-2">
                    1
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-on-surface-2">
                    Find code worth mapping
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-on-surface-2-normal">
                    Start in VS Code and move through the system the way
                    developers already work.
                  </p>
                </article>

                <article className="rounded-2xl border border-borders bg-surface-2 p-6 shadow-surface-1">
                  <div className="text-2xl font-semibold text-on-surface-2">
                    2
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-on-surface-2">
                    Create code-linked cards
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-on-surface-2-normal">
                    Turn important code elements into cards that can be placed,
                    connected, and labeled in Miro.
                  </p>
                </article>

                <article className="rounded-2xl border border-borders bg-surface-2 p-6 shadow-surface-1">
                  <div className="text-2xl font-semibold text-on-surface-2">
                    3
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-on-surface-2">
                    Shape the architecture view
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-on-surface-2-normal">
                    Use cards, arrows, and surrounding context to explain how
                    the system fits together.
                  </p>
                </article>

                <article className="rounded-2xl border border-borders bg-surface-2 p-6 shadow-surface-1">
                  <div className="text-2xl font-semibold text-on-surface-2">
                    4
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-on-surface-2">
                    Navigate back to the implementation
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-on-surface-2-normal">
                    Cards keep diagrams explorable by helping developers move
                    back to the relevant code.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section
            id="preview"
            className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20"
          >
            <div className="twgrid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
              <div className="rounded-3xl border border-borders bg-surface-1 p-8 shadow-surface-2">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-1-normal">
                  Preview the product
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-on-surface-1">
                  See the workflow before onboarding opens.
                </h2>
                <p className="mt-4 text-lg leading-8 text-on-surface-1-strong">
                  The demo shows how cards connect code and diagrams. The public
                  board shows the same ideas applied to AppExplorer’s own
                  codebase.
                </p>

                <div className="mt-8 twgrid gap-4 sm:grid-cols-2">
                  <Link
                    href="/demo"
                    className="rounded-2xl border border-secondary bg-surface-2 p-5 transition hover:bg-surface-3"
                  >
                    <div className="text-sm font-semibold text-on-surface-2">
                      Interactive demo
                    </div>
                    <p className="mt-2 text-sm leading-6 text-on-surface-2-normal">
                      Try the guided example in a safe environment.
                    </p>
                  </Link>
                  <Link
                    href={boardUrl}
                    className="rounded-2xl border border-borders bg-surface-2 p-5 transition hover:bg-surface-3"
                  >
                    <div className="text-sm font-semibold text-on-surface-2">
                      Architecture board
                    </div>
                    <p className="mt-2 text-sm leading-6 text-on-surface-2-normal">
                      Explore the large-scale diagram and zoom into the details.
                    </p>
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-borders bg-surface-2 p-8 shadow-surface-2">
                <p className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-semibold uppercase tracking-[0.14em] text-on-primary">
                  Access status
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-on-surface-2">
                  Public preview now. Onboarding later.
                </h2>
                <div className="mt-6 space-y-4 text-sm leading-7 text-on-surface-2-normal">
                  <p>
                    Self-serve install, authorization, and billing are not open
                    yet.
                  </p>
                  <p>
                    This page is here so people can see the direction of the
                    product without pretending it is already ready for general
                    rollout.
                  </p>
                  <p>
                    When onboarding opens, this section can turn into the
                    install flow.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            id="updates"
            className="border-t border-borders bg-surface-1"
          >
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
              <div className="twgrid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-1-normal">
                    Stay in the loop
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-on-surface-1">
                    Get updates or request early access.
                  </h2>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-on-surface-1-strong">
                    Use the contact flow for launch updates, feature progress,
                    or to share how you would use AppExplorer on a real
                    codebase.
                  </p>
                </div>

                <div className="rounded-3xl border border-borders bg-surface-2 p-8 shadow-surface-1">
                  <div className="space-y-4 text-sm leading-7 text-on-surface-2-normal">
                    <p>
                      <span className="font-semibold text-on-surface-2">
                        Good fit:
                      </span>
                      engineering leads, senior developers, or teams trying to
                      explain unfamiliar architecture.
                    </p>
                    <p>
                      <span className="font-semibold text-on-surface-2">
                        Current path:
                      </span>
                      try the demo, explore the board, then reach out if you
                      want updates or early access.
                    </p>
                  </div>
                  <div className="mt-8">
                    <Link
                      href={contactFormUrl}
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary-hover"
                    >
                      Open contact form
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
