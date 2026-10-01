-- Every action that moves money or changes an order runs here, on the server, with checks.
-- private.* functions do the work (security definer, not reachable through the API);
-- public.* wrappers are what the app calls (security invoker, signed-in users only).

create sequence private.order_code_seq start 2001;

create or replace function private.me_locked()
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.'; end if;
  select * into p from public.profiles where id = (select auth.uid()) for update;
  if not found then raise exception 'Finish setting up your account first.'; end if;
  return p;
end $$;

create or replace function private.hist(h jsonb, st text)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(h, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', st, 'at', now()))
$$;

-- Creator: place an order, paid with credits.
create or replace function private.place_order(p_type text, p_addons text[], p_title text, p_brief text, p_footage text, p_checklist jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles; et public.edit_types; adds text[]; add_credits int; add_pay int; n_valid int;
  total int; pay int; hrs int; bal int; v_code text; v_id bigint;
begin
  me := private.me_locked();
  if me.role <> 'creator' then raise exception 'Only creators can place orders.'; end if;
  if me.kyc_status <> 'verified' then raise exception 'Complete KYC before placing an order.'; end if;
  select * into et from public.edit_types where id = p_type;
  if not found then raise exception 'Unknown edit type.'; end if;
  adds := array(select distinct unnest(coalesce(p_addons, '{}')));
  select count(*), coalesce(sum(credits), 0), coalesce(sum(editor_pay_inr), 0) into n_valid, add_credits, add_pay
    from public.addons where id = any(adds);
  if n_valid <> coalesce(array_length(adds, 1), 0) then raise exception 'Unknown add-on.'; end if;
  total := et.credits + add_credits;
  pay := et.editor_pay_inr + add_pay;
  hrs := case when 'express' = any(adds) then 12 else et.hours end;
  select coalesce(sum(delta), 0) into bal from public.credit_ledger where user_id = me.id;
  if bal < total then raise exception 'Not enough credits. You need % more.', total - bal; end if;
  v_code := 'QC-' || nextval('private.order_code_seq');
  insert into public.orders (code, creator_id, edit_type, addons, credits, editor_pay_inr, status, deadline, title, brief_text, footage, checklist,
                             creator_name, creator_handle, creator_lang, history)
  values (v_code, me.id, et.id, adds, total, pay, 'placed', now() + make_interval(hours => hrs), left(coalesce(nullif(trim(p_title), ''), et.name), 120),
          left(p_brief, 3000), left(coalesce(p_footage, 'raw_footage.mp4'), 200), p_checklist, me.full_name, me.handle, me.lang, private.hist(null, 'paid'))
  returning id into v_id;
  insert into public.credit_ledger (user_id, delta, reason, order_id, note) values (me.id, -total, 'order', v_id, v_code || ' · ' || et.name);
  return v_code;
end $$;

-- Editor: take an open job.
create or replace function private.accept_job(p_order bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := private.me_locked();
  if me.role <> 'editor' then raise exception 'Only editors can take jobs.'; end if;
  if me.kyc_status <> 'verified' then raise exception 'Your KYC must be approved before you take jobs.'; end if;
  if coalesce(me.editor_status, 'active') <> 'active' then raise exception 'Your editor account is paused.'; end if;
  update public.orders set editor_id = me.id, status = 'in_progress', editor_name = me.full_name, editor_city = me.city,
         editor_rating = me.rating, history = private.hist(history, 'editing')
   where id = p_order and status = 'placed' and editor_id is null;
  if not found then raise exception 'Another editor already took this job.'; end if;
end $$;

-- Editor: deliver.
create or replace function private.deliver_job(p_order bigint, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_url !~ '^https?://\S+\.\S+' or char_length(p_url) > 500 then raise exception 'Add a valid delivery link.'; end if;
  update public.orders set status = 'review', delivery_url = p_url, history = private.hist(history, 'review')
   where id = p_order and editor_id = (select auth.uid()) and status in ('in_progress', 'revision');
  if not found then raise exception 'This job cannot be delivered right now.'; end if;
end $$;

-- Editor: tick a step on the job checklist.
create or replace function private.toggle_step(p_order bigint, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_key !~ '^[a-z][0-9]{1,2}$' then raise exception 'Bad step.'; end if;
  update public.orders set done = jsonb_set(done, array[p_key], to_jsonb(not coalesce((done ->> p_key)::boolean, false)))
   where id = p_order and editor_id = (select auth.uid()) and status in ('in_progress', 'revision', 'review');
end $$;

-- Creator: approve, rate, and pay the editor.
create or replace function private.approve_delivery(p_order bigint, p_stars int)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders; s int := greatest(1, least(5, coalesce(p_stars, 5)));
begin
  update public.orders set status = 'completed', stars = s, done_at = now(), history = private.hist(history, 'completed')
   where id = p_order and creator_id = (select auth.uid()) and status = 'review'
   returning * into o;
  if not found then raise exception 'This order is not waiting for your review.'; end if;
  insert into public.earnings (editor_id, order_id, amount_inr) values (o.editor_id, o.id, o.editor_pay_inr);
  update public.profiles set rating = round(((rating * ratings) + s) / (ratings + 1)::numeric, 2), ratings = ratings + 1
   where id = o.editor_id;
end $$;

-- Creator: ask for a revision.
create or replace function private.ask_revision(p_order bigint, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_note), '') = '' then raise exception 'Say what should change.'; end if;
  update public.orders set status = 'revision', revisions = revisions + 1, revision_note = left(p_note, 600), history = private.hist(history, 'revision')
   where id = p_order and creator_id = (select auth.uid()) and status = 'review';
  if not found then raise exception 'This order is not waiting for your review.'; end if;
end $$;

-- Creator or editor on the order: send a message.
create or replace function private.send_message(p_order bigint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders; r text;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'Order not found.'; end if;
  r := case when o.creator_id = (select auth.uid()) then 'creator' when o.editor_id = (select auth.uid()) then 'editor'
            when private.is_admin() then 'admin' end;
  if r is null then raise exception 'You are not part of this order.'; end if;
  insert into public.order_messages (order_id, sender_id, sender_role, body) values (p_order, (select auth.uid()), r, left(trim(p_body), 1000));
end $$;

-- Editor: request a payout of everything available.
create or replace function private.request_payout()
returns numeric language plpgsql security definer set search_path = '' as $$
declare me public.profiles; earned numeric; taken numeric; avail numeric;
begin
  me := private.me_locked();
  if me.role <> 'editor' then raise exception 'Only editors get payouts.'; end if;
  if me.kyc_status <> 'verified' or coalesce(me.upi_id, '') = '' then raise exception 'Complete KYC with your UPI ID to receive payouts.'; end if;
  select coalesce(sum(amount_inr), 0) into earned from public.earnings where editor_id = me.id;
  select coalesce(sum(amount_inr), 0) into taken from public.payouts where editor_id = me.id and status <> 'failed';
  avail := earned - taken;
  if avail < 500 then raise exception 'Minimum payout is Rs 500.'; end if;
  insert into public.payouts (editor_id, amount_inr) values (me.id, avail);
  return avail;
end $$;

-- Anyone signed in: submit KYC details (only the document type and last characters are stored).
create or replace function private.submit_kyc(p_region text, p_doc_type text, p_doc_last4 text, p_pan_last4 text, p_upi text, p_legal_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare me public.profiles;
begin
  me := private.me_locked();
  if me.kyc_status in ('pending', 'verified') then raise exception 'Your KYC is already %.', me.kyc_status; end if;
  if coalesce(trim(p_legal_name), '') = '' then raise exception 'Enter your legal name.'; end if;
  update public.profiles set kyc_status = 'pending', region = case when p_region in ('IN', 'GLOBAL') then p_region else region end,
         kyc_doc_type = left(p_doc_type, 40), kyc_doc_last4 = left(p_doc_last4, 12), kyc_pan_last4 = left(p_pan_last4, 12),
         kyc_upi = left(p_upi, 80), kyc_legal_name = left(trim(p_legal_name), 120), kyc_submitted_at = now(), kyc_note = null
   where id = me.id;
end $$;

create or replace function private.request_deletion()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.'; end if;
  insert into public.deletion_requests (user_id)
  select (select auth.uid()) where not exists (select 1 from public.deletion_requests where user_id = (select auth.uid()) and status = 'requested');
end $$;

-- ---------- admin ----------
create or replace function private.need_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
end $$;

create or replace function private.admin_assign(p_order bigint, p_editor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.profiles;
begin
  perform private.need_admin();
  select * into e from public.profiles where id = p_editor and role = 'editor' and kyc_status = 'verified';
  if not found then raise exception 'Pick a verified editor.'; end if;
  update public.orders set editor_id = e.id, editor_name = e.full_name, editor_city = e.city, editor_rating = e.rating,
         status = 'in_progress', history = private.hist(history, 'editing')
   where id = p_order and status in ('placed', 'in_progress', 'revision');
  if not found then raise exception 'This order cannot be reassigned.'; end if;
end $$;

create or replace function private.admin_refund(p_order bigint, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  perform private.need_admin();
  update public.orders set status = 'refunded', refund_reason = left(p_reason, 200), history = private.hist(history, 'refunded')
   where id = p_order and status not in ('completed', 'refunded') returning * into o;
  if not found then raise exception 'This order cannot be refunded.'; end if;
  insert into public.credit_ledger (user_id, delta, reason, order_id, note) values (o.creator_id, o.credits, 'refund', o.id, o.code || ' refund');
end $$;

create or replace function private.admin_review_kyc(p_user uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  update public.profiles set kyc_status = case when p_approve then 'verified' else 'rejected' end, kyc_reviewed_at = now(),
         kyc_note = left(p_note, 200), upi_id = case when p_approve and role = 'editor' and kyc_upi is not null then kyc_upi else upi_id end,
         editor_status = case when p_approve and role = 'editor' then coalesce(editor_status, 'active') else editor_status end
   where id = p_user and kyc_status = 'pending';
  if not found then raise exception 'No pending KYC for this person.'; end if;
end $$;

create or replace function private.admin_grant_credits(p_user uuid, p_credits int, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_credits is null or p_credits <= 0 or p_credits > 50000 then raise exception 'Credits must be between 1 and 50,000.'; end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'creator') then raise exception 'Creator not found.'; end if;
  insert into public.credit_ledger (user_id, delta, reason, note) values (p_user, p_credits, 'bonus', left(coalesce(p_note, 'Bonus from QuiCut'), 200));
end $$;

create or replace function private.admin_pay_payout(p_payout bigint, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if coalesce(trim(p_reference), '') = '' then raise exception 'Add the UPI transfer reference.'; end if;
  update public.payouts set status = 'paid', paid_at = now(), reference = left(trim(p_reference), 80)
   where id = p_payout and status in ('requested', 'processing');
  if not found then raise exception 'This payout is not waiting.'; end if;
end $$;

create or replace function private.admin_set_editor_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_status not in ('active', 'paused', 'removed') then raise exception 'Bad status.'; end if;
  update public.profiles set editor_status = p_status where id = p_user and role = 'editor';
end $$;

create or replace function private.admin_complete_deletion(p_request bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  perform private.need_admin();
  update public.deletion_requests set status = 'done', done_at = now() where id = p_request and status = 'requested' returning user_id into uid;
  if not found then raise exception 'Request not found.'; end if;
  update public.profiles set full_name = 'Deleted user', phone = null, handle = null, upi_id = null, kyc_status = 'none',
         kyc_doc_type = null, kyc_doc_last4 = null, kyc_pan_last4 = null, kyc_upi = null, kyc_legal_name = null
   where id = uid;
end $$;

-- Lock down the private functions; only the wrappers below may call them.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname not in ('is_admin', 'is_active_editor') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- ---------- public wrappers (what the app calls via /rest/v1/rpc/...) ----------
create function public.place_order(p_type text, p_addons text[], p_title text, p_brief text, p_footage text, p_checklist jsonb)
  returns text language sql security invoker set search_path = '' as $$ select private.place_order(p_type, p_addons, p_title, p_brief, p_footage, p_checklist) $$;
create function public.accept_job(p_order bigint) returns void language sql security invoker set search_path = '' as $$ select private.accept_job(p_order) $$;
create function public.deliver_job(p_order bigint, p_url text) returns void language sql security invoker set search_path = '' as $$ select private.deliver_job(p_order, p_url) $$;
create function public.toggle_step(p_order bigint, p_key text) returns void language sql security invoker set search_path = '' as $$ select private.toggle_step(p_order, p_key) $$;
create function public.approve_delivery(p_order bigint, p_stars int) returns void language sql security invoker set search_path = '' as $$ select private.approve_delivery(p_order, p_stars) $$;
create function public.ask_revision(p_order bigint, p_note text) returns void language sql security invoker set search_path = '' as $$ select private.ask_revision(p_order, p_note) $$;
create function public.send_message(p_order bigint, p_body text) returns void language sql security invoker set search_path = '' as $$ select private.send_message(p_order, p_body) $$;
create function public.request_payout() returns numeric language sql security invoker set search_path = '' as $$ select private.request_payout() $$;
create function public.submit_kyc(p_region text, p_doc_type text, p_doc_last4 text, p_pan_last4 text, p_upi text, p_legal_name text)
  returns void language sql security invoker set search_path = '' as $$ select private.submit_kyc(p_region, p_doc_type, p_doc_last4, p_pan_last4, p_upi, p_legal_name) $$;
create function public.request_deletion() returns void language sql security invoker set search_path = '' as $$ select private.request_deletion() $$;
create function public.admin_assign(p_order bigint, p_editor uuid) returns void language sql security invoker set search_path = '' as $$ select private.admin_assign(p_order, p_editor) $$;
create function public.admin_refund(p_order bigint, p_reason text) returns void language sql security invoker set search_path = '' as $$ select private.admin_refund(p_order, p_reason) $$;
create function public.admin_review_kyc(p_user uuid, p_approve boolean, p_note text) returns void language sql security invoker set search_path = '' as $$ select private.admin_review_kyc(p_user, p_approve, p_note) $$;
create function public.admin_grant_credits(p_user uuid, p_credits int, p_note text) returns void language sql security invoker set search_path = '' as $$ select private.admin_grant_credits(p_user, p_credits, p_note) $$;
create function public.admin_pay_payout(p_payout bigint, p_reference text) returns void language sql security invoker set search_path = '' as $$ select private.admin_pay_payout(p_payout, p_reference) $$;
create function public.admin_set_editor_status(p_user uuid, p_status text) returns void language sql security invoker set search_path = '' as $$ select private.admin_set_editor_status(p_user, p_status) $$;
create function public.admin_complete_deletion(p_request bigint) returns void language sql security invoker set search_path = '' as $$ select private.admin_complete_deletion(p_request) $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('place_order','accept_job','deliver_job','toggle_step','approve_delivery','ask_revision',
             'send_message','request_payout','submit_kyc','request_deletion','admin_assign','admin_refund','admin_review_kyc',
             'admin_grant_credits','admin_pay_payout','admin_set_editor_status','admin_complete_deletion') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
