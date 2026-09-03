// =========================================================
// MYSHORT APP - SUPABASE CONFIG
// =========================================================
// Hanya Publishable Key/anon-safe key. JANGAN taruh service_role di browser.

const SUPABASE_URL = "https://jywzhwvbyifulqqvgxxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_2leqwU4YWbTg--GCIfQMmA_zOEKKG60";

if (!window.supabase) {
  throw new Error("Supabase JS belum dimuat.");
}

window.sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

window.moneyIDR = n =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Number(n || 0));

window.moneyNumber = n => Number(n || 0);

window.escapeHTML = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));

window.toastMsg = msg => {
  const el = document.getElementById("toast");
  if (el) {
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2600);
  } else {
    alert(msg);
  }
};

window.getSession = async function () {
  const { data, error } = await window.sb.auth.getSession();
  if (error) throw error;
  return data?.session || null;
};

window.requireAuth = async function () {
  let session = await window.getSession();

  if (!session) {
    location.href = "index.html";
    return null;
  }

  // Jika access token sudah tidak valid, coba refresh sekali.
  try {
    const { data, error } = await window.sb.auth.refreshSession();
    if (!error && data?.session) session = data.session;
  } catch (e) {
    console.warn("Session refresh dilewati:", e);
  }

  return session;
};

// Ambil user dari session lokal terlebih dahulu.
// Ini lebih stabil untuk domain Cloudflare berbeda dari GitHub Pages.
window.currentUser = async function () {
  const session = await window.getSession();
  if (session?.user) return session.user;

  const { data, error } = await window.sb.auth.getUser();
  if (error) {
    console.error("getUser error:", error);
    return null;
  }
  return data?.user || null;
};

window.currentProfile = async function () {
  const user = await window.currentUser();
  if (!user) return null;

  let result = await window.sb
    .from("profiles")
    .select("id,uid,username,full_name,email,phone,referral_code,status,level,xp,role")
    .eq("id", user.id)
    .maybeSingle();

  // Jika token/session baru saja berubah, refresh lalu coba sekali lagi.
  if (result.error && ["401","403"].includes(String(result.error.code))) {
    try {
      await window.sb.auth.refreshSession();
      result = await window.sb
        .from("profiles")
        .select("id,uid,username,full_name,email,phone,referral_code,status,level,xp,role")
        .eq("id", user.id)
        .maybeSingle();
    } catch (e) {
      console.warn("Refresh session gagal:", e);
    }
  }

  if (result.error) {
    console.error("currentProfile Supabase error:", result.error);
    throw result.error;
  }

  if (!result.data) {
    console.error("Profile tidak ditemukan untuk Auth User ID:", user.id);
    return null;
  }

  console.log("MYSHORT PROFILE BERHASIL:", result.data);
  return result.data;
};

window.logoutSupabase = async function () {
  const { error } = await window.sb.auth.signOut();
  if (error) throw error;
  location.href = "index.html";
};

window.loadWallet = async function () {
  const user = await window.currentUser();
  if (!user) return null;

  const { data, error } = await window.sb
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

console.log("MyShort Supabase Config loaded - robust session version.");
