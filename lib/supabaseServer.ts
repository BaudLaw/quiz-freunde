import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

function getSupabaseServerClient() {
  if (serverClient) {
    return serverClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?.trim()
    .replace(/^["']|["']$/g, "");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server API writes."
    );
  }

  serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serverClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseServerClient();
    const value = client[prop as keyof SupabaseClient];

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});
