-- MYSHORT: COMPLETE DEPOSIT -> AI-MAX -> DAILY REWARD -> REFERRAL FLOW
-- Jalankan SETELAH supabase_schema_secure.sql / migration sebelumnya.
-- Semua nominal dan waktu penting ditentukan oleh database.

begin;

-- Tidak ada bonus referral saat pendaftaran. Referral baru hanya tercatat sebagai registered.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  ref text; referrer uuid; new_username text; new_code text;
begin
  new_username := public.generate_unique_username(new.raw_user_meta_data->>'username', new.email);
  new_code := public.generate_referral_code(new_username);
  ref := upper(nullif(trim(new.raw_user_meta_data->>'referred_by_code'),''));
  insert into public.profiles(id,username,full_name,email,phone,referral_code,referred_by_code)
  values(new.id,new_username,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'Member'),new.email,new.raw_user_meta_data->>'phone',new_code,ref)
  on conflict(id) do update set email=excluded.email,updated_at=now();
  insert into public.wallets(user_id) values(new.id) on conflict(user_id) do nothing;
  if ref is not null then
    select id into referrer from public.profiles where upper(referral_code)=ref and id<>new.id limit 1;
    if referrer is not null then
      insert into public.referrals(referrer_id,referred_id,referral_code,status,reward)
      values(referrer,new.id,ref,'registered',0) on conflict(referred_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Pastikan member tidak dapat mengubah status/nominal deposit melalui tabel langsung.
revoke insert,update,delete on public.deposits from authenticated;
revoke insert,update,delete on public.ai_max_purchases from authenticated;
revoke insert,update,delete on public.ai_max_daily_claims from authenticated;
revoke insert,update,delete on public.referral_reward_claims from authenticated;

-- Request deposit hanya membuat pending. Tidak menambah saldo.
create or replace function public.request_deposit(p_amount numeric,p_method text,p_note text default null)
returns bigint language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); did bigint;
begin
  if uid is null then raise exception 'Belum login'; end if;
  if p_amount < 10000 or p_amount > 10000000 then raise exception 'Nominal deposit Rp10.000 - Rp10.000.000'; end if;
  if coalesce(trim(p_method),'')='' then raise exception 'Metode deposit wajib dipilih'; end if;
  insert into public.deposits(user_id,amount,method,status,admin_note)
  values(uid,p_amount,left(trim(p_method),50),'pending',nullif(left(trim(coalesce(p_note,'')),500),'')) returning id into did;
  return did;
end; $$;

-- Admin approve deposit: hanya transisi pending -> approved yang menambah saldo.
create or replace function public.admin_set_deposit_status(p_id bigint,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare d public.deposits;
begin
  if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Status deposit hanya approved/rejected'; end if;
  select * into d from public.deposits where id=p_id for update;
  if not found then raise exception 'Deposit tidak ditemukan'; end if;
  if d.status <> 'pending' then raise exception 'Deposit sudah diproses dengan status %',d.status; end if;
  if p_status='approved' then
    update public.wallets set balance=balance+d.amount,total_in=total_in+d.amount,updated_at=now() where user_id=d.user_id;
    if not found then raise exception 'Wallet member tidak ditemukan'; end if;
    insert into public.transactions(user_id,type,amount,reference_id,description) values(d.user_id,'deposit',d.amount,d.id,'Deposit disetujui admin');
  end if;
  update public.deposits set status=p_status,admin_note=p_note,processed_at=now() where id=p_id;
end; $$;

-- Pembelian AI-MAX: tepat Rp100.000 dari saldo wallet yang sudah approved.
create or replace function public.purchase_ai_max()
returns bigint language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); pid bigint;
begin
  if uid is null then raise exception 'Belum login'; end if;
  if exists(select 1 from public.ai_max_purchases where user_id=uid and active=true) then raise exception 'AI-MAX Anda masih aktif'; end if;
  perform 1 from public.wallets where user_id=uid for update;
  if not found then raise exception 'Wallet tidak ditemukan'; end if;
  update public.wallets set balance=balance-100000,total_out=total_out+100000,updated_at=now() where user_id=uid and balance>=100000;
  if not found then raise exception 'Saldo tidak mencukupi. Deposit dan tunggu persetujuan admin terlebih dahulu'; end if;
  insert into public.ai_max_purchases(user_id,price,daily_reward,active) values(uid,100000,8000,true) returning id into pid;
  update public.referrals set status='qualified',reward=0 where referred_id=uid;
  insert into public.transactions(user_id,type,amount,reference_id,description) values(uid,'ai_max_purchase',100000,pid,'Pembelian AI-MAX Rp100.000');
  return pid;
end; $$;

-- Hadiah harian: server time Asia/Jakarta, 12:00 sampai sebelum 24:00, satu kali per hari.
create or replace function public.claim_ai_max_daily_reward()
returns numeric language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); local_now timestamp; local_date date; purchase public.ai_max_purchases; claim_id bigint; reward numeric:=8000;
begin
  if uid is null then raise exception 'Belum login'; end if;
  local_now:=timezone('Asia/Jakarta',now()); local_date:=local_now::date;
  if local_now < local_date::timestamp+interval '12 hours' or local_now >= (local_date+1)::timestamp then raise exception 'Hadiah harian hanya dapat diklaim pukul 12.00-24.00 WIB'; end if;
  select * into purchase from public.ai_max_purchases where user_id=uid and active=true order by purchased_at desc limit 1 for update;
  if not found then raise exception 'AI-MAX belum aktif'; end if;
  insert into public.ai_max_daily_claims(user_id,purchase_id,claim_date,amount) values(uid,purchase.id,local_date,reward) on conflict(user_id,claim_date) do nothing returning id into claim_id;
  if claim_id is null then raise exception 'Hadiah hari ini sudah diklaim'; end if;
  update public.wallets set balance=balance+reward,total_in=total_in+reward,updated_at=now() where user_id=uid;
  insert into public.transactions(user_id,type,amount,reference_id,description) values(uid,'ai_max_daily_reward',reward,claim_id,'Hadiah harian AI-MAX');
  update public.profiles set xp=xp+8,updated_at=now() where id=uid;
  return reward;
end; $$;

-- Referral: 3 teman harus email terverifikasi DAN punya pembelian AI-MAX.
create or replace function public.claim_referral_reward()
returns numeric language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cnt integer; reward numeric:=30000;
begin
  if uid is null then raise exception 'Belum login'; end if;
  if exists(select 1 from public.referral_reward_claims where user_id=uid and milestone=3) then raise exception 'Hadiah referral Rp30.000 sudah diklaim'; end if;
  select count(*)::int into cnt from public.referrals r join auth.users u on u.id=r.referred_id where r.referrer_id=uid and r.status='qualified' and u.email_confirmed_at is not null and exists(select 1 from public.ai_max_purchases p where p.user_id=r.referred_id and p.price=100000);
  if cnt<3 then raise exception 'Anda baru memiliki % dari 3 teman yang sudah verifikasi dan membeli AI-MAX',cnt; end if;
  insert into public.referral_reward_claims(user_id,milestone,amount) values(uid,3,reward) on conflict(user_id,milestone) do nothing;
  if not found then raise exception 'Hadiah referral sudah diproses'; end if;
  update public.wallets set balance=balance+reward,total_in=total_in+reward,updated_at=now() where user_id=uid;
  insert into public.transactions(user_id,type,amount,description) values(uid,'referral_reward',reward,'Hadiah referral 3 teman pembeli AI-MAX');
  update public.profiles set xp=xp+30,updated_at=now() where id=uid;
  return reward;
end; $$;

-- Hak RPC.
revoke all on function public.request_deposit(numeric,text,text) from public; grant execute on function public.request_deposit(numeric,text,text) to authenticated;
revoke all on function public.admin_set_deposit_status(bigint,text,text) from public; grant execute on function public.admin_set_deposit_status(bigint,text,text) to authenticated;
revoke all on function public.purchase_ai_max() from public; grant execute on function public.purchase_ai_max() to authenticated;
revoke all on function public.claim_ai_max_daily_reward() from public; grant execute on function public.claim_ai_max_daily_reward() to authenticated;
revoke all on function public.claim_referral_reward() from public; grant execute on function public.claim_referral_reward() to authenticated;

grant select on public.ai_max_purchases,public.ai_max_daily_claims,public.referral_reward_claims to authenticated;

commit;
