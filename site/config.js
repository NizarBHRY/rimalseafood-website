// ============================================================
// RIMAL SEAFOOD — CONNECTION SETTINGS
// ============================================================
// Fill these in from: Supabase dashboard > Project Settings > API
//   SUPABASE_URL      -> "Project URL"
//   SUPABASE_ANON_KEY -> "anon" "public" key
//                        (NOT the "service_role" key — never put
//                        that one in a website file)
// ============================================================

// NOTE: The Manager Dashboard no longer uses a 4-digit PIN. Since orders
// now contain real customer names and phone numbers in a shared database,
// it requires a real manager login instead (email + password), created in
// Supabase under Authentication > Users. See SETUP-GUIDE.txt, step 4.

window.RIMAL_CONFIG = {
  SUPABASE_URL: "https://efdclcbhsvlnvmjfqnin.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_rDbVVk0PEbIr4gcnxG0fKQ_CZO3UfoN"
};
