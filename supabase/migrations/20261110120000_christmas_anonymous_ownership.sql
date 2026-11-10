
-- Anonymous ownership: a 256-bit secret is kept only on the posting device.
-- Database stores its SHA-256 hash. Existing posts remain visible, but cannot
-- retroactively be claimed without proof of ownership.
alter table public.christmas_wishes
  add column if not exists owner_token_hash text,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create unique index if not exists christmas_wishes_owner_token_hash_idx
  on public.christmas_wishes(owner_token_hash) where owner_token_hash is not null;

create or replace function public.christmas_post_wish_owned(
  p_name text,p_message text,p_style text,p_ornament text,
  p_ip_hash text,p_owner_hash text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_name text:=btrim(coalesce(p_name,''));
  v_message text:=btrim(coalesce(p_message,''));
  v_count integer;
  v public.christmas_wishes%rowtype;
begin
  if p_owner_hash is null or p_owner_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_token'; end if;
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_visitor'; end if;
  if char_length(v_name) not between 1 and 24 then raise exception 'name_length'; end if;
  if char_length(v_message) not between 2 and 280 then raise exception 'message_length'; end if;
  if v_name ~ '[[:cntrl:]]' or replace(replace(replace(v_message,E'\n',''),E'\r',''),E'\t','') ~ '[[:cntrl:]]'
    then raise exception 'invalid_characters'; end if;
  if v_name ~* '(https?://|www\.)' or v_message ~* '(https?://|www\.|[[:alnum:]_]+@[[:alnum:]_]+\.[[:alpha:]]{2,})'
    then raise exception 'links_not_allowed'; end if;
  if p_style not in ('cranberry','fir','snow','midnight') then raise exception 'invalid_style'; end if;
  if p_ornament not in ('star','bell','gift','snowflake','heart','candy') then raise exception 'invalid_ornament'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_ip_hash)::bigint);
  if exists(select 1 from public.christmas_wishes where ip_hash=p_ip_hash and created_at>now()-interval '60 seconds')
    then raise exception 'posting_cooldown'; end if;
  select count(*) into v_count from public.christmas_wishes
    where ip_hash=p_ip_hash and created_at>now()-interval '24 hours';
  if v_count>=15 then raise exception 'daily_limit'; end if;
  if exists(select 1 from public.christmas_wishes where ip_hash=p_ip_hash
    and display_name=v_name and message=v_message and created_at>now()-interval '24 hours')
    then raise exception 'duplicate_message'; end if;

  insert into public.christmas_wishes(display_name,message,card_style,ornament,ip_hash,owner_token_hash)
    values(v_name,v_message,p_style,p_ornament,p_ip_hash,p_owner_hash)
    returning * into v;
  return jsonb_build_object('id',v.id,'name',v.display_name,'message',v.message,
    'style',v.card_style,'ornament',v.ornament,'lights',v.light_count,'createdAt',v.created_at);
end;
$$;

create or replace function public.christmas_delete_own_wish(
  p_id uuid,p_owner_hash text
) returns boolean language plpgsql security invoker set search_path=''
as $$
declare v_rows integer;
begin
  if p_owner_hash is null or p_owner_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_token'; end if;
  update public.christmas_wishes
    set is_hidden=true,deleted_at=now()
    where id=p_id and owner_token_hash=p_owner_hash and not is_hidden;
  get diagnostics v_rows = row_count;
  return v_rows=1;
end;
$$;

create or replace function public.christmas_edit_own_wish(
  p_id uuid,p_owner_hash text,p_name text,p_message text,p_style text,p_ornament text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_name text:=btrim(coalesce(p_name,''));
 v_message text:=btrim(coalesce(p_message,''));
 v public.christmas_wishes%rowtype;
begin
 if p_owner_hash is null or p_owner_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_token'; end if;
 if char_length(v_name) not between 1 and 24 then raise exception 'name_length'; end if;
 if char_length(v_message) not between 2 and 280 then raise exception 'message_length'; end if;
 if v_name ~ '[[:cntrl:]]' or replace(replace(replace(v_message,E'\n',''),E'\r',''),E'\t','') ~ '[[:cntrl:]]'
    then raise exception 'invalid_characters'; end if;
 if v_name ~* '(https?://|www\.)' or v_message ~* '(https?://|www\.|[[:alnum:]_]+@[[:alnum:]_]+\.[[:alpha:]]{2,})'
    then raise exception 'links_not_allowed'; end if;
 if p_style not in ('cranberry','fir','snow','midnight') then raise exception 'invalid_style'; end if;
 if p_ornament not in ('star','bell','gift','snowflake','heart','candy') then raise exception 'invalid_ornament'; end if;
 update public.christmas_wishes set display_name=v_name,message=v_message,card_style=p_style,
    ornament=p_ornament,edited_at=now()
   where id=p_id and owner_token_hash=p_owner_hash and not is_hidden
   returning * into v;
 if v.id is null then raise exception 'owner_mismatch'; end if;
 return jsonb_build_object('id',v.id,'name',v.display_name,'message',v.message,
   'style',v.card_style,'ornament',v.ornament,'lights',v.light_count,
   'createdAt',v.created_at,'editedAt',v.edited_at);
end;
$$;

revoke execute on function public.christmas_post_wish_owned(text,text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.christmas_delete_own_wish(uuid,text) from public,anon,authenticated;
revoke execute on function public.christmas_edit_own_wish(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.christmas_post_wish_owned(text,text,text,text,text,text) to service_role;
grant execute on function public.christmas_delete_own_wish(uuid,text) to service_role;
grant execute on function public.christmas_edit_own_wish(uuid,text,text,text,text,text) to service_role;
