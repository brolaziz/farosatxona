# Bulldrop reference study

Reference: https://bulldrop.uz/uz. Studied with the Codex in-app Browser on 2026-10-02, including the catalogue, sapphire case detail, and signed-in personal account. No account identifiers, credentials or transaction data are recorded here.

## Observed design

- A charcoal canvas and slightly raised neutral surfaces; off-white text and restrained interface accents. The colourful product art supplies most of the colour.
- Rounded PP Pangram Sans typography. Farosatxona uses self-hosted Nunito as its rounded font.
- Catalogue cards at the observed desktop viewport measured approximately 224 × 322 px, with square 200 px artwork, 32 px corners and `12px 12px 24px` padding. Their idle fill was almost transparent, `rgba(36,36,40,.15)`.
- A name around 16 px, a compact price badge below, and ample space between category headings and collections. Hover slightly raises the artwork and changes the price badge to off-white with dark text.
- The detail screen centres a large case image above the action area. Title, selection, quantity and payment controls have separate visual roles.
- Desktop navigation runs horizontally. The narrower layout keeps compact branding and account information at the top, with navigation at the bottom.
- The personal account uses quiet rounded tabs, small progress cards and a centred empty state with a clear return-to-catalogue action.

## Farosatxona adaptation

- Keep the user-requested charcoal/white palette with warm brown accents. Replace the old rounded chests with eight original transparent cargo-case renders: sapphire, ruby, emerald, diamond, neuron energy, black hole, nebula and dark matter. Retained source paths and generation prompts are recorded in `case-assets-v2.json`.
- Give the catalogue its full available width and square artwork, with four items in each collection. Use four columns on desktop, three at intermediate widths and two on phones. Names stay centred above compact Stars price badges.
- Open the selected artwork and purchase controls in a focused two-column dialog, stacked on phones. Preserve exact pricing: 1 Star = 1 gram, credited to the chosen group. Group selection, invoice status and custom quantities remain functional.
- Make the user storefront the initial view for every role. Show an illustrated banner carousel with pause/previous/next controls, a personal balance tile, daily activity tile and catalogue. Category filters and saved favourites work locally per user.
- Adapt the reference's split login card to the application's actual Telegram authentication: original illustration, Telegram launch link and retry action.
- Use horizontal desktop navigation for the user app; keep the admin sidebar and the existing phone navigation.
- Preserve reduced-motion support, hidden scrollbar tracks and keyboard-accessible group selection.
