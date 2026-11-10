-- Christmas Wishes: isolated public message board. No visitor account required.
create table if not exists public.christmas_wishes (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 24),
  message text not null check (char_length(message) between 2 and 280),
  card_style text not null default 'cranberry'
    check (card_style in ('cranberry','fir','snow','midnight')),
  ornament text not null default 'star'
    check (ornament in ('star','bell','gift','snowflake','heart','candy')),
  light_count integer not null default 0 check (light_count>=0),
  ip_hash text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists christmas_wishes_visible_new_idx
  on public.christmas_wishes(created_at desc,id desc) where not is_hidden;
create index if not exists christmas_wishes_visible_lights_idx
  on public.christmas_wishes(light_count desc,created_at desc) where not is_hidden;
create index if not exists christmas_wishes_ip_recent_idx
  on public.christmas_wishes(ip_hash,created_at desc);

create table if not exists public.christmas_lights (
  wish_id uuid not null references public.christmas_wishes(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  primary key(wish_id,ip_hash)
);
create index if not exists christmas_lights_ip_recent_idx
  on public.christmas_lights(ip_hash,created_at desc);

alter table public.christmas_wishes enable row level security;
alter table public.christmas_lights enable row level security;
revoke all on public.christmas_wishes from public, anon, authenticated;
revoke all on public.christmas_lights from public, anon, authenticated;

-- Only privileged Edge Function may call these. Advisory lock makes cooldown atomic.
create or replace function public.christmas_post_wish(
  p_name text,p_message text,p_style text,p_ornament text,p_ip_hash text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_name text := btrim(coalesce(p_name,''));
  v_message text := btrim(coalesce(p_message,''));
  v_count integer;
  v public.christmas_wishes%rowtype;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_visitor';
  end if;
  if char_length(v_name) not between 1 and 24 then raise exception 'name_length'; end if;
  if char_length(v_message) not between 2 and 280 then raise exception 'message_length'; end if;
  if v_name ~ '[[:cntrl:]]' or v_message ~ '[[:cntrl:]]' then raise exception 'invalid_characters'; end if;
  if v_name ~* '(https?://|www\.)' or v_message ~* '(https?://|www\.|[[:alnum:]_]+@[[:alnum:]_]+\.[[:alpha:]]{2,})'
  then raise exception 'links_not_allowed'; end if;
  if p_style not in ('cranberry','fir','snow','midnight') then raise exception 'invalid_style'; end if;
  if p_ornament not in ('star','bell','gift','snowflake','heart','candy') then raise exception 'invalid_ornament'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_ip_hash)::bigint);
  if exists (select 1 from public.christmas_wishes
             where ip_hash=p_ip_hash and created_at > now()-interval '60 seconds') then
    raise exception 'posting_cooldown';
  end if;
  select count(*) into v_count from public.christmas_wishes
    where ip_hash=p_ip_hash and created_at>now()-interval '24 hours';
  if v_count>=15 then raise exception 'daily_limit'; end if;
  if exists(select 1 from public.christmas_wishes where ip_hash=p_ip_hash
     and display_name=v_name and message=v_message
     and created_at>now()-interval '24 hours') then
     raise exception 'duplicate_message';
  end if;

  insert into public.christmas_wishes(display_name,message,card_style,ornament,ip_hash)
  values(v_name,v_message,p_style,p_ornament,p_ip_hash) returning * into v;

  return jsonb_build_object(
    'id',v.id,'name',v.display_name,'message',v.message,'style',v.card_style,
    'ornament',v.ornament,'lights',v.light_count,'createdAt',v.created_at
  );
end
$$;

create or replace function public.christmas_light_wish(
  p_wish_id uuid,p_ip_hash text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_added integer;
  v_lights integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_visitor'; end if;
  if not exists(select 1 from public.christmas_wishes where id=p_wish_id and not is_hidden) then
    raise exception 'wish_not_found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_ip_hash)::bigint);
  if (select count(*) from public.christmas_lights
      where ip_hash=p_ip_hash and created_at>now()-interval '24 hours') >= 80 then
      raise exception 'light_limit';
  end if;

  insert into public.christmas_lights(wish_id,ip_hash)
  values(p_wish_id,p_ip_hash) on conflict do nothing;
  get diagnostics v_added = row_count;
  if v_added>0 then
    update public.christmas_wishes set light_count=light_count+1
    where id=p_wish_id and not is_hidden returning light_count into v_lights;
  else
    select light_count into v_lights from public.christmas_wishes where id=p_wish_id;
  end if;
  return jsonb_build_object('lights',v_lights,'added',v_added>0);
end
$$;

revoke execute on function public.christmas_post_wish(text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.christmas_light_wish(uuid,text) from public,anon,authenticated;
grant execute on function public.christmas_post_wish(text,text,text,text,text) to service_role;
grant execute on function public.christmas_light_wish(uuid,text) to service_role;


create table if not exists public.christmas_reports (
  wish_id uuid not null references public.christmas_wishes(id) on delete cascade,
  ip_hash text not null,
  reason text not null check(reason in ('spam','inappropriate','personal_info','other')),
  created_at timestamptz not null default now(),
  primary key(wish_id,ip_hash)
);
create index if not exists christmas_reports_recent_idx on public.christmas_reports(created_at desc);
alter table public.christmas_reports enable row level security;
revoke all on public.christmas_reports from public,anon,authenticated;

create or replace function public.christmas_board_stats()
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'wishes',count(*),
    'lights',coalesce(sum(light_count),0),
    'today',count(*) filter(where created_at>=now()-interval '24 hours')
  ) from public.christmas_wishes where not is_hidden
$$;
revoke execute on function public.christmas_board_stats() from public,anon,authenticated;
grant execute on function public.christmas_board_stats() to service_role;
