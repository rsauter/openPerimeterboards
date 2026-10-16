# fonts/

Optional TrueType / OpenType files (`.ttf`, `.otf`) placed here are embedded into print PDFs.
The server also searches the operating system font folders and `FONTS_DIR`.

Only add fonts whose license allows embedding and redistribution (this repository is public).
File names should match the lookup table in `server/fonts.js` (e.g. `arial.ttf`, `arialbd.ttf`),
or extend that table for your own font family.
