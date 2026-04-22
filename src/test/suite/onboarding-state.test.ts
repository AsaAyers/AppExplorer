import * as assert from "node:assert";

import {
  getWalkthroughSelector,
  MemoryOnboardingPersistence,
  OnboardingState,
} from "@/onboarding-state";

suite("OnboardingState", () => {
  test("shows welcome on first activation until the current version is recorded", async () => {
    const state = new OnboardingState(
      new MemoryOnboardingPersistence(),
      "1.2.3",
    );
    await state.initialize();

    assert.equal(state.shouldShowWelcomeOnActivate(), true);

    await state.markWelcomeShown();

    assert.equal(state.shouldShowWelcomeOnActivate(), false);
  });

  test("does not reopen welcome after the first session completes", async () => {
    const state = new OnboardingState(
      new MemoryOnboardingPersistence(),
      "1.2.3",
    );
    await state.initialize();

    await state.completeFirstSession();

    assert.equal(state.hasCompletedFirstSession(), true);
    assert.equal(state.shouldShowWelcomeOnActivate(), false);
  });

  test("builds the walkthrough selector from the extension id", () => {
    assert.equal(
      getWalkthroughSelector("AsaAyers.app-explorer"),
      "AsaAyers.app-explorer#appExplorerGettingStarted",
    );
  });
});
