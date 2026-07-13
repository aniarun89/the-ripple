import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from './supabaseClient'

/* =============================================================================
   THE RIPPLE — interactive animal-welfare impact explorer
   -----------------------------------------------------------------------------
   PROTOTYPE NOTES
   - All numbers below live in COEFFICIENTS / BASELINES. They are PLACEHOLDER,
     directional figures meant to feel right and demonstrate the mechanic.
   - Replace with real data later: Faunalytics, Our World in Data (animal
     welfare), Animal Charity Evaluators (cost-per-animal-spared).
   - Search "PLACEHOLDER" to find every spot you'll want to swap.
   ============================================================================= */

/* ---- CONSUMPTION DATA ---------------------------------------------------- */

// ===========================================================================
// Region-dependent consumption drives the whole model from the step-1 choice.
// Figures are SOURCED regional representatives (FAO / Our World in Data /
// OECD-FAO Agricultural Outlook / FAOSTAT, ~2021), blended per multi-country
// region and rounded. They are directional averages, not exact national data —
// refine per-country before launch. See REGION_DATA below for the structure.
// ===========================================================================

// Per-animal YIELDS & farm-intensity now vary BY REGION (set in REGION_DATA),
// because a US broiler (~1.8 kg edible) and an Indian one (~1.1 kg), or a
// 10,000 L Holstein vs a 1,500 L indigenous cow, mean very different animal
// counts for the same kg consumed. Constants below are only fixed physics.
const EGG_G = 50;           // one egg ≈ 50 g (FAO shell-weight basis)
const MILK_KG_PER_L = 1.03; // milk density

// ===========================================================================
// SOURCED per-capita consumption (kg/person/year) AND per-animal yields,
// by region. Compiled from FAO / Our World in Data / OECD-FAO Agricultural
// Outlook / FAOSTAT (consumption & meat-type splits), Helgi/FAOSTAT (eggs),
// FAO food-balance (milk), AHDB/FAO (milk yield per cow), CIWF / Int'l Egg
// Commission (eggs per hen, backyard vs commercial share), and FAO/industry
// carcass & dressing figures (edible kg per animal). ~2018–2021 vintage.
//
//   meatKg      : edible/retail kg per year by species
//   eggsKg      : shell-weight kg of eggs per year
//   milkKg      : total dairy as milk-equivalent kg per year
//   yields      : edible kg per slaughtered animal, by species (region-adj.)
//   eggsPerHen  : eggs one laying hen lays per year (commercial vs backyard mix)
//   litresPerCow: litres one dairy cow/buffalo gives per year (breed/intensity)
//
// Regional representatives — blended for multi-country regions, directional.
// ===========================================================================
const REGION_DATA = {
  IN:   { label: "India",              pop: 1_430_000_000, city: 20_000_000, household: 4.4, scaleLabel: "India",
          eggsPerHen: 250, litresPerCow: 1500,
          meatKg: { chicken: 3.5, fish: 7,  pork: 0.3, beef: 0.8, mutton: 0.6 }, eggsKg: 4.1,  milkKg: 80,
          yields: { chicken: 1.1, fish: 0.25, pork: 45, beef: 150, mutton: 12 } },
  USCA: { label: "US / Canada",        pop: 370_000_000, city: 8_500_000, household: 2.5, scaleLabel: "the US & Canada",
          eggsPerHen: 305, litresPerCow: 10000,
          meatKg: { chicken: 50,  fish: 22, pork: 30,  beef: 37,  mutton: 0.5 }, eggsKg: 15.8, milkKg: 255,
          yields: { chicken: 1.8, fish: 0.25, pork: 58, beef: 215, mutton: 16 } },
  EU:   { label: "Europe",             pop: 745_000_000, city: 3_000_000, household: 2.3, scaleLabel: "Europe",
          eggsPerHen: 300, litresPerCow: 7000,
          meatKg: { chicken: 27,  fish: 24, pork: 33,  beef: 14,  mutton: 1.5 }, eggsKg: 16,   milkKg: 235,
          yields: { chicken: 1.5, fish: 0.25, pork: 55, beef: 200, mutton: 15 } },
  SAM:  { label: "South America",      pop: 435_000_000, city: 12_000_000, household: 3.3, scaleLabel: "South America",
          eggsPerHen: 290, litresPerCow: 4000,
          meatKg: { chicken: 45,  fish: 10, pork: 14,  beef: 35,  mutton: 1   }, eggsKg: 12,   milkKg: 130,
          yields: { chicken: 1.6, fish: 0.25, pork: 52, beef: 210, mutton: 14 } },
  MENA: { label: "Arabia / N. Africa", pop: 500_000_000, city: 10_000_000, household: 4.7, scaleLabel: "the region",
          eggsPerHen: 280, litresPerCow: 3000,
          meatKg: { chicken: 25,  fish: 13, pork: 0,   beef: 8,   mutton: 6   }, eggsKg: 8,    milkKg: 90,
          yields: { chicken: 1.4, fish: 0.25, pork: 50, beef: 160, mutton: 14 } },
  CN:   { label: "China",              pop: 1_410_000_000, city: 25_000_000, household: 2.9, scaleLabel: "China",
          eggsPerHen: 295, litresPerCow: 3500,
          meatKg: { chicken: 15,  fish: 39, pork: 30,  beef: 6,   mutton: 4   }, eggsKg: 21.8, milkKg: 35,
          yields: { chicken: 1.4, fish: 0.25, pork: 50, beef: 160, mutton: 13 } },
  JPKR: { label: "Japan / Korea",      pop: 177_000_000, city: 14_000_000, household: 2.2, scaleLabel: "Japan & Korea",
          eggsPerHen: 300, litresPerCow: 7500,
          meatKg: { chicken: 18,  fish: 45, pork: 20,  beef: 9,   mutton: 0.5 }, eggsKg: 19.8, milkKg: 50,
          yields: { chicken: 1.6, fish: 0.25, pork: 55, beef: 200, mutton: 15 } },
  SEA:  { label: "South-East Asia",    pop: 685_000_000, city: 11_000_000, household: 3.9, scaleLabel: "South-East Asia",
          eggsPerHen: 270, litresPerCow: 2500,
          meatKg: { chicken: 16,  fish: 33, pork: 11,  beef: 4,   mutton: 0.7 }, eggsKg: 7,    milkKg: 25,
          yields: { chicken: 1.3, fish: 0.25, pork: 48, beef: 150, mutton: 13 } },
  WORLD:{ label: "Global average",     pop: 8_100_000_000, city: 10_000_000, household: 3.5, scaleLabel: "your country",
          eggsPerHen: 285, litresPerCow: 2500,
          meatKg: { chicken: 17,  fish: 20, pork: 16,  beef: 9,   mutton: 2   }, eggsKg: 10.4, milkKg: 110,
          yields: { chicken: 1.4, fish: 0.25, pork: 50, beef: 180, mutton: 14 } },
};

// Derived: animals consumed per person per YEAR at AVERAGE intensity.
//   meat animals = kg consumed ÷ region's edible kg per animal
//   eggs = hen-years of laying  = (eggs eaten) ÷ (region's eggs per hen)
//   dairy = cow-years of milking = (litres consumed) ÷ (region's litres per cow)
const BASELINES = Object.fromEntries(Object.entries(REGION_DATA).map(([k, r]) => {
  const meat = {};
  ["chicken", "fish", "pork", "beef", "mutton"].forEach((sp) => {
    meat[sp] = r.meatKg[sp] / r.yields[sp];
  });
  const eggsPerYr = (r.eggsKg * 1000) / EGG_G;
  const litresMilkYr = r.milkKg / MILK_KG_PER_L;
  return [k, {
    label: r.label,
    ...meat,
    eggs: eggsPerYr / r.eggsPerHen,         // hen-years of laying
    dairy: litresMilkYr / r.litresPerCow,   // cow-years of milking
    honey: 1, // PLACEHOLDER — bee colony-years, not yet modelled
  }];
}));

// Multiplier applied to baseline + which species this diet implies.
// `excludes` = species this bucket rules out (used to pre-set step 3 sensibly).
const INTENSITY = {
  most_meals:  { label: "Meat with most meals",                 mult: 1.7,  emoji: "🍗", start: 0.12, excludes: [] },
  most_days:   { label: "Meat most days",                       mult: 1.15, emoji: "🥩", start: 0.22, excludes: [] },
  less_meat:   { label: "Eating less meat (2–3 meals/week)",     mult: 0.65, emoji: "🐟", start: 0.42, excludes: [] },
  rare_meat:   { label: "Meat on rare occasion (1–2/month)",     mult: 0.28, emoji: "🥗", start: 0.58, excludes: [] },
  veg_eggs:    { label: "Vegetarian, with eggs",                 mult: 0.0,  emoji: "🥚", start: 0.74, excludes: ["chicken","fish","pork","beef","mutton"] },
  vegetarian:  { label: "Vegetarian (milk / honey)",             mult: 0.0,  emoji: "🧀", start: 0.86, excludes: ["chicken","fish","pork","beef","mutton","eggs"] },
  plant:       { label: "Plant-based",                           mult: 0.0,  emoji: "🌱", start: 0.96, excludes: ["chicken","fish","pork","beef","mutton","eggs","dairy","honey"] },
};

// ---- Region-based defaults (the "median person" starting point) ----------
// Picking a region pre-fills steps 2–4 with what a typical person there does,
// so the user only adjusts what's different about them. All PLACEHOLDER.

// Median eating intensity per region (most_days unless the region skews veg).
const DEFAULT_INTENSITY = {
  IN: "less_meat",   // India skews lower-meat / partly vegetarian on average
  USCA: "most_days", EU: "most_days", SAM: "most_days", MENA: "most_days",
  CN: "most_days", JPKR: "most_days", SEA: "most_days", WORLD: "most_days",
};

// Which species the median person in a region eats: any with a non-trivial
// per-person baseline (after excluding what their default diet rules out).
function defaultSpeciesForRegion(region) {
  const base = BASELINES[region] || BASELINES.WORLD;
  const intensity = DEFAULT_INTENSITY[region] || "most_days";
  const excluded = INTENSITY[intensity]?.excludes ?? [];
  const THRESH = { chicken: 0.5, fish: 0.5, pork: 0.05, beef: 0.02, mutton: 0.02 };
  const out = [];
  SPECIES.forEach((s) => {
    if (excluded.includes(s.key)) return;
    if (s.key === "eggs" || s.key === "dairy") { out.push(s.key); return; } // near-universal
    if (s.key === "honey") return; // niche, off by default
    const thr = THRESH[s.key] ?? 0.05;
    if ((base[s.key] || 0) >= thr) out.push(s.key);
  });
  return out;
}

// Median non-food animal use: leather is near-universal; others opt-in.
function defaultNonfoodForRegion() {
  return ["leather"];
}

// Default moral weights — relative life-value, anchored at 1 hen = 1.
// PLACEHOLDER. This is exactly the contested space; defaults shown as honest,
// adjustable starting points, not claims of truth.
// Default moral weights, initialized on a CAPACITY-TO-FEEL basis using
// Rethink Priorities' Moral Weight Project welfare ranges (median estimates,
// relative to human = 1: pig ~0.52, chicken ~0.33, carp ~0.09, salmon ~0.06).
// Converted to a hen = 1 anchor; cattle & goats mapped to the pig/mammal proxy
// (RP didn't study them). RP stress these are welfare *ranges*, not direct
// life-values — using them as relative weights adds a philosophical step.
// Still fully user-adjustable; these are an honest, sourced starting point.
//   henPerFish : how many FISH equal one hen (1 hen = N fish). Higher = fish matter less.
//   pig/cow/goat : how many HENS equal one of these (1 pig = N hens).
const DEFAULT_WEIGHTS = {
  henPerFish: 5,    // 1 hen = 5 fish  → each fish = 0.2 hens (RP fish ~0.075 ÷ chicken 0.33)
  pig: 2,           // 1 pig = 2 hens  (RP pig 0.52 ÷ chicken 0.33 ≈ 1.6, rounded to 2)
  cow: 2,           // 1 cow = 2 hens  (mammal, mapped to pig proxy)
  goat: 2,          // 1 goat = 2 hens (mammal, mapped to pig proxy)
  honey: 0.001,
};

// Convert the slider-facing weights into per-species hen-equivalent weights
// used by the impact/footprint math. Hen = 1 by definition.
function speciesWeights(w) {
  return {
    chicken: 1,
    fish: w.henPerFish > 0 ? 1 / w.henPerFish : 0,
    pork: w.pig,
    beef: w.cow,
    mutton: w.goat,
    eggs: 1,        // a laying hen is a hen — tied to the anchor
    dairy: w.cow,   // a dairy cow is a cow — follows the cow slider per spec
    honey: w.honey,
  };
}

// How much worse factory conditions are vs. free-range (welfare multiplier).
// Initialized at 4× on the basis of Welfare Footprint Project evidence that
// caged/intensive systems impose far longer durations of disabling & hurtful
// pain than free-range. Genuinely uncertain; user-adjustable (1–100×).
const DEFAULT_WELFARE_GAP = 4;

const SPECIES = [
  { key: "chicken", label: "Chicken", emoji: "🐔", animal: "hens",
    livesText: "never bred into a factory farm", welfareText: "live in better conditions" },
  { key: "fish",    label: "Fish & seafood", emoji: "🐟", animal: "sea animals",
    livesText: "never caught or farmed", welfareText: "spared the worst conditions" },
  { key: "pork",    label: "Pork", emoji: "🐷", animal: "pigs",
    livesText: "never bred into a factory farm", welfareText: "live in better conditions" },
  { key: "beef",    label: "Beef", emoji: "🐄", animal: "cows, bulls or buffaloes",
    livesText: "never raised for slaughter", welfareText: "live in better conditions" },
  { key: "mutton",  label: "Mutton", emoji: "🐐", animal: "goats or sheep",
    livesText: "never raised for slaughter", welfareText: "live in better conditions" },
  { key: "eggs",    label: "Eggs", emoji: "🥚", animal: "hen-years",
    livesText: "of laying-hen life not demanded", welfareText: "of laying freed from cages" },
  { key: "dairy",   label: "Dairy", emoji: "🥛", animal: "cow-years",
    livesText: "of dairy-cow life not demanded", welfareText: "of milking freed from confinement" },
  { key: "honey",   label: "Honey", emoji: "🍯", animal: "bee colonies",
    livesText: "not farmed for honey", welfareText: "managed more gently" },
];

const NONFOOD = [
  { key: "leather", label: "Leather", emoji: "🧥" },
  { key: "wool",    label: "Wool", emoji: "🧶" },
  { key: "silk",    label: "Silk", emoji: "🪡" },
  { key: "cosmetics", label: "Tested cosmetics", emoji: "💄" },
];

const REGIONS = [
  { key: "IN",    label: "India", emoji: "🇮🇳" },
  { key: "USCA",  label: "US / Canada", emoji: "🌎" },
  { key: "EU",    label: "Europe", emoji: "🇪🇺" },
  { key: "SAM",   label: "South America", emoji: "🌴" },
  { key: "MENA",  label: "Arabia / N. Africa", emoji: "🕌" },
  { key: "CN",    label: "China", emoji: "🇨🇳" },
  { key: "JPKR",  label: "Japan / Korea", emoji: "🗾" },
  { key: "SEA",   label: "South-East Asia", emoji: "🌏" },
  { key: "WORLD", label: "Other", emoji: "🌍" },
];

// Action cards. `apply` returns reductions as a fraction of that species' baseline.
// `relevant(ctx)` decides whether the card shows, based on prior steps.
// ctx = { species: string[], nonfood: string[], intensity: string }
const ACTIONS = [
  { key: "no_factory", emoji: "🚫", title: "No factory-farmed meat", blurb: "Eat only higher-welfare / non-caged animals",
    welfareOnly: true, dialLabel: "% of meat switched", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.species.some((s) => ["chicken","fish","pork","beef","mutton"].includes(s)),
    apply: (d) => { const f = d / 100; return { chicken: f, fish: f, pork: f, beef: f, mutton: f }; } },

  { key: "cut_chicken", emoji: "🍗", title: "Cut chicken", blurb: "Swap chicken for something else",
    mealBased: true, dialLabel: "meals swapped / week", dialMax: 14, dialDefault: 2,
    relevant: (c) => c.species.includes("chicken"),
    apply: (d, max) => ({ chicken: max ? d / max : d / 14 }) },

  { key: "cut_fish", emoji: "🐟", title: "Less fish", blurb: "Skip fish & seafood some meals a week",
    mealBased: true, dialLabel: "meals skipped / week", dialMax: 14, dialDefault: 3,
    relevant: (c) => c.species.includes("fish"),
    apply: (d, max) => ({ fish: max ? d / max : d / 14 }) },

  { key: "cut_pork", emoji: "🐷", title: "Cut pork", blurb: "Cut back on pork",
    dialLabel: "% of pork cut", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.species.includes("pork"),
    apply: (d) => ({ pork: d / 100 }) },

  { key: "drop_beef", emoji: "🐄", title: "Drop beef", blurb: "Cut beef out — fewer animals than you'd think",
    dialLabel: "% of beef cut", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.species.includes("beef"),
    apply: (d) => ({ beef: d / 100 }) },

  { key: "cut_mutton", emoji: "🐐", title: "Cut mutton", blurb: "Cut back on goat & sheep meat",
    dialLabel: "% of mutton cut", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.species.includes("mutton"),
    apply: (d) => ({ mutton: d / 100 }) },

  { key: "meatfree", emoji: "🥬", title: "Meat-free days", blurb: "Go fully meat-free some days each week",
    dialLabel: "days / week", dialMax: 7, dialDefault: 2,
    relevant: (c) => c.species.some((s) => ["chicken","fish","pork","beef","mutton"].includes(s)),
    apply: (d) => { const f = d / 7; return { chicken: f, fish: f, pork: f, beef: f, mutton: f }; } },

  { key: "cagefree", emoji: "🥚", title: "Cage-free eggs", blurb: "Switch your eggs to cage-free (welfare, not lives)",
    welfareOnly: true, dialLabel: "% of eggs switched", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.species.includes("eggs"),
    apply: (d) => ({ eggs: d / 100 }) },

  { key: "plant_milk", emoji: "🥛", title: "Switch to plant-based milk", blurb: "Oat, soy or almond instead of dairy",
    dialLabel: "% of dairy switched", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.species.includes("dairy"),
    apply: (d) => ({ dairy: d / 100 }) },

  { key: "plantbased", emoji: "🌱", title: "Mostly plant-based", blurb: "Eat plant-based most of the time",
    dialLabel: "% plant-based", dialMax: 100, dialDefault: 80,
    relevant: (c) => c.species.some((s) => ["chicken","fish","pork","beef","mutton","eggs","dairy"].includes(s)),
    apply: (d) => { const f = d / 100; return { chicken: f, fish: f, pork: f, beef: f, mutton: f, eggs: f, dairy: f }; } },

  { key: "leather", emoji: "🧥", title: "Skip new leather", blurb: "Choose non-animal materials this year",
    dialLabel: "commitment", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.nonfood.includes("leather"),
    apply: () => ({ beef: 0.02 }) }, // PLACEHOLDER tiny coupling

  { key: "no_wool", emoji: "🧶", title: "Skip new wool", blurb: "Choose plant or synthetic fibres",
    dialLabel: "commitment", dialMax: 100, dialDefault: 100,
    relevant: (c) => c.nonfood.includes("wool"),
    apply: () => ({}) }, // PLACEHOLDER — welfare-only, no life math yet

  { key: "donate", emoji: "💛", title: "Support effective charities", blurb: "A small donation spares many animals per dollar",
    dialLabel: "$ / month", dialMax: 50, dialDefault: 10,
    relevant: () => true, // always available, esp. for the already-plant-based
    apply: (d) => ({ chicken: d * 0.4 }) }, // PLACEHOLDER cost-per-animal coupling
];

// The single lowest-friction suggested action for someone who picked nothing,
// chosen from their diet. Order = gentlest, most universal first. Returns the
// action object plus a small starting dial value so the resulting ripple is
// real but modest ("just once a week").
function suggestedAction(ctx) {
  const order = ["cut_chicken", "cut_fish", "meatfree", "cagefree", "plant_milk", "cut_pork", "donate"];
  for (const key of order) {
    const a = ACTIONS.find((x) => x.key === key);
    if (a && a.relevant(ctx)) {
      const dial = a.mealBased ? 1 : (key === "meatfree" ? 1 : a.dialDefault);
      return { action: a, dial };
    }
  }
  return null;
}

// Approximate meals-per-week of meat the user currently eats.
// The intensity bucket is the primary signal (the user told us their frequency),
// but the top buckets are capped by the region's realistic average so a
// heavy eater in a low-meat region isn't overstated. PLACEHOLDER tuning.
const INTENSITY_MEALS = {
  most_meals: 14, most_days: 9, less_meat: 3, rare_meat: 1,
  veg_eggs: 0, vegetarian: 0, plant: 0,
};
function meatMealsPerWeek(region, intensity) {
  const base = INTENSITY_MEALS[intensity] ?? 0;
  if (base === 0) return 0;
  const r = REGION_DATA[region] || REGION_DATA.WORLD;
  // derive total meat meals/week from kg consumed: ~120 g meat per meal
  const G_PER_MEAL = 120;
  const totalMeatKg =
    r.meatKg.chicken + r.meatKg.fish + r.meatKg.pork + r.meatKg.beef + r.meatKg.mutton;
  const regionalAvgPerWeek = (totalMeatKg * 1000 / G_PER_MEAL) / 52;
  // average eater (most_days≈9) tracks the regional average; heavy eaters
  // scale above it but never beyond ~1.6× the regional norm.
  if (intensity === "most_meals") return Math.min(base, regionalAvgPerWeek * 1.6);
  if (intensity === "most_days")  return Math.min(base, regionalAvgPerWeek * 1.1);
  return base; // lower buckets are explicit frequencies, region-independent
}

const TIMES = [
  { key: "day", label: "a day", factor: 1 / 365 },
  { key: "week", label: "a week", factor: 1 / 52 },
  { key: "month", label: "a month", factor: 1 / 12 },
  { key: "year", label: "a year", factor: 1 },
  { key: "decade", label: "10 years", factor: 10 },
  { key: "life", label: "a lifetime", factor: 55 },
];

// Scale options. Factors now derive from the selected region's demographics,
// so "your country" means 1.4B for India but ~370M for US/Canada, etc.
// family/block/zip are built from household size; city/country/world from
// the region's population figures. PLACEHOLDER demographic values.
function buildScales(region) {
  const r = REGION_DATA[region] || REGION_DATA.WORLD;
  const hh = r.household;
  const block = Math.round(hh * 30);      // ~30 households on a block
  const zip = Math.round(hh * 3500);      // ~3,500 households in a zip/postcode area
  return [
    { key: "you",     label: "just you",        factor: 1 },
    { key: "family",  label: "your family",     factor: Math.round(hh) },
    { key: "block",   label: "your block",      factor: block },
    { key: "zip",     label: "your zip code",   factor: zip },
    { key: "city",    label: "your city",       factor: r.city },
    { key: "country", label: `all of ${r.scaleLabel}`, factor: r.pop },
    { key: "world",   label: "the whole world", factor: REGION_DATA.WORLD.pop },
  ];
}

/* ---- helpers ------------------------------------------------------------- */

// Build an emoji "flock" from the user's results — a curiosity-piquing,
// paste-anywhere share artifact. Groups animals so runs stay countable.
const FLOCK_EMOJI = { chicken:"🐔", fish:"🐟", pork:"🐖", beef:"🐄", mutton:"🐐", eggs:"🥚", dairy:"🥛" };

function buildFlock(cards) {
  const counts = {};
  (cards || []).forEach((c) => { if (c.kind === "lives") counts[c.sp] = (counts[c.sp] || 0) + c.count; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) return { flock: "" };
  const perEmoji = total <= 20 ? 1 : total <= 200 ? 10 : Math.ceil(total / 20);
  let glyphs = [];
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sp, n]) => {
      const kk = Math.max(Math.round(n / perEmoji), n > 0 ? 1 : 0);
      glyphs.push(...Array(kk).fill(FLOCK_EMOJI[sp] || "🐾"));
    });
  glyphs = glyphs.slice(0, 20);
  const flock = [glyphs.slice(0, 10).join(""), glyphs.slice(10).join("")].filter(Boolean).join("\n");
  return { flock };
}

const fmt = (n) => {
  if (n === 0) return "0";
  if (n < 1) return n.toFixed(2);
  if (n < 1000) return Math.round(n).toLocaleString();
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + "K";
  if (n < 1e9) return (n / 1e6).toFixed(1) + "M";
  if (n < 1e12) return (n / 1e9).toFixed(1) + "B";
  return (n / 1e12).toFixed(1) + "T";
};

function useCountUp(target, dur = 600) {
  const [val, setVal] = useState(target);
  const ref = useRef({ from: target, start: 0, raf: 0 });
  useEffect(() => {
    cancelAnimationFrame(ref.current.raf);
    ref.current.from = val;
    ref.current.start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - ref.current.start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(ref.current.from + (target - ref.current.from) * e);
      if (p < 1) ref.current.raf = requestAnimationFrame(tick);
    };
    ref.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current.raf);
    // eslint-disable-next-line
  }, [target]);
  return val;
}

/* ---- atmospheric background --------------------------------------------- */

function Background() {
  const emojis = ["🐔", "🐄", "🐷", "🐟", "🐐", "🐑", "🥚"];
  const [drift, setDrift] = useState([]);
  useEffect(() => {
    const items = Array.from({ length: 22 }, (_, i) => ({
      id: i,
      e: emojis[i % emojis.length],
      left: Math.random() * 100,
      delay: Math.random() * 18,
      dur: 16 + Math.random() * 16,
      size: 18 + Math.random() * 30,
      op: 0.05 + Math.random() * 0.10,
    }));
    setDrift(items);
  }, []);
  const [counter, setCounter] = useState(72_400_000_000);
  useEffect(() => {
    const id = setInterval(() => setCounter((c) => c + Math.floor(Math.random() * 2200 + 800)), 90);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="bg-layer">
      <div className="bg-counter">
        <span className="bg-counter-num">{counter.toLocaleString()}</span>
        <span className="bg-counter-lbl">land animals farmed worldwide, this year — and counting</span>
      </div>
      {drift.map((d) => (
        <span key={d.id} className="bg-drift" style={{
          left: `${d.left}%`, animationDelay: `${d.delay}s`,
          animationDuration: `${d.dur}s`, fontSize: `${d.size}px`, opacity: d.op,
        }}>{d.e}</span>
      ))}
      <div className="bg-grain" />
    </div>
  );
}

/* ---- small UI pieces ----------------------------------------------------- */

function Tile({ emoji, label, sub, selected, onClick, wide }) {
  return (
    <button className={`tile${selected ? " tile-on" : ""}${wide ? " tile-wide" : ""}`} onClick={onClick}>
      <span className="tile-emoji">{emoji}</span>
      <span className="tile-label">{label}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </button>
  );
}

function StepDots({ n, i }) {
  return (
    <div className="dots">
      {Array.from({ length: n }).map((_, k) => (
        <span key={k} className={`dot${k === i ? " dot-on" : ""}${k < i ? " dot-done" : ""}`} />
      ))}
    </div>
  );
}

/* ---- impact math --------------------------------------------------------- */

function computeImpact({ region, intensity, species, actions, dials, weights, welfareGap, time, scale }) {
  const base = BASELINES[region] || BASELINES.WORLD;
  const mult = INTENSITY[intensity]?.mult ?? 1;

  // personal yearly consumption per species (only species the user eats)
  // The intensity multiplier scales MEAT only — a vegetarian (mult 0) still
  // eats eggs/dairy/honey, so those are governed purely by selection.
  const MEAT = ["chicken", "fish", "pork", "beef", "mutton"];
  const sw = speciesWeights(weights);
  const yearly = {};
  SPECIES.forEach((s) => {
    if (!species.includes(s.key)) { yearly[s.key] = 0; return; }
    yearly[s.key] = MEAT.includes(s.key) ? base[s.key] * mult : base[s.key];
  });

  // aggregate reductions across chosen actions.
  // For each species we track, as a FRACTION of that species' baseline:
  //   livesFrac   = share removed entirely (not bred/caught) — lives actions
  //   welfareFrac = share merely shifted to better conditions — welfare actions
  // These must be DISJOINT: an animal removed entirely cannot also be
  // "improved". Lives takes precedence; welfare only applies to whatever
  // fraction lives actions did NOT already eliminate. This prevents the same
  // animal being counted in both buckets (the 666-vs-95 double count).
  const livesFrac = {};
  const welfareFrac = {};

  actions.forEach((aKey) => {
    const action = ACTIONS.find((a) => a.key === aKey);
    if (!action) return;
    const mealCap = meatMealsPerWeek(region, intensity);
    const effMax = action.mealBased ? Math.max(1, Math.min(action.dialMax, Math.round(mealCap))) : action.dialMax;
    const dial = Math.min(dials[aKey] ?? Math.min(action.dialDefault, effMax), effMax);
    const reductions = action.apply(dial, effMax);
    Object.entries(reductions).forEach(([sp, frac]) => {
      const bucket = action.welfareOnly ? welfareFrac : livesFrac;
      // fractions from multiple actions on the same species don't simply add
      // (two 60% cuts ≠ 120%); combine as independent overlapping coverage.
      bucket[sp] = 1 - (1 - (bucket[sp] || 0)) * (1 - frac);
    });
  });

  // Resolve overlap: welfare only counts on the portion not already removed.
  const livesSaved = {};
  const welfareImp = {};
  SPECIES.forEach((s) => {
    const sp = s.key;
    const yr = yearly[sp] || 0;
    if (yr <= 0) return;
    const lf = Math.min(1, livesFrac[sp] || 0);
    const wfRaw = Math.min(1, welfareFrac[sp] || 0);
    const wf = wfRaw * (1 - lf); // welfare applies only to the surviving share
    if (lf > 0) livesSaved[sp] = yr * lf;
    if (wf > 0) welfareImp[sp] = yr * wf;
  });

  const tf = TIMES.find((t) => t.key === time)?.factor ?? 1;
  const sf = buildScales(region).find((s) => s.key === scale)?.factor ?? 1;
  const k = tf * sf;

  // build ranked impact cards, weighting by moral value
  const cards = [];
  let weightedLives = 0, rawLives = 0, rawWelfare = 0, weightedWelfare = 0;
  Object.entries(livesSaved).forEach(([sp, n]) => {
    if (n <= 0) return;
    const scaled = n * k;
    const w = (sw[sp] ?? 1);
    weightedLives += scaled * w;
    rawLives += scaled;
    cards.push({ sp, kind: "lives", count: scaled, weighted: scaled * w });
  });
  Object.entries(welfareImp).forEach(([sp, n]) => {
    if (n <= 0) return;
    const scaled = n * k;
    const w = (sw[sp] ?? 1) / welfareGap;
    rawWelfare += scaled;
    weightedWelfare += scaled * w;
    cards.push({ sp, kind: "welfare", count: scaled, weighted: scaled * w });
  });
  cards.sort((a, b) => b.weighted - a.weighted);

  // Blended, sentience-weighted impact: lives + welfare, each already carrying
  // the user's per-species weights, with welfare discounted by welfareGap
  // (baked into weightedWelfare above). Moves live as the user drags any slider.
  const blended = weightedLives + weightedWelfare;

  return { cards, weightedLives, rawLives, rawWelfare, weightedWelfare, blended, yearly };
}

// Current "as-is" footprint: what the user's diet costs animals per the chosen
// time + scale, with NO changes applied. Reuses the same baseline `yearly`
// consumption and the user's own moral weights. Returns ranked rows + total.
function computeFootprint({ region, intensity, species, weights, time, scale }) {
  const base = BASELINES[region] || BASELINES.WORLD;
  const mult = INTENSITY[intensity]?.mult ?? 1;
  const MEAT = ["chicken", "fish", "pork", "beef", "mutton"];
  const sw = speciesWeights(weights);
  const tf = TIMES.find((t) => t.key === time)?.factor ?? 1;
  const sf = buildScales(region).find((s) => s.key === scale)?.factor ?? 1;
  const k = tf * sf;

  const rows = [];
  let weightedTotal = 0;
  SPECIES.forEach((s) => {
    if (!species.includes(s.key)) return;
    const perYear = MEAT.includes(s.key) ? base[s.key] * mult : base[s.key];
    const count = perYear * k;
    if (count <= 0) return;
    const w = sw[s.key] ?? 1;
    weightedTotal += count * w;
    rows.push({ sp: s.key, count, weighted: count * w });
  });
  rows.sort((a, b) => b.weighted - a.weighted);
  return { rows, weightedTotal };
}

/* ---- main app ------------------------------------------------------------ */

const STEPS = ["Where", "You", "What you eat", "Extras", "Your move", "Your ripple"];

export default function App() {
  const [step, setStep] = useState(-1); // -1 = hero
  const [region, setRegion] = useState(null);
  const [intensity, setIntensity] = useState(null);
  const [species, setSpecies] = useState(["chicken", "fish", "eggs", "dairy"]);
  const [nonfood, setNonfood] = useState([]);
  const [actions, setActions] = useState([]);
  const [dials, setDials] = useState({});
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [welfareGap, setWelfareGap] = useState(DEFAULT_WELFARE_GAP);
  const [showBrave, setShowBrave] = useState(false);
  const [humanValue, setHumanValue] = useState(0.5); // decorative: 1 cow/pig ≈ half a human (RP pig 0.52)
  const [time, setTime] = useState("year");
  const [scale, setScale] = useState("you");
  const [showMoral, setShowMoral] = useState(false);
  const [showFootprint, setShowFootprint] = useState(false);
  const [shareStatus, setShareStatus] = useState(null); // null | 'copied' | 'shared' | 'error'

  const handleShare = async () => {
    const { flock } = buildFlock(result.cards);
    const number = fmt(result.rawLives);
    const timeLabel = TIMES.find((t) => t.key === time)?.label || "a year";
    const shareText =
`🌊 The Ripple

${flock}
= ${number} animals over ${timeLabel}, from one small change

What's yours? → the-ripple.app`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        setShareStatus('shared');
      } catch (err) {
        if (err.name !== 'AbortError') setShareStatus('error');
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus('copied');
      setTimeout(() => setShareStatus(null), 2500);
    } catch {
      setShareStatus('error');
    }
  };

  // Tracks whether the user has manually edited steps 2–4. Until they do,
  // picking (or re-picking) a region re-seeds the median-person defaults.
  const customizedRef = useRef(false);

  const chooseRegion = (key) => {
    setRegion(key);
    if (!customizedRef.current) {
      setIntensity(DEFAULT_INTENSITY[key] || "most_days");
      setSpecies(defaultSpeciesForRegion(key));
      setNonfood(defaultNonfoodForRegion(key));
      setActions([]); // let step 4's reactive filter pick from the seeded diet
    }
  };

  const toggle = (arr, set, key) =>
    set(arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key]);

  const result = useMemo(() => computeImpact({
    region, intensity, species, actions, dials, weights, welfareGap, time, scale,
  }), [region, intensity, species, actions, dials, weights, welfareGap, time, scale]);

  // Normalized impact at "you, this year" — used to judge how small the outcome
  // is, independent of the current scrubber positions.
  const baseImpact = useMemo(() => computeImpact({
    region, intensity, species, actions, dials, weights, welfareGap, time: "year", scale: "you",
  }).rawLives, [region, intensity, species, actions, dials, weights, welfareGap]);

  // When a small result first loads, lift the DEFAULT view via honest amplifiers:
  //  - time: 10 years if modest, a lifetime if very small
  //  - grouping: up to family level (never block/city/region)
  // Only fires once per result (not after manual scrubbing), and only upward.
  const amplifiedRef = useRef(null);
  useEffect(() => {
    if (step !== 5 || actions.length === 0) return;
    const sig = `${baseImpact.toFixed(4)}`;
    if (amplifiedRef.current === sig) return; // already handled this result
    amplifiedRef.current = sig;
    // thresholds in "animals helped per year, just you"
    if (baseImpact <= 0) return;
    if (baseImpact < 0.5) {            // very small → lifetime + family
      setTime("life"); setScale("family");
    } else if (baseImpact < 3) {       // modest → 10 years, just you
      setTime("decade"); setScale("you");
    } else if (baseImpact < 8) {       // smallish → 10 years
      setTime("decade"); setScale("you");
    }
    // larger outcomes keep the honest default (year / you)
    // eslint-disable-next-line
  }, [baseImpact, step, actions.length]);

  const animated = useCountUp(result.rawLives);
  const loggedRef = useRef(false);
  useEffect(() => {
    if (step !== 5) { loggedRef.current = false; return; }
    if (loggedRef.current) return;
    if (!supabase) return;
    if (actions.length === 0) return;
    loggedRef.current = true;
    supabase.from('submissions').insert({
      region,
      intensity,
      species,
      nonfood,
      actions,
      dials,
      weights,
      welfare_gap: welfareGap,
      time_view: time,
      scale_view: scale,
    }, { returning: 'minimal' }).then(({ error }) => {
      if (error) console.warn('Log failed:', error.message);
    });
  }, [step, actions.length]);

  const segmentMsg = useMemo(() => {
    if (intensity === "most_meals" || intensity === "most_days")
      return "You're starting from a high baseline — which means you have plenty of room to make a difference, whichever animals you care about most.";
    if (intensity === "less_meat" || intensity === "rare_meat")
      return "You've already cut back more than most. Which remaining change matters most depends on how you weigh different animals — adjust the values below and watch the ranking shift.";
    if (intensity === "veg_eggs")
      return "You've removed meat already. Whether eggs or anything else is your biggest remaining lever depends on the relative value you place on a laying hen — set that below.";
    if (intensity === "vegetarian")
      return "You've come a long way. Dairy is the main remaining animal product on your plate — and supporting effective charities extends your reach far beyond it.";
    if (intensity === "plant")
      return "You're at the far end of the dial. From here, the change with the widest reach is often helping someone else take their first step — or supporting effective animal charities.";
    return "";
  }, [intensity]);

  const canAdvance = () => {
    if (step === 0) return !!region;
    if (step === 1) return !!intensity;
    if (step === 2) return species.length > 0 || true;
    if (step === 3) return true;
    if (step === 4) return true; // "no changes" is a valid choice → starting-line view
    return true;
  };

  const next = () => setStep((s) => Math.min(5, s + 1));
  const back = () => setStep((s) => Math.max(-1, s - 1));

  /* ----- HERO ----- */
  if (step === -1) {
    return (
      <div className="root">
        <Style />
        <Background />
        <div className="hero">
          <p className="kicker">no purity tests · no guilt · just the numbers</p>
          <h1 className="hero-h1">
            You don't have to be vegan<br /><span className="ink">to matter.</span>
          </h1>
          <p className="hero-sub">
            Every meal is a small vote for the kind of world you want.
            Answer five quick things and watch what even tiny changes add up to.
          </p>
          <button className="cta" onClick={() => setStep(0)}>
            Show me my ripple →
          </button>
          <p className="hero-foot">Takes about 60 seconds.</p>
        </div>
      </div>
    );
  }

  /* ----- RESULT (step 5) ----- */
  if (step === 5) {
    const scales = buildScales(region);
    const footprint = computeFootprint({ region, intensity, species, weights, time, scale });

    // No change picked → "starting line" state: lead with the footprint,
    // framed warmly, and offer one low-friction action to convert it into
    // a real ripple without going back a step.
    if (actions.length === 0) {
      const ctx = { species, nonfood, intensity };
      const suggestion = suggestedAction(ctx);
      const applySuggestion = () => {
        if (!suggestion) return;
        setActions([suggestion.action.key]);
        setDials((d) => ({ ...d, [suggestion.action.key]: suggestion.dial }));
      };
      return (
        <div className="root">
          <Style />
          <Background />
          <div className="panel result-panel">
            <StepDots n={6} i={5} />
            <p className="kicker">your starting line</p>
            <h2 className="start-h">Here's where you are today.</h2>
            <p className="start-sub">
              You haven't picked a change yet — and that's completely fine.
              This is simply what your current diet asks of animals over{" "}
              <strong>{TIMES.find(t => t.key === time)?.label}</strong>
              {scale !== "you" && <> across <strong>{scales.find(s => s.key === scale)?.label}</strong></>}.
              It's a starting line, not a scorecard. Even one small change moves it.
            </p>

            {footprint.rows.length === 0 ? (
              <p className="muted start-none">
                Your diet already asks almost nothing of animals — you're at the far
                end of the dial. The biggest thing left is helping someone else start.
              </p>
            ) : (
              <div className="fp-rows start-rows">
                {footprint.rows.map((r) => {
                  const meta = SPECIES.find((s) => s.key === r.sp);
                  const isYears = r.sp === "eggs" || r.sp === "dairy";
                  return (
                    <div key={r.sp} className="fp-row">
                      <span className="fp-emoji">{meta?.emoji}</span>
                      <span className="fp-count">{fmt(r.count)} {meta?.animal}</span>
                      <span className="fp-desc">{isYears ? "of farmed life" : "raised & used"}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {suggestion && (
              <div className="start-cta-box">
                <p className="start-cta-label">Want to see your ripple? Start small:</p>
                <button className="start-cta" onClick={applySuggestion}>
                  <span className="start-cta-emoji">{suggestion.action.emoji}</span>
                  <span className="start-cta-text">
                    <span className="start-cta-title">{suggestion.action.title}</span>
                    <span className="start-cta-blurb">
                      {suggestion.action.mealBased
                        ? "Just once a week — watch what it adds up to"
                        : suggestion.action.blurb}
                    </span>
                  </span>
                  <span className="start-cta-arrow">→</span>
                </button>
                <p className="start-or">or <button className="link-btn inline" onClick={back}>pick your own change →</button></p>
              </div>
            )}

            {!suggestion && (
              <div className="nav">
                <button className="ghost" onClick={back}>← back</button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="root">
        <Style />
        <Background />
        <div className="panel result-panel">
          <StepDots n={6} i={5} />
          <div className="result-head">
            <p className="kicker">your ripple</p>
            <button className="info-btn" onClick={() => setShowFootprint((v) => !v)}
              aria-label="Show my current footprint" title="See your current footprint">
              ⓘ
            </button>
          </div>
          <div className="big-number">
            <span className="bn-num">{fmt(animated)}</span>
            <span className="bn-unit">animals spared</span>
          </div>
          {result.blended > 0 && (
            <p className="bn-blended">
              ≈ <strong>{fmt(result.blended)}</strong> weighted impact — lives and welfare combined, <em>by your values</em>.
              <button className="blended-info" onClick={() => setShowMoral(true)}>set them ↓</button>
            </p>
          )}
          <p className="bn-context">
            over <strong>{TIMES.find(t => t.key === time)?.label}</strong>,
            across <strong>{scales.find(s => s.key === scale)?.label}</strong>
            {scale !== "you" && <span className="hypo"> (hypothetical)</span>}
          </p>
          {baseImpact > 0 && baseImpact < 8 && (time !== "year" || scale !== "you") && (
            <p className="amplify-note">
              A single year for one person is a small number — so we're showing a
              {time === "life" ? " lifetime" : " longer"} view{scale === "family" ? ", across a household" : ""}.
              It's the same small habit, just measured over how long it really lasts.
              Scrub below to see any timeframe.
            </p>
          )}

          {showFootprint && (
            <div className="footprint">
              <div className="fp-head">
                <span className="fp-title">Your footprint, as things stand</span>
                <button className="fp-close" onClick={() => setShowFootprint(false)}>✕</button>
              </div>
              <p className="fp-intro">
                If nothing changes, this is roughly what your current diet asks of animals
                over <strong>{TIMES.find(t => t.key === time)?.label}</strong>
                {scale !== "you" && <> across <strong>{scales.find(s => s.key === scale)?.label}</strong></>}.
                Not a verdict — just the baseline your choices move from.
              </p>
              {footprint.rows.length === 0 ? (
                <p className="muted small">Your selected diet has no animal footprint to show — that's the far end of the dial.</p>
              ) : (
                <div className="fp-rows">
                  {footprint.rows.map((r) => {
                    const meta = SPECIES.find((s) => s.key === r.sp);
                    const isYears = r.sp === "eggs" || r.sp === "dairy";
                    return (
                      <div key={r.sp} className="fp-row">
                        <span className="fp-emoji">{meta?.emoji}</span>
                        <span className="fp-count">{fmt(r.count)} {meta?.animal}</span>
                        <span className="fp-desc">{isYears ? "of farmed life" : "raised & used"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="fp-foot">
                The changes you picked are what pull these numbers down — that's your ripple above.
              </p>
            </div>
          )}

          <p className="segment-note">{segmentMsg}</p>

          {/* time + scale scrubbers */}
          <div className="scrub-row">
            <div className="scrub">
              <label>Over…</label>
              <div className="chip-row">
                {TIMES.map((t) => (
                  <button key={t.key} className={`chip${time === t.key ? " chip-on" : ""}`} onClick={() => setTime(t.key)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="scrub">
              <label>If this were done by…</label>
              <div className="chip-row">
                {scales.map((s) => (
                  <button key={s.key} className={`chip${scale === s.key ? " chip-on" : ""}`} onClick={() => setScale(s.key)}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ranked impact cards */}
          <div className="impact-grid">
            {result.cards.length === 0 && <p className="muted">Pick a change on the previous step to see your impact.</p>}
            {result.cards.map((c, i) => {
              const meta = SPECIES.find((s) => s.key === c.sp);
              return (
                <div key={i} className={`impact-card ${c.kind}`}>
                  <span className="ic-emoji">{meta?.emoji}</span>
                  <div className="ic-body">
                    <span className="ic-count">{fmt(c.count)} {meta?.animal}</span>
                    <span className="ic-kind">
                      {c.kind === "lives" ? meta?.livesText : meta?.welfareText}
                    </span>
                  </div>
                  <span className={`ic-tag ${c.kind}`}>{c.kind === "lives" ? "LIVES" : "WELFARE"}</span>
                </div>
              );
            })}
          </div>
          <p className="rank-note">
            Cards are ranked by impact, using <em>your</em> values — set them below and
            the order will change. A spared life and an eased life are shown separately,
            because they're different kinds of help. None of it is wasted.
          </p>

          {/* moral weighting */}
          <div className="moral">
            <button className="moral-toggle" onClick={() => setShowMoral((v) => !v)}>
              {showMoral ? "▾" : "▸"} How much is each animal's life worth to you? Set your own values.
            </button>
            {showMoral && (
              <div className="moral-body">
                <p className="muted small">
                  There are no proven answers here — these are <em>your</em> values, made visible.
                  The hen is the reference point. Drag any slider and the ranking above updates live.
                </p>

                {/* Fish: anchored as "1 hen = N fish" */}
                <div className="wslider">
                  <span className="wlabel">1 hen =</span>
                  <input type="range" min="0.5" max="100" step="0.5"
                    value={weights.henPerFish}
                    onChange={(e) => setWeights({ ...weights, henPerFish: parseFloat(e.target.value) })} />
                  <span className="wval">{weights.henPerFish} fish</span>
                </div>

                {/* Pig, cow, goat: anchored as "1 X = N hens" */}
                {[
                  ["pig", "1 pig ="],
                  ["cow", "1 cow ="],
                  ["goat", "1 goat ="],
                ].map(([key, lbl]) => (
                  <div key={key} className="wslider">
                    <span className="wlabel">{lbl}</span>
                    <input type="range" min="0.5" max="100" step="0.5"
                      value={weights[key]}
                      onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })} />
                    <span className="wval">{weights[key]} hens</span>
                  </div>
                ))}
                <p className="muted tiny">Cow value applies to both beef and dairy cattle.</p>

                {/* Welfare gap */}
                <div className="wslider">
                  <span className="wlabel">Factory farm vs. free-range, how much worse?</span>
                  <input type="range" min="1" max="100" step="1"
                    value={welfareGap}
                    onChange={(e) => setWelfareGap(parseFloat(e.target.value))} />
                  <span className="wval">{welfareGap}× worse</span>
                </div>

                {/* Brave: optional human comparison */}
                <button className="brave-toggle" onClick={() => setShowBrave((v) => !v)}>
                  {showBrave ? "▾" : "▸"} Feeling brave? Compare to a human life (optional)
                </button>
                {showBrave && (
                  <div className="brave-body">
                    <p className="muted tiny">
                      This is a deliberately uncomfortable question many prefer to skip — it
                      doesn't affect your results, it's just for your own reflection.
                    </p>
                    <div className="wslider">
                      <span className="wlabel">1 cow or pig =</span>
                      <input type="range" min="0.01" max="2" step="0.01"
                        value={humanValue}
                        onChange={(e) => setHumanValue(parseFloat(e.target.value))} />
                      <span className="wval">
                        {humanValue < 1
                          ? `1/${Math.round(1 / humanValue)} of a human`
                          : `${humanValue} humans`}
                      </span>
                    </div>
                  </div>
                )}

                <button className="link-btn" onClick={() => {
                  setWeights(DEFAULT_WEIGHTS); setWelfareGap(DEFAULT_WELFARE_GAP); setHumanValue(0.5);
                }}>
                  reset to defaults
                </button>
              </div>
            )}
          </div>

          {/* share */}
          <div className="share-box">
            <p className="share-invite">Pass it on — help someone see their ripple.</p>
            <div className="share-card">
              <p className="sc-brand">🌊 The Ripple</p>
              <p className="sc-flock">{buildFlock(result.cards).flock || "🐾"}</p>
              <p className="sc-big">= {fmt(result.rawLives)} animals over {TIMES.find(t=>t.key===time)?.label}, from one small change</p>
              <p className="sc-foot">What's yours? · the-ripple.app</p>
            </div>
            <button className="share-btn" onClick={handleShare}>
              {shareStatus === 'copied' ? '✓ Copied — paste it anywhere' :
               shareStatus === 'shared' ? '✓ Shared!' :
               shareStatus === 'error' ? 'Try again' :
               'Share your ripple →'}
            </button>
          </div>

          <p className="privacy-note">
            Your answers (not your identity) are logged anonymously to help improve this tool.
          </p>
          <p className="method-link">
            <a href="/methodology.html" target="_blank" rel="noopener">How is this calculated?</a>
          </p>

          <div className="nav">
            <button className="ghost" onClick={back}>← change my move</button>
          </div>
        </div>
      </div>
    );
  }

  /* ----- STEPS 0–4 ----- */
  return (
    <div className="root">
      <Style />
      <Background />
      <div className="panel">
        <StepDots n={6} i={step} />

        {step === 0 && (
          <>
            <h2 className="q">Where are you?</h2>
            <p className="q-sub">This sets a realistic local baseline.</p>
            <div className="tile-grid">
              {REGIONS.map((r) => (
                <Tile key={r.key} emoji={r.emoji} label={r.label}
                  selected={region === r.key} onClick={() => { chooseRegion(r.key); }} />
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="q">Which sounds most like you <em>right now</em>?</h2>
            <p className="q-sub">Not a label. Just a starting point on the dial.</p>
            <div className="tile-grid">
              {Object.entries(INTENSITY).map(([k, v]) => (
                <Tile key={k} emoji={v.emoji} label={v.label}
                  selected={intensity === k} onClick={() => {
                    customizedRef.current = true;
                    setIntensity(k);
                    // prune any species this diet rules out, so step 3 stays consistent
                    const ex = INTENSITY[k].excludes;
                    if (ex.length) setSpecies((sp) => sp.filter((x) => !ex.includes(x)));
                  }} wide />
              ))}
            </div>
          </>
        )}

        {step === 2 && (() => {
          const excluded = INTENSITY[intensity]?.excludes ?? [];
          const shown = SPECIES.filter((s) => !excluded.includes(s.key));
          const isVeg = intensity === "veg_eggs" || intensity === "vegetarian" || intensity === "plant";
          return (
          <>
            <h2 className="q">What {isVeg ? "animal products do you have" : "do you eat"}?</h2>
            <p className="q-sub">Tap all that apply. This is what shapes your numbers.</p>
            <div className="tile-grid">
              {shown.map((s) => (
                <Tile key={s.key} emoji={s.emoji} label={s.label}
                  selected={species.includes(s.key)} onClick={() => { customizedRef.current = true; toggle(species, setSpecies, s.key); }} />
              ))}
            </div>
          </>
          );
        })()}

        {step === 3 && (
          <>
            <h2 className="q">Beyond the plate?</h2>
            <p className="q-sub">Optional — animals show up in more than food.</p>
            <div className="tile-grid">
              {NONFOOD.map((s) => (
                <Tile key={s.key} emoji={s.emoji} label={s.label}
                  selected={nonfood.includes(s.key)} onClick={() => { customizedRef.current = true; toggle(nonfood, setNonfood, s.key); }} />
              ))}
            </div>
          </>
        )}

        {step === 4 && (() => {
          const ctx = { species, nonfood, intensity };
          const visible = ACTIONS.filter((a) => a.relevant(ctx));
          return (
          <>
            <h2 className="q">What change do you want to <em>try</em>?</h2>
            <p className="q-sub">Tailored to what you told us. Tap to set how far you'd go.</p>
            <div className="action-list">
              {visible.map((a) => {
                const on = actions.includes(a.key);
                // Cap meal-based dials at the user's stated weekly meat meals.
                const mealCap = meatMealsPerWeek(region, intensity);
                const effMax = a.mealBased ? Math.max(1, Math.min(a.dialMax, Math.round(mealCap))) : a.dialMax;
                const rawDial = dials[a.key] ?? Math.min(a.dialDefault, effMax);
                const dial = Math.min(rawDial, effMax);
                return (
                  <div key={a.key} className={`action${on ? " action-on" : ""}`}>
                    <button className="action-head" onClick={() => toggle(actions, setActions, a.key)}>
                      <span className="action-emoji">{a.emoji}</span>
                      <span className="action-text">
                        <span className="action-title">{a.title}</span>
                        <span className="action-blurb">{a.blurb}</span>
                      </span>
                      <span className={`check${on ? " check-on" : ""}`}>{on ? "✓" : "+"}</span>
                    </button>
                    {on && (
                      <div className="action-dial">
                        <input type="range" min={a.mealBased ? 1 : 0} max={effMax} step="1" value={dial}
                          onChange={(e) => setDials({ ...dials, [a.key]: parseInt(e.target.value) })} />
                        <span className="dial-val">{dial} {a.dialLabel}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="no-change" onClick={() => { setActions([]); next(); }}>
              I'd rather not change anything right now →
            </button>
          </>
          );
        })()}

        <div className="nav">
          <button className="ghost" onClick={back}>← back</button>
          <button className="cta small" disabled={!canAdvance()} onClick={next}>
            {step === 4 ? "See my ripple →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- styles -------------------------------------------------------------- */

function Style() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Newsreader:ital,opsz@0,6..72;1,6..72&family=DM+Mono:wght@400;500&display=swap');

:root{
  --bg:#0f1410; --bg2:#161d16; --paper:#f4efe4; --ink:#1a1f17;
  --moss:#5b7a4a; --moss-d:#3f5a32; --gold:#d9a441; --rose:#c96f5b;
  --line:rgba(244,239,228,.14);
}
*{box-sizing:border-box;margin:0;padding:0}
.root{min-height:100vh;width:100%;position:relative;overflow-x:hidden;
  background:radial-gradient(120% 90% at 50% -10%, #1d2a1b 0%, var(--bg) 55%, #0a0d0a 100%);
  color:var(--paper);font-family:'Newsreader',Georgia,serif;
  display:flex;align-items:center;justify-content:center;padding:28px 16px;}

/* background */
.bg-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.bg-counter{position:absolute;top:26px;left:50%;transform:translateX(-50%);text-align:center;width:92%}
.bg-counter-num{display:block;font-family:'DM Mono',monospace;font-size:13px;letter-spacing:.06em;color:rgba(217,164,65,.45)}
.bg-counter-lbl{display:block;font-size:11px;color:rgba(244,239,228,.28);margin-top:2px;letter-spacing:.04em}
.bg-drift{position:absolute;bottom:-10%;animation:rise linear infinite;filter:grayscale(.2)}
@keyframes rise{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(-115vh) rotate(40deg)}}
.bg-grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}

/* hero */
.hero{position:relative;z-index:2;max-width:620px;text-align:center;
  animation:fadeUp .8s cubic-bezier(.2,.7,.2,1) both}
.kicker{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--gold);margin-bottom:22px}
.hero-h1{font-family:'Fraunces',serif;font-weight:900;font-size:clamp(38px,7vw,68px);
  line-height:.98;letter-spacing:-.02em;margin-bottom:24px}
.hero-h1 .ink{font-style:italic;font-weight:400;color:var(--moss)}
.hero-sub{font-size:clamp(17px,2.5vw,21px);line-height:1.55;color:rgba(244,239,228,.78);
  max-width:480px;margin:0 auto 36px}
.cta{font-family:'Fraunces',serif;font-weight:600;font-size:20px;color:var(--ink);
  background:var(--gold);border:none;padding:16px 34px;border-radius:50px;cursor:pointer;
  box-shadow:0 8px 30px rgba(217,164,65,.3);transition:transform .2s,box-shadow .2s}
.cta:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(217,164,65,.45)}
.cta.small{font-size:17px;padding:13px 26px}
.cta:disabled{opacity:.35;cursor:not-allowed;box-shadow:none;transform:none}
.hero-foot{margin-top:16px;font-family:'DM Mono',monospace;font-size:12px;color:rgba(244,239,228,.4)}

/* panel */
.panel{position:relative;z-index:2;width:100%;max-width:580px;
  background:rgba(20,27,20,.82);backdrop-filter:blur(14px);
  border:1px solid var(--line);border-radius:24px;padding:34px 30px 26px;
  box-shadow:0 30px 80px rgba(0,0,0,.5);animation:fadeUp .5s cubic-bezier(.2,.7,.2,1) both}
.result-panel{max-width:680px}

.dots{display:flex;gap:7px;justify-content:center;margin-bottom:26px}
.dot{width:7px;height:7px;border-radius:50%;background:rgba(244,239,228,.18);transition:.3s}
.dot-on{background:var(--gold);width:22px;border-radius:4px}
.dot-done{background:var(--moss)}

.q{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(24px,4vw,32px);
  line-height:1.1;text-align:center;letter-spacing:-.01em}
.q em{font-style:italic;color:var(--gold)}
.q-sub{text-align:center;color:rgba(244,239,228,.6);font-size:15px;margin:10px 0 26px}

.tile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:11px}
.tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;padding:18px 12px;
  background:rgba(244,239,228,.04);border:1.5px solid var(--line);border-radius:16px;
  cursor:pointer;transition:.18s;color:var(--paper);font-family:inherit}
.tile:hover{background:rgba(244,239,228,.08);border-color:rgba(217,164,65,.4);transform:translateY(-2px)}
.tile-on{background:rgba(217,164,65,.18);border-color:var(--gold);border-width:2px;
  box-shadow:0 0 0 1px var(--gold), 0 6px 22px rgba(217,164,65,.28);transform:translateY(-2px)}
.tile-on:hover{background:rgba(217,164,65,.24);border-color:var(--gold)}
.tile-on .tile-label{color:var(--gold);font-weight:600}
.tile-on::after{content:"✓";position:absolute;top:7px;right:9px;font-size:12px;font-weight:700;
  width:18px;height:18px;display:flex;align-items:center;justify-content:center;
  background:var(--gold);color:var(--ink);border-radius:50%;line-height:1}
.tile-emoji{font-size:30px}
.tile-on .tile-emoji{transform:scale(1.08)}
.tile-wide{flex-direction:row;justify-content:center;padding-left:32px;padding-right:32px}
.tile-wide .tile-emoji{font-size:24px}
.tile-wide.tile-on::after{top:50%;right:12px;transform:translateY(-50%)}
.tile-label{font-size:15px;font-weight:500;transition:color .18s}
.tile-sub{font-size:12px;color:rgba(244,239,228,.5)}

/* actions */
.action-list{display:flex;flex-direction:column;gap:10px}
.no-change{display:block;margin:16px auto 0;background:none;border:none;
  color:rgba(244,239,228,.5);font-family:inherit;font-size:14px;cursor:pointer;
  text-decoration:underline;text-underline-offset:3px;transition:.15s}
.no-change:hover{color:rgba(244,239,228,.8)}
.action{border:1.5px solid var(--line);border-radius:16px;overflow:hidden;
  background:rgba(244,239,228,.03);transition:.18s}
.action-on{border-color:var(--moss);background:rgba(91,122,74,.14)}
.action-head{width:100%;display:flex;align-items:center;gap:14px;padding:15px 16px;
  background:none;border:none;cursor:pointer;color:var(--paper);font-family:inherit;text-align:left}
.action-emoji{font-size:28px;flex-shrink:0}
.action-text{display:flex;flex-direction:column;gap:2px;flex:1}
.action-title{font-family:'Fraunces',serif;font-weight:600;font-size:18px;display:flex;align-items:center;gap:8px}
.action-blurb{font-size:13px;color:rgba(244,239,228,.6)}
.check{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line);
  display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;color:rgba(244,239,228,.6)}
.check-on{background:var(--moss);border-color:var(--moss);color:#fff}
.action-dial{display:flex;align-items:center;gap:14px;padding:0 16px 16px}
.action-dial input,.wslider input{flex:1;accent-color:var(--gold);height:4px;cursor:pointer}
.dial-val{font-family:'DM Mono',monospace;font-size:12px;color:var(--gold);white-space:nowrap}

/* nav */
.nav{display:flex;justify-content:space-between;align-items:center;margin-top:26px;gap:12px}
.ghost{background:none;border:none;color:rgba(244,239,228,.55);font-family:inherit;
  font-size:15px;cursor:pointer;padding:8px 4px}
.ghost:hover{color:var(--paper)}

/* result */
.big-number{text-align:center;margin:8px 0 4px}
.bn-num{display:block;font-family:'Fraunces',serif;font-weight:900;
  font-size:clamp(56px,13vw,108px);line-height:.9;color:var(--gold);letter-spacing:-.03em}
.bn-unit{display:block;font-family:'Fraunces',serif;font-style:italic;font-size:22px;color:var(--paper);margin-top:6px}
.bn-context{text-align:center;color:rgba(244,239,228,.65);font-size:15px;margin-bottom:18px}
.bn-context strong{color:var(--paper)}
.bn-blended{text-align:center;color:rgba(244,239,228,.7);font-size:14px;line-height:1.5;
  max-width:440px;margin:2px auto 14px}
.bn-blended strong{color:var(--gold);font-family:'DM Mono',monospace}
.bn-blended em{font-style:italic;color:var(--paper)}
.blended-info{background:none;border:none;color:var(--gold);font-family:inherit;font-size:13px;
  cursor:pointer;text-decoration:underline;text-underline-offset:2px;margin-left:6px;padding:0}
.amplify-note{text-align:center;font-size:13px;line-height:1.55;color:rgba(244,239,228,.6);
  font-style:italic;max-width:440px;margin:-8px auto 18px}
.hypo{color:var(--rose);font-style:italic;font-size:13px}

/* info icon + footprint panel */
.result-head{display:flex;align-items:center;justify-content:center;gap:10px;position:relative}
.info-btn{position:absolute;right:0;top:-2px;width:30px;height:30px;border-radius:50%;
  background:rgba(244,239,228,.06);border:1px solid var(--line);color:rgba(244,239,228,.7);
  font-size:15px;cursor:pointer;transition:.15s;display:flex;align-items:center;justify-content:center}
.info-btn:hover{background:rgba(244,239,228,.12);color:var(--paper);border-color:rgba(217,164,65,.5)}
.footprint{background:rgba(201,111,91,.08);border:1px solid rgba(201,111,91,.25);
  border-radius:16px;padding:18px 18px 16px;margin-bottom:22px;animation:fadeUp .3s both}
.fp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.fp-title{font-family:'Fraunces',serif;font-weight:600;font-size:17px;color:var(--paper)}
.fp-close{background:none;border:none;color:rgba(244,239,228,.5);font-size:15px;cursor:pointer;padding:2px 6px}
.fp-close:hover{color:var(--paper)}
.fp-intro{font-size:13.5px;line-height:1.55;color:rgba(244,239,228,.75);margin-bottom:14px}
.fp-intro strong{color:var(--paper)}
.fp-rows{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
.fp-row{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:11px;
  background:rgba(244,239,228,.04)}
.fp-emoji{font-size:21px}
.fp-count{font-family:'Fraunces',serif;font-weight:600;font-size:16px;flex:1}
.fp-desc{font-size:12px;color:rgba(244,239,228,.55)}
.fp-foot{font-size:12.5px;font-style:italic;color:rgba(244,239,228,.6);line-height:1.5}

/* starting-line (no action selected) */
.start-h{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(24px,4vw,30px);
  text-align:center;letter-spacing:-.01em;margin-bottom:12px}
.start-sub{text-align:center;color:rgba(244,239,228,.75);font-size:15px;line-height:1.6;
  max-width:460px;margin:0 auto 22px}
.start-sub strong{color:var(--paper)}
.start-none{text-align:center;font-size:15px;line-height:1.6;max-width:440px;margin:0 auto 22px}
.start-rows{margin-bottom:22px}
.start-cta-box{background:rgba(217,164,65,.08);border:1px solid rgba(217,164,65,.28);
  border-radius:18px;padding:18px;text-align:center}
.start-cta-label{font-family:'Fraunces',serif;font-style:italic;font-size:16px;
  color:rgba(244,239,228,.9);margin-bottom:14px}
.start-cta{width:100%;display:flex;align-items:center;gap:14px;padding:15px 16px;
  background:rgba(244,239,228,.05);border:1.5px solid rgba(217,164,65,.4);border-radius:14px;
  cursor:pointer;color:var(--paper);font-family:inherit;text-align:left;transition:.18s}
.start-cta:hover{background:rgba(217,164,65,.14);transform:translateY(-2px)}
.start-cta-emoji{font-size:28px;flex-shrink:0}
.start-cta-text{display:flex;flex-direction:column;gap:2px;flex:1}
.start-cta-title{font-family:'Fraunces',serif;font-weight:600;font-size:18px}
.start-cta-blurb{font-size:13px;color:rgba(244,239,228,.65)}
.start-cta-arrow{font-size:20px;color:var(--gold);flex-shrink:0}
.start-or{margin-top:12px;font-size:13px;color:rgba(244,239,228,.6)}
.link-btn.inline{margin:0}

.segment-note{background:rgba(91,122,74,.16);border-left:3px solid var(--moss);
  padding:14px 16px;border-radius:0 12px 12px 0;font-size:15px;line-height:1.5;
  color:rgba(244,239,228,.9);margin-bottom:22px}

.scrub-row{display:flex;flex-direction:column;gap:14px;margin-bottom:22px}
.scrub label{display:block;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;
  text-transform:uppercase;color:rgba(244,239,228,.5);margin-bottom:8px}
.chip-row{display:flex;flex-wrap:wrap;gap:7px}
.chip{font-family:'DM Mono',monospace;font-size:12px;padding:7px 12px;border-radius:30px;
  background:rgba(244,239,228,.05);border:1px solid var(--line);color:rgba(244,239,228,.7);cursor:pointer;transition:.15s}
.chip:hover{border-color:rgba(217,164,65,.4)}
.chip-on{background:var(--gold);border-color:var(--gold);color:var(--ink);font-weight:500}

.impact-grid{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
.impact-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;
  background:rgba(244,239,228,.04);border:1px solid var(--line);
  animation:fadeUp .4s both}
.impact-card.lives{border-left:3px solid var(--gold)}
.impact-card.welfare{border-left:3px solid var(--moss)}
.ic-emoji{font-size:28px}
.ic-body{flex:1;display:flex;flex-direction:column}
.ic-count{font-family:'Fraunces',serif;font-weight:600;font-size:18px}
.ic-kind{font-size:13px;color:rgba(244,239,228,.6)}
.ic-tag{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;padding:4px 8px;border-radius:20px}
.ic-tag.lives{background:rgba(217,164,65,.2);color:var(--gold)}
.ic-tag.welfare{background:rgba(91,122,74,.25);color:#a7c98e}
.rank-note{font-size:13px;color:rgba(244,239,228,.55);line-height:1.5;margin-bottom:24px;font-style:italic}
.muted{color:rgba(244,239,228,.5)}.small{font-size:13px}
.tiny{font-size:11.5px;line-height:1.5;margin:6px 0}

/* moral */
.moral{border-top:1px solid var(--line);padding-top:18px;margin-bottom:22px}
.moral-toggle{background:none;border:none;color:var(--gold);font-family:'Fraunces',serif;
  font-style:italic;font-size:16px;cursor:pointer;text-align:left}
.moral-body{margin-top:14px;animation:fadeUp .3s both}
.wslider{display:flex;align-items:center;gap:12px;margin:11px 0}
.wlabel{font-size:13px;width:140px;flex-shrink:0;color:rgba(244,239,228,.8)}
.wval{font-family:'DM Mono',monospace;font-size:12px;color:var(--gold);width:110px;text-align:right;flex-shrink:0}
.brave-toggle{background:none;border:none;color:var(--rose);font-family:'Fraunces',serif;
  font-style:italic;font-size:14px;cursor:pointer;text-align:left;margin-top:14px;display:block}
.brave-body{background:rgba(201,111,91,.08);border:1px solid rgba(201,111,91,.22);
  border-radius:12px;padding:12px 14px;margin-top:8px;animation:fadeUp .3s both}
.link-btn{background:none;border:none;color:rgba(244,239,228,.55);text-decoration:underline;
  font-family:inherit;font-size:13px;cursor:pointer;margin-top:8px}
.link-btn:hover{color:var(--paper)}

/* save */
.share-box{background:rgba(244,239,228,.04);border:1px solid var(--line);border-radius:18px;padding:22px;text-align:center}
.share-invite{font-family:'Fraunces',serif;font-style:italic;font-size:17px;color:rgba(244,239,228,.85);margin-bottom:16px;line-height:1.4}
.share-card{background:linear-gradient(135deg,#3f5a32,#5b7a4a);border-radius:16px;padding:26px 22px;animation:fadeUp .4s both}
.sc-brand{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.1em;opacity:.75;margin-bottom:12px}
.sc-flock{font-size:26px;line-height:1.35;letter-spacing:2px;white-space:pre-line;margin-bottom:12px}
.sc-big{font-family:'Fraunces',serif;font-weight:600;font-size:18px;line-height:1.3;margin:6px 0 14px}
.sc-foot{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;opacity:.7}
.share-btn{display:block;width:100%;margin-top:14px;padding:15px 24px;background:var(--gold);color:var(--ink);border:none;border-radius:50px;font-family:'Fraunces',serif;font-weight:600;font-size:17px;cursor:pointer;transition:transform .2s,box-shadow .2s;box-shadow:0 6px 20px rgba(217,164,65,.28)}
.share-btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(217,164,65,.4)}
.share-btn:active{transform:translateY(0)}
.privacy-note{font-size:11.5px;color:rgba(244,239,228,.4);text-align:center;margin:14px auto 4px;font-style:italic;max-width:420px;line-height:1.5}
.method-link{text-align:center;margin-top:6px;font-size:13px}
.method-link a{color:var(--gold);text-decoration:underline;text-underline-offset:3px}

@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:520px){
  .panel{padding:26px 18px 22px}
  /* On phones, let the slider row wrap: label + slider on line 1,
     value on line 2 right-aligned. Keeps the numeric value visible. */
  .wslider{flex-wrap:wrap;gap:8px 12px}
  .wlabel{width:auto;flex:1;min-width:0}
  .wslider input[type="range"]{flex:1 1 100%;order:2;min-width:0}
  .wval{width:auto;flex:0 0 auto;order:1;text-align:right}
}
    `}</style>
  );
}
