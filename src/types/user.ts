/** App user shape (compatible with Firebase Auth and Supabase Auth). */
export type AppUser = {
  uid: string
  displayName: string | null
  email?: string | null
}
