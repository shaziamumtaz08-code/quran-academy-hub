// Get allowed origin from environment or fallback to the Lovable preview domain
const getAllowedOrigin = (): string => {
  // In production, set ALLOWED_ORIGIN environment variable
  const envOrigin = Deno.env.get("ALLOWED_ORIGIN");
  if (envOrigin) return envOrigin;
  
  // Default to Lovable preview domain pattern
  const projectId = Deno.env.get("SUPABASE_PROJECT_REF") || "sienlnxwwdqnybugipdt";
  return `https://${projectId}.lovableproject.com`;
};

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": getAllowedOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to create CORS headers for dynamic origin validation
export const getCorsHeaders = (requestOrigin?: string | null): Record<string, string> => {
  const allowedOrigin = getAllowedOrigin();
  
  // Check if request origin matches allowed pattern
  if (requestOrigin) {
    // Allow lovableproject.com subdomains and localhost for development
    const isAllowed = 
      requestOrigin.endsWith('.lovableproject.com') ||
      requestOrigin.includes('localhost') ||
      requestOrigin === allowedOrigin;
    
    if (isAllowed) {
      return {
        "Access-Control-Allow-Origin": requestOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      };
    }
  }
  
  return corsHeaders;
};
