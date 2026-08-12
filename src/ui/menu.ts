// Mode-select menu. Two flavours:
//
//   - `renderMenu` — a richer menu for games with real choices: mode (vs Bot
//     / vs Friend), variant (classic / bidding) and board size, rendered as
//     accessible card-style radio groups plus a single "Play" button. This
//     is what Dots & Boxes and Hex use.
//   - `renderMenuSimple` — BTTT's original three-button menu (vs Bot / vs
//     Friend / Leave), kept for games (or screens) that don't need variant
//     or size selection.
//
// Both are pure DOM and resolve a promise; neither owns navigation — the
// caller decides what to do with the resolved choice.

export interface MenuOption {
  id: string;
  label: string;
  desc?: string;
}

export interface MenuOptions {
  root: HTMLElement;
  title: string;
  modes: MenuOption[];
  variants: MenuOption[];
  sizes: MenuOption[];
  defaults?: { mode?: string; variant?: string; size?: string };
}

export interface MenuChoice {
  mode: string;
  variant: string;
  size: string;
}

export function renderMenu(opts: MenuOptions): Promise<MenuChoice> {
  const { root, title, modes, variants, sizes, defaults } = opts;
  root.innerHTML = "";

  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "menu";

    const heading = document.createElement("h2");
    heading.className = "menu__title";
    heading.textContent = title;
    wrap.append(heading);

    const form = document.createElement("form");
    form.className = "menu__form";
    form.append(
      radioGroup("mode", "Mode", modes, defaults?.mode),
      radioGroup("variant", "Variant", variants, defaults?.variant),
      radioGroup("size", "Board size", sizes, defaults?.size),
    );

    const play = document.createElement("button");
    play.type = "submit";
    play.className = "btn btn--primary menu__play";
    play.textContent = "Play";
    form.append(play);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      resolve({
        mode: String(data.get("mode")),
        variant: String(data.get("variant")),
        size: String(data.get("size")),
      });
    });

    wrap.append(form);
    root.append(wrap);
  });
}

function radioGroup(name: string, legendText: string, options: MenuOption[], preferred?: string): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "menu__group";

  const legend = document.createElement("legend");
  legend.className = "menu__legend";
  legend.textContent = legendText;
  fieldset.append(legend);

  const list = document.createElement("div");
  list.className = "menu__options";

  // Fall back to the first option when no explicit default is given, or the
  // given default doesn't match any option id — a radio group must always
  // have exactly one option checked, or `FormData` silently omits the field.
  const defaultId = options.some((o) => o.id === preferred) ? preferred : options[0]?.id;

  for (const opt of options) {
    const id = `${name}-${opt.id}`;
    const label = document.createElement("label");
    label.className = "menu-card";
    label.setAttribute("for", id);

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = id;
    input.value = opt.id;
    input.className = "menu-card__input";
    input.checked = opt.id === defaultId;

    const body = document.createElement("span");
    body.className = "menu-card__body";
    const lbl = document.createElement("span");
    lbl.className = "menu-card__label";
    lbl.textContent = opt.label;
    body.append(lbl);
    if (opt.desc) {
      const desc = document.createElement("span");
      desc.className = "menu-card__desc";
      desc.textContent = opt.desc;
      body.append(desc);
    }

    label.append(input, body);
    list.append(label);
  }

  fieldset.append(list);
  return fieldset;
}

// --- the simple three-button menu (BTTT-style) ----------------------------

export type SimpleMenuChoice = "vs-bot" | "vs-friend" | "leave";

export function renderMenuSimple(
  root: HTMLElement,
  opts: { title?: string; subtitle?: string } = {},
): Promise<SimpleMenuChoice> {
  root.innerHTML = "";
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "menu";

    if (opts.title) {
      const h = document.createElement("h2");
      h.className = "menu__title";
      h.textContent = opts.title;
      wrap.append(h);
    }
    if (opts.subtitle) {
      const p = document.createElement("p");
      p.textContent = opts.subtitle;
      wrap.append(p);
    }

    wrap.append(
      simpleButton("vs Bot", "menu__btn--bot", () => resolve("vs-bot")),
      simpleButton("vs Friend", "menu__btn--friend", () => resolve("vs-friend")),
      simpleButton("Leave", "menu__btn--leave", () => resolve("leave")),
    );

    root.append(wrap);
  });
}

function simpleButton(text: string, modifier: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.className = `menu__btn ${modifier}`;
  b.addEventListener("click", onClick);
  return b;
}
