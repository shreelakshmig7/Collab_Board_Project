// Minimal shims so TypeScript tooling can understand Supabase Edge Function files.
// This does not affect runtime behavior in Deno.

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js'
}

