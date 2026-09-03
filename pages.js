
"use strict";

const page = location.pathname.split("/").pop() || "index.html";

// Mempertahankan sesi login Supabase.
// Jika member sudah login dan membuka kembali aplikasi,
// langsung diarahkan ke dashboard tanpa login ulang.
function keepMemberSession() {
  if (typeof sb === "undefined" || !sb.auth) return;

  sb.auth.getSession().then(({ data }) => {
    const session = data?.session;
    const current = location.pathname.split("/").pop() || "index.html";

    if (
      session &&
      (current === "index.html" || current === "")
    ) {
      location.href = "dashboard.html";
    }
  }).catch(error => {
    console.error("Gagal memeriksa session:", error);
  });
}
async function forgotPasswordPage(){
  const form=document.getElementById("forgotForm"); if(!form)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const email=document.getElementById("email").value.trim();
    const ok=document.getElementById("ok"),err=document.getElementById("err");
    ok.style.display="none";err.style.display="none";
    if(!email)return;
    try{
      const base=location.href.substring(0,location.href.lastIndexOf("/")+1);
      const redirectTo=base+"reset-password.html";
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
      if(error)throw error;
      ok.textContent="Link reset password sudah dikirim. Silakan cek email Anda.";ok.style.display="block";
      form.reset();
    }catch(e){err.textContent=e.message||"Gagal mengirim link reset password.";err.style.display="block";}
  });
}

async function resetPasswordPage(){
  const form=document.getElementById("resetForm"); if(!form)return;
  const ok=document.getElementById("ok"),err=document.getElementById("err");
  let ready=false;
  async function check(){
    const {data}=await sb.auth.getSession();
    ready=!!data.session;
    if(!ready){err.textContent="Sesi reset tidak ditemukan. Silakan minta link reset password baru.";err.style.display="block";}
  }
  await new Promise(r=>setTimeout(r,250));
  await check();
  sb.auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"||event==="SIGNED_IN"){ready=true;err.style.display="none";}});
  form.addEventListener("submit",async e=>{
    e.preventDefault();ok.style.display="none";err.style.display="none";
    const p1=document.getElementById("password").value,p2=document.getElementById("password2").value;
    if(!ready)return (err.textContent="Sesi reset belum aktif. Buka kembali link dari email." ,err.style.display="block");
    if(p1.length<6)return (err.textContent="Password minimal 6 karakter.",err.style.display="block");
    if(p1!==p2)return (err.textContent="Konfirmasi password tidak sama.",err.style.display="block");
    try{
      const {error}=await sb.auth.updateUser({password:p1});if(error)throw error;
      ok.textContent="Password berhasil diperbarui. Silakan login kembali.";ok.style.display="block";
      form.style.display="none";
      setTimeout(async()=>{await sb.auth.signOut();location.href="index.html";},1300);
    }catch(e){err.textContent=e.message||"Gagal memperbarui password.";err.style.display="block";}
  });
}

async function loginPage(){
  const form=document.getElementById("loginForm"); if(!form)return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const identifier=document.getElementById("username").value.trim();
    const password=document.getElementById("password").value;
    if(!identifier||!password) return toastMsg("Email/username dan password wajib diisi.");
    try{
      let email=identifier;
      if(!identifier.includes("@")){
        const {data,error}=await sb.rpc("get_login_email",{p_username:identifier});
        if(error) throw error;
        if(!data) throw new Error("Username tidak ditemukan.");
        email=data;
      }
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      location.href="dashboard.html";
    }catch(e){
      console.error("LOGIN ERROR:", e);
      let message = e?.message || "Login gagal.";
      if(/email not confirmed/i.test(message)){
        message = "Email belum diverifikasi. Buka email verifikasi dari Supabase terlebih dahulu, lalu login kembali.";
      }
      toastMsg(message);
    }
  });
  const {data:{session}}=await sb.auth.getSession();

if(session){
  // Member masih memiliki session Supabase.
  // Tidak perlu memasukkan email dan password lagi.
  if(
    location.pathname.endsWith("index.html") ||
    location.pathname.endsWith("/")
  ){
    location.href="dashboard.html";
  }
}
}

async function registerPage(){
  const refInput = document.getElementById("referral");
  const params = new URLSearchParams(location.search);
  const refFromLink = (params.get("ref") || "").trim().toUpperCase();

  // Isi otomatis kode referral dari link:
  // https://myshort-b3o.pages.dev/register.html?ref=REF000001
  if(refInput && !refInput.value && refFromLink){
    refInput.value = refFromLink;
  }

  window.register = async function(){
    const nama = document.getElementById("nama")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
    const hp = document.getElementById("hp")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const referral = (document.getElementById("referral")?.value.trim().toUpperCase() || "") || null;

    const err = document.getElementById("error");
    const ok = document.getElementById("success");
    const button = document.querySelector('button[onclick="register()"]');

    if(err) err.style.display = "none";
    if(ok) ok.style.display = "none";

    if(!nama || !email || !hp || !password){
      if(err){
        err.textContent = "Semua data wajib diisi.";
        err.style.display = "block";
      }
      return;
    }

    if(password.length < 6){
      if(err){
        err.textContent = "Password minimal 6 karakter.";
        err.style.display = "block";
      }
      return;
    }

    if(button){
      button.disabled = true;
      button.textContent = "MEMPROSES...";
    }

    try{
      // Setelah email dikonfirmasi, Supabase diarahkan kembali
      // ke Cloudflare Pages, bukan ke domain lama.
      const emailRedirectTo = location.origin + "/dashboard.html";

      const {data, error} = await sb.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo,
          data:{
            full_name: nama,
            phone: hp,
            referred_by_code: referral
          }
        }
      });

      if(error) throw error;

      // Jika email confirmation aktif, session memang null.
      // User harus klik email verifikasi terlebih dahulu.
      if(!data.session){
        if(ok){
          ok.innerHTML =
            "Pendaftaran berhasil.<br><br>" +
            "Silakan buka email Anda dan klik <b>verifikasi email</b>. " +
            "Setelah verifikasi, login melalui MyShort Cloudflare.";
          ok.style.display = "block";
        }
        return;
      }

      if(ok){
        ok.textContent = "Pendaftaran berhasil. Mengarahkan ke dashboard...";
        ok.style.display = "block";
      }

      setTimeout(() => {
        location.href = "dashboard.html";
      }, 700);

    }catch(e){
      console.error("REGISTER ERROR:", e);

      let message = e?.message || "Pendaftaran gagal.";

      if(/already registered/i.test(message)){
        message = "Email sudah terdaftar. Silakan login menggunakan akun tersebut.";
      }else if(/redirect/i.test(message) || /url/i.test(message)){
        message = "URL verifikasi belum diizinkan di Supabase. Periksa Authentication > URL Configuration.";
      }

      if(err){
        err.textContent = message;
        err.style.display = "block";
      }
    }finally{
      if(button){
        button.disabled = false;
        button.textContent = "DAFTAR SEKARANG";
      }
    }
  };
}
async function dashboardPage(){
  const s=await initPage();
  if(!s)return;

  // ==============================
  // LOAD PROFILE MEMBER
  // ==============================
  // Dipisahkan dari wallet agar jika
  // wallet gagal, nama member tetap tampil.
  try{
    const p=await currentProfile();

    if(p){
      setText("memberName",p.full_name||"Member");
      setText("profileName",p.full_name||"Member");
      setText("profileEmail",p.email||s.user.email||"");
      setText(
        "avatar",
        (p.full_name||"M").charAt(0).toUpperCase()
      );
    }
  }catch(e){
    console.error("Gagal memuat profile:",e);
  }

  // ==============================
  // LOAD WALLET / SALDO
  // ==============================
  // Tidak mengubah saldo.
  // Hanya membaca wallet milik user
  // yang sedang login.
  try{
    const w=await loadWallet();

    if(w){
      setText(
        "balanceValue",
        moneyIDR(Number(w.balance||0))
      );
    }
  }catch(e){
    console.error("Gagal memuat wallet:",e);
  }

  // ==============================
  // LOAD JUMLAH MISSION
  // ==============================
  try{
    const {count:mc,error}=await sb
      .from("user_missions")
      .select("*",{count:"exact",head:true})
      .eq("user_id",s.user.id)
      .eq("status","completed");

    if(!error){
      setText("missionCount",mc||0);
    }else{
      console.error(
        "Gagal memuat jumlah mission:",
        error
      );
    }
  }catch(e){
    console.error(
      "Gagal memuat jumlah mission:",
      e
    );
  }

  // ==============================
  // LOAD JUMLAH REFERRAL
  // ==============================
  try{
    const {count:rc,error}=await sb
      .from("referrals")
      .select("*",{count:"exact",head:true})
      .eq("referrer_id",s.user.id);

    if(!error){
      setText("refCount",rc||0);
    }else{
      console.error(
        "Gagal memuat referral:",
        error
      );
    }
  }catch(e){
    console.error(
      "Gagal memuat referral:",
      e
    );
  }

  // ==============================
  // TOGGLE SALDO
  // ==============================
  window.toggleBalance=async function(){
    const el=document.getElementById("balanceValue");

    if(!el)return;

    try{
      const w=await loadWallet();

      const hidden=
        el.dataset.hidden==="1";

      el.dataset.hidden=
        hidden?"0":"1";

      el.innerHTML=hidden
        ? `<span>Rp</span>${Number(
            w?.balance||0
          ).toLocaleString("id-ID")}`
        : "Rp ••••••";

    }catch(e){
      console.error(
        "Gagal refresh saldo:",
        e
      );
    }
  };

  // ==============================
  // LOGOUT
  // ==============================
  window.logout=logoutSupabase;
}

async function walletPage(){
  const s=await initPage();if(!s)return;
  const w=await refreshBalance(["amount"]); window.toggleBalance=function(){
    const el=document.getElementById("amount"); const hidden=el.dataset.hidden==="1";
    el.dataset.hidden=hidden?"0":"1"; el.innerHTML=hidden?`<span>Rp</span>${Number(w?.balance||0).toLocaleString("id-ID")}`:"<span>Rp</span>••••••";
  };
}

async function missionPage(){
  const s=await initPage();if(!s)return;
  let activePlan=null,todayClaim=null,refCount=0,filter="all";
  const jakartaDate=()=>{
    const d=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Jakarta"}));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  async function load(){
    const [p,c,r]=await Promise.all([
      sb.from("ai_max_purchases").select("id,purchased_at,active").eq("user_id",s.user.id).eq("active",true).order("purchased_at",{ascending:false}).limit(1),
      sb.from("ai_max_daily_claims").select("id,claim_date,amount,claimed_at").eq("user_id",s.user.id).eq("claim_date",jakartaDate()).maybeSingle(),
      sb.from("referrals").select("referred_id,status",{count:"exact",head:true}).eq("referrer_id",s.user.id).eq("status","qualified")
    ]);
    if(p.error)throw p.error;if(c.error)throw c.error;if(r.error)throw r.error;
    activePlan=(p.data||[])[0]||null;todayClaim=c.data||null;refCount=r.count||0;render();
  }
  function render(){
    const list=document.getElementById("list");if(!list)return;
    const cards=[
      {cat:"daily",title:"Cek Harian",description:"Klaim Rp8.000 setiap hari setelah AI-MAX aktif.",reward:8000,done:!!todayClaim,action:todayClaim?"Selesai":"Klaim Rp8.000",fn:claimDaily},
      {cat:"referral",title:"Undang Teman",description:`Undang 3 teman yang sudah membeli AI-MAX Rp100.000. Progress ${Math.min(refCount,3)}/3.`,reward:25000,done:false,action:"Klaim Rp25.000",fn:claimReferral},
      {cat:"deposit",title:"Beli AI-MAX",description:"Beli AI-MAX menggunakan saldo wallet seharga Rp100.000.",reward:0,done:!!activePlan,action:activePlan?"Sudah Aktif":"Beli AI-MAX",fn:purchase}
    ].filter(x=>filter==="all"||x.cat===filter);
    list.innerHTML=cards.map((x,i)=>`<article class="mission"><div class="toprow"><div class="icon">✓</div><div style="flex:1"><div class="name">${escapeHTML(x.title)}</div><div class="desc">${escapeHTML(x.description)}</div></div><div class="reward"><small>Reward</small><b>${moneyIDR(x.reward)}</b></div></div><div class="foot"><span class="status">${x.done?"Selesai":x.cat==="referral"&&refCount<3?"Belum memenuhi 3 teman pembeli AI-MAX":x.cat==="deposit"&&activePlan?"Sudah aktif":"Belum selesai"}</span><span class="actions"><button class="btn ${x.done?"secondary":""}" data-i="${i}" ${x.done||x.cat==="referral"&&refCount<3?"disabled":""}>${x.done?"Selesai":x.action}</button></span></div></article>`).join("");
    list.querySelectorAll("[data-i]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await cards[Number(b.dataset.i)].fn();await load();}catch(e){b.disabled=false;toastMsg(e.message||"Gagal.");}});
  }
  async function purchase(){const {error}=await sb.rpc("purchase_ai_max");if(error)throw error;toastMsg("AI-MAX berhasil dibeli.");}
  async function claimDaily(){const {error}=await sb.rpc("claim_ai_max_daily_reward");if(error)throw error;toastMsg("Hadiah Rp8.000 berhasil masuk.");}
  async function claimReferral(){const {error}=await sb.rpc("claim_referral_reward");if(error)throw error;toastMsg("Hadiah Rp25.000 berhasil masuk.");}
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.f;render()}));
  await load();
}

async function profilePage(){
  const s=await initPage();if(!s)return;
  async function load(){
    const p=await currentProfile();if(!p)return;
    setText("headerName",p.full_name);setText("uid",p.uid);setText("statusBadge",String(p.status).toUpperCase());
    setText("nama",p.full_name);setText("email",p.email);setText("phone",p.phone||"—");setText("referral",p.referral_code);setText("status",p.status);setText("level",p.level);
    const n=Number(String(p.level).match(/\d+/)?.[0]||1);setText("levelShort",n);setText("levelName",`LV ${n}`);setText("nextLevel",`Menuju LV ${n+1}`);
    const xp=Number(p.xp||0), next=50; setText("xpText",`${xp} / ${next} XP`);const bar=document.getElementById("xpBar");if(bar)bar.style.width=Math.min(100,xp/next*100)+"%";
    const en=document.getElementById("editNama");if(en)en.value=p.full_name||"";const ep=document.getElementById("editEmail");if(ep)ep.value=p.email||"";const eh=document.getElementById("editPhone");if(eh)eh.value=p.phone||"";
  }
  window.showEdit=()=>document.getElementById("editForm")?.classList.add("show");
  window.hideEdit=()=>document.getElementById("editForm")?.classList.remove("show");
  window.saveProfile=async()=>{
    const full_name=document.getElementById("editNama").value.trim();
    const email=document.getElementById("editEmail").value.trim();
    const phone=document.getElementById("editPhone").value.trim();
    if(!full_name||!email)return toastMsg("Nama dan email wajib diisi.");
    try{
      if(email!==s.user.email){
        const {error}=await sb.auth.updateUser({email});
        if(error)throw error;
      }
      const {error}=await sb.rpc("update_my_profile",{p_full_name:full_name,p_phone:phone});
      if(error)throw error;
      toastMsg(email!==s.user.email?"Profil tersimpan. Email akan tersinkron setelah perubahan Auth selesai.":"Profil tersimpan.");
      hideEdit();await load();
    }catch(e){toastMsg(e.message||"Gagal menyimpan profil.");}
  };
  await load();
}

async function bankPage(){
  const s=await initPage();if(!s)return;
  async function load(){
    const {data,error}=await sb.from("bank_accounts").select("*").eq("user_id",s.user.id).order("created_at",{ascending:false});if(error)throw error;
    const list=document.getElementById("listBank");list.innerHTML=(data||[]).map(x=>`<div class="bank-item"><b>${escapeHTML(x.method)}</b><br>${escapeHTML(x.account_name)} • ${escapeHTML(x.account_number)} <button class="delete" data-id="${x.id}">Hapus</button></div>`).join("")||"<p>Belum ada rekening.</p>";
    list.querySelectorAll("[data-id]").forEach(b=>b.onclick=async()=>{if(!confirm("Hapus rekening ini?"))return;const {error}=await sb.from("bank_accounts").delete().eq("id",b.dataset.id).eq("user_id",s.user.id);if(error)toastMsg(error.message);else load();});
  }
  window.simpanBank=async()=>{
    const method=document.getElementById("bank").value,name=document.getElementById("nama").value.trim(),number=document.getElementById("rekening").value.trim();
    if(!method||!name||!number)return toastMsg("Lengkapi data rekening.");
    const {error}=await sb.from("bank_accounts").insert({user_id:s.user.id,method,account_name:name,account_number:number,is_default:true});
    if(error)toastMsg(error.message);else{toastMsg("Rekening tersimpan.");document.getElementById("nama").value="";document.getElementById("rekening").value="";load();}
  };
  await load();
}

async function depositPage(){
  const s=await initPage();if(!s)return;
  window.kirimDeposit=async()=>{
    const method=document.getElementById("metode").value,amount=Number(document.getElementById("nominal").value),note=document.getElementById("catatan").value.trim();
    if(!method||amount<10000||amount>10000000)return toastMsg("Nominal deposit Rp10.000 - Rp10.000.000.");
    const {error}=await sb.rpc("request_deposit",{p_amount:amount,p_method:method,p_note:note||null});
    if(error)toastMsg(error.message);else{toastMsg("Pengajuan deposit berhasil. Menunggu verifikasi admin.");document.getElementById("nominal").value="";document.getElementById("catatan").value="";}
  };
}

async function withdrawalPage(){
  const s=await initPage();if(!s)return;
  const w=await loadWallet();setText("saldo",moneyIDR(w.balance));
  document.querySelectorAll('a[href*="dashboard.dana.id"]').forEach(a=>a.style.display="none");
  // Replace old DANA-only link with a real withdrawal form.
  const box=document.querySelector(".container"); if(box){
    const card=document.createElement("div");card.className="card";card.style.marginTop="18px";
    card.innerHTML=`<h3>Ajukan Withdrawal</h3><label>Metode</label><select id="wdMethod"><option>DANA</option><option>BCA</option><option>BRI</option><option>BNI</option><option>Mandiri</option><option>Bank lainnya</option></select><label>Nomor rekening/akun</label><input id="wdNumber" placeholder="Nomor DANA/rekening"><label>Nama pemilik</label><input id="wdName" placeholder="Sesuai rekening"><label>Jumlah</label><input id="wdAmount" type="number" min="10000" placeholder="Minimal Rp10.000"><button id="wdBtn" class="dana-button" type="button">Ajukan Withdrawal</button>`;
    box.appendChild(card);
    document.getElementById("wdBtn").onclick=async()=>{
      const amount=Number(document.getElementById("wdAmount").value),method=document.getElementById("wdMethod").value,number=document.getElementById("wdNumber").value.trim(),name=document.getElementById("wdName").value.trim();
      if(amount<10000||!number||!name)return toastMsg("Lengkapi data withdrawal.");
      try{const {error}=await sb.rpc("request_withdrawal",{p_amount:amount,p_method:method,p_account_number:number,p_account_name:name});if(error)throw error;toastMsg("Withdrawal berhasil diajukan.");setTimeout(()=>location.href="history.html",700);}
      catch(e){toastMsg(e.message||"Withdrawal gagal.");}
    };
  }
}

async function historyPage(){
  const s=await initPage();if(!s)return;
  let rows=[];
  async function loadHistory(filter="all"){
    const {data,error}=await sb.from("transactions").select("*").eq("user_id",s.user.id).order("created_at",{ascending:false});if(error)throw error;
    rows=data||[];
    const deposits=rows.filter(x=>x.type==="deposit").reduce((a,x)=>a+Number(x.amount||0),0);
    const withdraw=rows.filter(x=>["withdrawal","withdrawal_refund"].includes(x.type)).reduce((a,x)=>a+Number(x.type==="withdrawal"?x.amount:-x.amount),0);
    setText("totalDeposit",moneyIDR(deposits));setText("totalWithdraw",moneyIDR(Math.max(0,withdraw)));setText("jumlah",rows.length);
    let shown=filter==="all"?rows:filter==="Deposit"?rows.filter(x=>x.type==="deposit"):rows.filter(x=>x.type==="withdrawal");
    document.getElementById("historyList").innerHTML=shown.map(x=>`<div class="history-item"><b>${escapeHTML(x.description||x.type)}</b><span>${moneyIDR(x.amount)}</span><small>${formatDate(x.created_at)}</small></div>`).join("")||"<p>Belum ada transaksi.</p>";
  }
  window.loadHistory=loadHistory;await loadHistory("all");
}

async function referralPage(){
  const s=await initPage();if(!s)return;
  try{
    const p=await currentProfile();
    if(!p){
      toastMsg("Data profil tidak ditemukan. Silakan login ulang.");
      return;
    }

    // Tampilkan nama member pada elemen header/member bila tersedia.
    setText("headerName",p.full_name||p.username||"Member");
    setText("memberName",p.full_name||p.username||"Member");
    setText("kode",p.referral_code||"—");

    // referral.html memakai DIV id="link".
    // Nama halaman registrasi di repository adalah register.html.
    const base=location.origin+location.pathname.replace(/[^/]+$/ , "");
    const url=base+"register.html?ref="+encodeURIComponent(p.referral_code||"");
    setText("link",url);

    window.copyLink=async()=>{
      try{
        await navigator.clipboard.writeText(url);
        toastMsg("Link referral disalin.");
      }catch(e){
        window.prompt("Salin link referral ini:",url);
      }
    };

    window.claimReward=async()=>{
      const btn=document.getElementById("claimBtn");
      if(btn)btn.disabled=true;
      try{
        const {error}=await sb.rpc("claim_referral_reward");
        if(error)throw error;
        toastMsg("Hadiah referral berhasil masuk ke wallet.");
        await load();
      }catch(e){
        if(btn)btn.disabled=false;
        toastMsg(e.message||"Klaim referral gagal.");
      }
    };

    async function load(){
      const {data,error}=await sb
        .from("referrals")
        .select("id,referred_id,status,reward,created_at")
        .eq("referrer_id",s.user.id)
        .order("created_at",{ascending:false});
      if(error)throw error;

      const rows=data||[];
      const ids=rows.map(x=>x.referred_id).filter(Boolean);
      const names={};

      if(ids.length){
        const {data:ps,error:pe}=await sb
          .from("profiles")
          .select("id,full_name,username")
          .in("id",ids);
        if(pe)throw pe;
        (ps||[]).forEach(x=>names[x.id]=x);
      }

      const list=document.getElementById("listMember");
      if(list){
        list.innerHTML=rows.map(x=>{
          const qualified=x.status==="qualified";
          const label=qualified?
            "AI-MAX dibeli — memenuhi syarat":
            "Belum membeli AI-MAX";
          const member=names[x.referred_id];
          return `<div class="member"><b>${escapeHTML(member?.full_name||member?.username||"Member")}</b><br>Status: ${label}</div>`;
        }).join("")||'<div class="empty">Belum ada referral.</div>';
      }

      const count=rows.length;
      const qualifiedCount=rows.filter(x=>x.status==="qualified").length;
      setText("anggota",count);
      setText("bonus",moneyIDR(0));

      const btn=document.getElementById("claimBtn");
      if(btn){
        btn.disabled=qualifiedCount<3;
        btn.textContent=qualifiedCount>=3?
          "Klaim Rp25.000":
          `Butuh 3 teman pembeli AI-MAX (${qualifiedCount}/3)`;
      }

      const rs=document.getElementById("rewardStatus");
      if(rs){
        rs.textContent=qualifiedCount>=3?
          "3 teman sudah membeli AI-MAX. Verifikasi email tetap wajib.":
          `Progress pembelian AI-MAX: ${qualifiedCount}/3. Verifikasi email saja tidak cukup.`;
      }
    }

    await load();
  }catch(e){
    console.error("Referral page error:",e);
    toastMsg("Gagal memuat data referral: "+(e.message||"koneksi Supabase"));
  }
}
async function adminPage(){
  const s=await initPage();if(!s)return;
  const p=await currentProfile();if(p.role!=="admin"){toastMsg("Akses admin diperlukan.");setTimeout(()=>location.href="dashboard.html",700);return;}
  const root=document.getElementById("adminRoot");
  async function load(){
    const [{data:ws},{data:ds},{data:wd}]=await Promise.all([
      sb.from("profiles").select("id,uid,full_name,email,role,status,created_at").order("created_at",{ascending:false}),
      sb.from("deposits").select("*").order("created_at",{ascending:false}).limit(50),
      sb.from("withdrawals").select("*").order("created_at",{ascending:false}).limit(50)
    ]);
    root.innerHTML=`<h2>Admin Panel</h2><h3>Member</h3><div class="table">${(ws||[]).map(x=>`<div class="row"><span>${escapeHTML(x.full_name)}<small>${escapeHTML(x.email)} • ${x.role}</small></span><b>${x.status}</b></div>`).join("")}</div><h3>Deposit</h3><div class="table">${(ds||[]).map(x=>`<div class="row"><span>#${x.id} • ${moneyIDR(x.amount)}<small>${x.method} • ${formatDate(x.created_at)}</small></span><span>${x.status==="pending"?`<button data-dep="${x.id}" data-st="approved">Setujui</button> <button data-dep="${x.id}" data-st="rejected">Tolak</button>`:x.status}</span></div>`).join("")||"Tidak ada"}</div><h3>Withdrawal</h3><div class="table">${(wd||[]).map(x=>`<div class="row"><span>#${x.id} • ${moneyIDR(x.amount)}<small>${escapeHTML(x.method)} ${escapeHTML(x.account_number)} • ${formatDate(x.created_at)}</small></span><span>${x.status==="pending"?`<button data-wd="${x.id}" data-st="approved">Setujui</button> <button data-wd="${x.id}" data-st="rejected">Tolak</button>`:x.status}</span></div>`).join("")||"Tidak ada"}</div>`;
    root.querySelectorAll("[data-dep]").forEach(b=>b.onclick=async()=>{const {error}=await sb.rpc("admin_set_deposit_status",{p_id:Number(b.dataset.dep),p_status:b.dataset.st,p_note:null});if(error)toastMsg(error.message);else load();});
    root.querySelectorAll("[data-wd]").forEach(b=>b.onclick=async()=>{const {error}=await sb.rpc("admin_set_withdrawal_status",{p_id:Number(b.dataset.wd),p_status:b.dataset.st,p_note:null});if(error)toastMsg(error.message);else load();});
  }
  await load();
}

document.addEventListener("DOMContentLoaded",async()=>{
  try{
    keepMemberSession();
    
        if(page==="index.html"||page==="") await loginPage();
    else if(page==="forgot-password.html") await forgotPasswordPage();
    else if(page==="reset-password.html") await resetPasswordPage();
    else if(page==="register.html") await registerPage();
    else if(page==="dashboard.html") await dashboardPage();
    else if(page==="wallet.html") await walletPage();
    else if(page==="mission.html") await missionPage();
    else if(page==="profile.html") await profilePage();
    else if(page==="bank.html") await bankPage();
    else if(page==="deposit.html") await depositPage();
    else if(page==="withdrawal.html") await withdrawalPage();
    else if(page==="history.html") await historyPage();
    else if(page==="referral.html") await referralPage();
    else if(page==="admin.html") await adminPage();
  }catch(e){console.error(e);toastMsg(e.message||"Terjadi kesalahan.");}
});
