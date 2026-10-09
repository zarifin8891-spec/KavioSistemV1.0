revoke execute on function public.kavio_can_action(text) from anon;
revoke execute on function public.kavio_get_current_access() from anon;
revoke execute on function public.kavio_get_current_access_context() from anon;
revoke execute on function public.kavio_is_manager() from anon;
revoke execute on function public.kavio_list_users() from anon;
revoke execute on function public.kavio_upsert_user_profile(uuid,text,text,boolean) from anon;

revoke execute on function public.kavio_guard_last_manager() from anon;
revoke execute on function public.kavio_guard_last_manager() from authenticated;
