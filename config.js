/* ============================================================
   CONFIG — this is the only file you need to edit.
   Replace the three PASTE_... values. Follow SETUP.md.
   Leaving a value as-is just turns that feature off; the app
   still works fully offline without any of them.
   ============================================================ */

window.CONFIG = {

  // ---- 1. Cloud sync (Supabase) — lets you log on your phone and see it on your Mac.
  //    SETUP.md step 2. Both values are safe to make public; they are designed for browsers.
  SUPABASE_URL:      "PASTE_SUPABASE_URL_HERE",
  SUPABASE_ANON_KEY: "PASTE_SUPABASE_ANON_KEY_HERE",

  // ---- 2. Big food database (USDA FoodData Central) — free API key, arrives by email in seconds.
  //    SETUP.md step 3.
  USDA_API_KEY:      "PASTE_USDA_KEY_HERE"

};
