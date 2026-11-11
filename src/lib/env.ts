export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isSupabaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
}

export function getVisionServiceUrl(): string {
  return process.env.VISION_SERVICE_URL?.trim() || "http://127.0.0.1:8000";
}

export function isGoogleAuthEnabled(): boolean {
  return isSupabaseClientConfigured() && process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";
}

export function getAuthSecret(): string {
  return (
    process.env.RETAILENS_AUTH_SECRET ||
    "retailens-local-dev-signing-secret-do-not-use-in-prod-32chars"
  );
}

