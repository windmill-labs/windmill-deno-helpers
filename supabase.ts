import { Resource } from 'https://deno.land/x/windmill@v1.85.0/mod.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.14.0'

/**
 * Creates a Supabase client with an authenticated session if possible.
 * @param auth Windmill resource representing Supabase credentials (project URL and API key).
 * @param token Supabase `access_token` and `refresh_token`. `expires_at` is a UNIX timestamp in seconds.
 * @param refresh If `true` then the `refresh_token` will be used to get a new `access_token` without checking expirity.
 * @returns A Supabase client.
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
  const result = {
    client: createClient(auth.url, auth.key, headers),
    token,
  }

  if ((refresh && token) || (token?.expires_at && token.expires_at * 1000 < Date.now())) {
    const { data } = await result.client.auth.refreshSession({
      refresh_token: token.refresh,
    })
    if (data.session) {
      result.token = {
        access: data.session.access_token,
        refresh: data.session.refresh_token,
        expires_at: data.session.expires_in,
      }
    } else {
      result.token = undefined
    }
    const newHeaders = data.session?.access_token
      ? {
          global: {
            headers: { Authorization: `bearer ${data.session.access_token}` },
          },
        }
      : undefined
    result.client = createClient(auth.url, auth.key, newHeaders)
  }

  return result
}

/**
 * Executes a Supabase query. If possible and needed, refreshes the session and retries once.
 * @param auth Windmill resource representing Supabase credentials (project URL and API key).
 * @param token Supabase `access_token` and `refresh_token`. `expires_at` (optional) is a UNIX timestamp in seconds.
 * @param fn A function that returns a Supabase query.
 * @returns The result of the query appended by the used tokens.
 */
export async function refreshAndRetryIfExpired(
  auth: Resource<'supabase'>,
  token: { access: string; refresh: string; expires_at?: number } | undefined,
  fn: (client: SupabaseClient) => Promise<{ data: any; error?: any }>
): Promise<{
  data: any
  error?: any
  token?: { access: string; refresh: string; expires_at?: number }
}> {
  try {
    let supabase = await createSupabaseClient(auth, token)
    let query = await fn(supabase.client)
    if (query.error?.code === 'PGRST301' && token) {
      supabase = await createSupabaseClient(auth, token, true)
      query = await fn(supabase.client)
    }
    return { ...query, token: supabase.token }
  } catch (error) {
    return error
  }
}
