// Colour palette templates. The actual colours live in index.css as
// [data-palette="<id>"] token blocks (dark + light); this list drives the picker.
export const PALETTES = [
  { id: 'mint', name: 'Glacier Mint', description: 'The original — mint and ice blue on deep navy' },
  { id: 'aurora', name: 'Aurora', description: 'Violet and cyan on midnight indigo' },
  { id: 'ember', name: 'Ember', description: 'Coral and amber on warm charcoal' },
  { id: 'evergreen', name: 'Evergreen', description: 'Leaf green and lime on forest black' },
  { id: 'rose', name: 'Rosé', description: 'Rose and peach on plum' },
  { id: 'graphite', name: 'Graphite', description: 'Monochrome with a single gold accent' }
];

export const DEFAULT_PALETTE = 'mint';

export const paletteExists = (id) => PALETTES.some((palette) => palette.id === id);
