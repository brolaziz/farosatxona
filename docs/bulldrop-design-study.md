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

- Keep the user-requested charcoal/white palette with warm brown accents, and retain the six original Farosatxona artworks.
- Give the catalogue its full available width, matching the image-first card proportions. Use three columns for the three-product collections, and two columns on phones.
- Put the selected artwork and purchase details in a separate full-width panel below the catalogue. The price and grams remain fixed: 1 Star = 1 gram, credited to the chosen group.
- Use horizontal desktop navigation for the user app; keep the admin sidebar and the existing phone navigation.
- Preserve reduced-motion support, hidden scrollbar tracks and keyboard-accessible group selection.
