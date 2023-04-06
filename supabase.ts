import { Resource } from 'https://deno.land/x/windmill@v1.85.0/mod.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.14.0'

/**
 * Creates a Supabase client with an authenticated session if possible.
 * @param auth Windmill resource representing Supabase credentials (project URL and API key).
 * @param token Supabase `access_token` and `refresh_token`. `expires_at` is a UNIX timestamp in seconds.
 * @param refresh If `true` then the `refresh_token` will be used to get a new `access_token` without checking expirity.
 * @returns A Supabase client
 */
export async function createSupabaseClient(
  auth: Resource<'supabase'>,
  token?: { access: string; refresh: string; expires_at?: number },
  refresh = false
) {
  const headers = token?.access
    ? {
        global: { headers: { Authorization: `bearer ${token.access}` } },
      }
    : undefined
  let client = createClient(auth.url, auth.key, headers)

  if ((refresh && token) || (token?.expires_at && token.expires_at * 1000 < Date.now())) {
    const { data } = await client.auth.refreshSession({
      refresh_token: token.refresh,
    })
    const newHeaders = data?.session?.access_token
      ? {
          global: {
            headers: { Authorization: `bearer ${data.session.access_token}` },
          },
        }
      : undefined
    client = createClient(auth.url, auth.key, newHeaders)
  }

  return client
}

/**
 * Executes a Supabase query. If possible and needed, refreshes the session and retries once.
 * @param auth Windmill resource representing Supabase credentials (project URL and API key).
 * @param token Supabase `access_token` and `refresh_token`. `expires_at` (optional) is a UNIX timestamp in seconds.
 * @param fn A function that returns a Supabase query.
 * @returns The result of the query.
 */
export async function refreshAndRetryIfExpired(
  auth: Resource<'supabase'>,
  token: { access: string; refresh: string; expires_at?: number } | undefined,
  fn: (client: SupabaseClient) => Promise<{ data: any; error?: any }>
) {
  try {
    const client = await createSupabaseClient(auth, token)
    const query = await fn(client)
    if (query.error?.code === 'PGRST301' && token) {
      const client = await createSupabaseClient(auth, token, true)
      return await fn(client)
    }
    return query
  } catch (error) {
    return error
  }
}
