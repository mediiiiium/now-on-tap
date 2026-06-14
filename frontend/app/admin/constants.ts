export type BrewerySample = { beer_name: string; instagram_username: string };

export type BeerRow = {
  id: number;
  name: string;
  name_ja: string | null;
  name_en: string | null;
  brewery: string | null;
  style: string | null;
  abv: string | null;
  notes: string | null;
  instagram_username: string;
  posted_at: string;
};

export const STYLE_CATEGORIES = ['Hoppy', 'Lager', 'Dark', 'Belgian', 'Wheat', 'Sour', 'Malt', 'Strong', 'Other'];
