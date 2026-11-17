-- Private Contact Us inbox. This migration does not alter existing application tables.
-- Already applied to ymluyoqkmzxomjokjmkj with explicit authorization. Do not replay.
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254 and email !~ '[[:cntrl:]]'),
  category text not null check (category in ('general','feedback','correction','filming','partnership','other')),
  company text check (char_length(company) <= 160),
  subject text not null check (char_length(btrim(subject)) between 2 and 160 and subject !~ '[[:cntrl:]]'),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  company_location text check (char_length(company_location) <= 200),
  website text check (char_length(website) <= 2048 and website ~ '^https?://'),
  telephone text check (char_length(telephone) <= 40),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  sender_hash text not null check (sender_hash ~ '^[0-9a-f]{64}$'),
  review_status text not null default 'new' check (review_status in ('new','read','closed')),
  notification_status text not null default 'pending'
    check (notification_status in ('pending','sending','accepted','delivered','failed','needs_review')),
  notification_attempts integer not null default 0,
  notification_first_attempt_at timestamptz,
  notification_claimed_at timestamptz,
  notification_error text,
  email_id text,
  created_at timestamptz not null default now(),
  constraint contact_business_fields check (
    category in ('filming','partnership') or
    (company_location is null and website is null and telephone is null)
  )
);
create index contact_submissions_created_at on public.contact_submissions (created_at desc);
create index contact_submissions_sender_recent on public.contact_submissions (sender_hash, created_at desc);
alter table public.contact_submissions enable row level security;
revoke all on table public.contact_submissions from public, anon, authenticated;
grant select, insert, update on table public.contact_submissions to service_role;

-- Service-role-only, atomic intake: no public insert/read policy or privileged RPC.
create function public.accept_contact_submission(
  p_request_id uuid, p_payload_hash text, p_sender_hash text, p_fields jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare existing public.contact_submissions%rowtype; new_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rated420-contact-intake',0));
  select * into existing from public.contact_submissions where request_id=p_request_id;
  if found then
    if existing.payload_hash <> p_payload_hash then return jsonb_build_object('outcome','conflict'); end if;
    return jsonb_build_object('outcome','duplicate','id',existing.id);
  end if;
  if (select count(*) from public.contact_submissions where sender_hash=p_sender_hash and created_at > now()-interval '10 minutes') >= 3
     or (select count(*) from public.contact_submissions where sender_hash=p_sender_hash and created_at > now()-interval '24 hours') >= 10
     or (select count(*) from public.contact_submissions where created_at > now()-interval '1 minute') >= 20 then
    return jsonb_build_object('outcome','rate_limited');
  end if;
  insert into public.contact_submissions(request_id,full_name,email,category,company,subject,message,company_location,website,telephone,payload_hash,sender_hash)
  values(p_request_id,p_fields->>'full_name',p_fields->>'email',p_fields->>'category',p_fields->>'company',
    p_fields->>'subject',p_fields->>'message',p_fields->>'company_location',p_fields->>'website',p_fields->>'telephone',p_payload_hash,p_sender_hash)
  returning id into new_id;
  return jsonb_build_object('outcome','created','id',new_id);
end;
$$;
revoke all on function public.accept_contact_submission(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.accept_contact_submission(uuid,text,text,jsonb) to service_role;

-- A lease prevents concurrent delivery attempts. Never retry beyond Resend's
-- 24-hour deduplication window without manual provider review.
create function public.claim_contact_notification(p_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare claimed public.contact_submissions%rowtype;
begin
  update public.contact_submissions set notification_status='needs_review',notification_error='retry_window_expired'
  where id=p_id and notification_status in ('pending','failed','sending')
    and notification_first_attempt_at < now()-interval '23 hours';
  update public.contact_submissions set notification_status='sending',
    notification_first_attempt_at=coalesce(notification_first_attempt_at,now()),
    notification_claimed_at=now(),notification_attempts=notification_attempts+1,notification_error=null
  where id=p_id and notification_status in ('pending','failed','sending')
    and (notification_claimed_at is null or notification_claimed_at < now()-interval '2 minutes')
  returning * into claimed;
  if not found then return null; end if;
  return to_jsonb(claimed);
end;
$$;
revoke all on function public.claim_contact_notification(uuid) from public,anon,authenticated;
grant execute on function public.claim_contact_notification(uuid) to service_role;
