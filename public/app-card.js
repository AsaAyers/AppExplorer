import { html } from "https://unpkg.com/lit-html";
/* global miro */
/**
 * @typedef {import('@mirohq/websdk-types').Miro} Miro
 */

/**
 *
 * @typedef {import('../src/EventTypes').CardData} CardData
 * @param {CardData} card
 * @returns
 */
export const appCard = (card) => {
  const id = new URL(card.miroLink ?? "/", location).searchParams.get(
    "moveToWidget"
  );

  return html`
    <div
      class="app-card"
      data-card-id="${id}"
      @click=${async () => {
        if (id) {
          const card = await miro.board.get({ type: "card", id });
          await miro.board.viewport.zoomTo(card);
        }
      }}
    >
      <h1 class="app-card--title">${card.title}</h1>
      <h1 class="app-card--description p-medium">${card.description}</h1>
      <div class="app-card--body">
        <div class="app-card--tags">
          ${card.tags?.map((tag) => html` <span class="tag">${tag}</span> `)}
        </div>

        <svg
          class="app-card--app-logo"
          width="24"
          height="24"
          viewBox="0 0 12.7 12.7"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath clipPathUnits="userSpaceOnUse" id="c">
              <circle
                style="fill:#86ca4f;fill-opacity:1;stroke:none;stroke-width:.264583;stroke-opacity:1"
                cx="6.799"
                cy="6.343"
                r="6.151"
              />
            </clipPath>
            <clipPath clipPathUnits="userSpaceOnUse" id="b">
              <circle
                style="fill:#86ca4f;fill-opacity:1;stroke:none;stroke-width:.264583;stroke-opacity:1"
                cx="6.074"
                cy="6.343"
                r="6.151"
              />
            </clipPath>
            <clipPath clipPathUnits="userSpaceOnUse" id="a">
              <circle
                style="fill:#86ca4f;fill-opacity:1;stroke:none;stroke-width:.264583;stroke-opacity:1"
                cx="6.343"
                cy="6.343"
                r="6.151"
              />
            </clipPath>
          </defs>
          <path
            style="display:inline;fill:#f4ff00;fill-opacity:1;stroke-width:.442954"
            d="M4.205 6.328a2.138 2.138 0 0 1 1.073-1.854 2.138 2.138 0 0 1 2.143.008 2.138 2.138 0 0 1 1.06 1.863"
          />
          <path
            style="display:inline;opacity:1;fill:#c3000f;fill-opacity:1;stroke:none;stroke-width:.276587px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1"
            d="m.725 4.06.616.52 1.905-2.048 1.042 1.092.616-.662L8.486 6.49l-8.28-.158.148-1.56z"
          />
          <path
            style="display:inline;fill:#aea578;fill-opacity:1;stroke:none;stroke-width:.264583;stroke-opacity:1"
            d="M12.434 6.283a6.15 6.15 0 0 1-6.143 6.151A6.15 6.15 0 0 1 .132 6.298"
          />
          <path
            style="display:inline;fill:#86ca4f;fill-opacity:1;stroke:#000;stroke-width:.264583;stroke-opacity:1"
            d="M8.467 12.074 6.73 8.544c-.459-1.084-.372-1.902.962-2.11l4.95.015c.388 2.943-.566 5.195-4.175 5.625z"
            clip-path="url(#b)"
            transform="translate(.269)"
          />
          <path
            style="display:inline;fill:#4ec2ea;fill-opacity:1;stroke:#000;stroke-width:.264583;stroke-opacity:1"
            d="m4.237 12.074 1.736-3.53c.459-1.084.372-1.902-.961-2.11H.018c-.388 2.944.61 5.21 4.219 5.64z"
            clip-path="url(#c)"
            transform="translate(-.457)"
          />
          <circle
            style="display:inline;fill:none;fill-opacity:1;stroke:#000;stroke-width:.264583;stroke-opacity:1"
            cx="6.343"
            cy="6.343"
            r="6.151"
          />
        </svg>
      </div>
    </div>
  `;
};
