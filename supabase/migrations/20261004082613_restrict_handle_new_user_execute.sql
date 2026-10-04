-- Supabase grants EXECUTE directly to API roles even after PUBLIC is revoked.
-- Keep the auth.users trigger, but remove direct Data API access to its definer function.
revoke execute on function public.handle_new_user() from anon, authenticated;
