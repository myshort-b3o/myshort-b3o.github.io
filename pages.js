"use strict";

/* =========================================================
   MYSHORT APP - PAGES.JS
   Versi perbaikan session + profile
   Tidak mengubah database secara langsung.
========================================================= */

const page = location.pathname.split("/").pop() || "index.html";

/* =========================================================
   SESSION
========================================================= */

function keepMemberSession() {
  if (typeof sb === "undefined" || !sb.auth) return;

  sb.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error("SESSION CHECK ERROR:", error);
        return;
      }

      const session = data?.session;
      const current =
        location.pathname.split("/").pop() || "index.html";

      if (
        session &&
        (current === "index.html" || current === "")
      ) {
        location.href = "dashboard.html";
      }
    })
    .catch(error => {
      console.error("Gagal memeriksa session:", error);
    });
}

/* =========================================================
   FORGOT PASSWORD
========================================================= */

async function forgotPasswordPage() {
  const form = document.getElementById("forgotForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const email =
      document.getElementById("email")?.value.trim() || "";

    const ok = document.getElementById("ok");
    const err = document.getElementById("err");

    if (ok) ok.style.display = "none";
    if (err) err.style.display = "none";

    if (!email) return;

    try {
      const base =
        location.origin +
        location.pathname.substring(
          0,
          location.pathname.lastIndexOf("/") + 1
        );

      const redirectTo =
        base + "reset-password.html";

      const { error } =
        await sb.auth.resetPasswordForEmail(
          email,
          { redirectTo }
        );

      if (error) throw error;

      if (ok) {
        ok.textContent =
          "Link reset password sudah dikirim. Silakan cek email Anda.";
        ok.style.display = "block";
      }

      form.reset();

    } catch (e) {
      console.error("FORGOT PASSWORD ERROR:", e);

      if (err) {
        err.textContent =
          e?.message ||
          "Gagal mengirim link reset password.";
        err.style.display = "block";
      }
    }
  });
}

/* =========================================================
   RESET PASSWORD
========================================================= */

async function resetPasswordPage() {
  const form = document.getElementById("resetForm");
  if (!form) return;

  const ok = document.getElementById("ok");
  const err = document.getElementById("err");

  let ready = false;

  async function checkSession() {
    try {
      const { data, error } =
        await sb.auth.getSession();

      if (error) throw error;

      ready = !!data?.session;

      if (!ready && err) {
        err.textContent =
          "Sesi reset tidak ditemukan. Silakan minta link reset password baru.";
        err.style.display = "block";
      }

    } catch (e) {
      console.error(
        "RESET SESSION ERROR:",
        e
      );

      if (err) {
        err.textContent =
          e?.message ||
          "Gagal memeriksa sesi reset.";
        err.style.display = "block";
      }
    }
  }

  await new Promise(resolve =>
    setTimeout(resolve, 250)
  );

  await checkSession();

  sb.auth.onAuthStateChange(event => {
    if (
      event === "PASSWORD_RECOVERY" ||
      event === "SIGNED_IN"
    ) {
      ready = true;

      if (err) {
        err.style.display = "none";
      }
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();

    if (ok) ok.style.display = "none";
    if (err) err.style.display = "none";

    const p1 =
      document.getElementById("password")?.value || "";

    const p2 =
      document.getElementById("password2")?.value || "";

    if (!ready) {
      if (err) {
        err.textContent =
          "Sesi reset belum aktif. Buka kembali link dari email.";
        err.style.display = "block";
      }
      return;
    }

    if (p1.length < 6) {
      if (err) {
        err.textContent =
          "Password minimal 6 karakter.";
        err.style.display = "block";
      }
      return;
    }

    if (p1 !== p2) {
      if (err) {
        err.textContent =
          "Konfirmasi password tidak sama.";
        err.style.display = "block";
      }
      return;
    }

    try {
      const { error } =
        await sb.auth.updateUser({
          password: p1
        });

      if (error) throw error;

      if (ok) {
        ok.textContent =
          "Password berhasil diperbarui. Silakan login kembali.";
        ok.style.display = "block";
      }

      form.style.display = "none";

      setTimeout(async () => {
        await sb.auth.signOut();
        location.href = "index.html";
      }, 1300);

    } catch (e) {
      console.error(
        "RESET PASSWORD ERROR:",
        e
      );

      if (err) {
        err.textContent =
          e?.message ||
          "Gagal memperbarui password.";
        err.style.display = "block";
      }
    }
  });
}

/* =========================================================
   LOGIN
========================================================= */

async function loginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const identifier =
      document.getElementById("username")
        ?.value.trim() || "";

    const password =
      document.getElementById("password")
        ?.value || "";

    if (!identifier || !password) {
      return toastMsg(
        "Email/username dan password wajib diisi."
      );
    }

    try {
      let email = identifier;

      /* Login menggunakan username */
      if (!identifier.includes("@")) {
        const { data, error } =
          await sb.rpc(
            "get_login_email",
            {
              p_username: identifier
            }
          );

        if (error) throw error;

        if (!data) {
          throw new Error(
            "Username tidak ditemukan."
          );
        }

        email = data;
      }

      const { error } =
        await sb.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      location.href = "dashboard.html";

    } catch (e) {
      console.error(
        "LOGIN ERROR:",
        e
      );

      let message =
        e?.message || "Login gagal.";

      if (
        /email not confirmed/i.test(message)
      ) {
        message =
          "Email belum diverifikasi. Buka email verifikasi dari Supabase terlebih dahulu, lalu login kembali.";
      }

      toastMsg(message);
    }
  });

  /* Jika sudah login, langsung dashboard */
  try {
    const { data, error } =
      await sb.auth.getSession();

    if (error) {
      console.error(
        "LOGIN SESSION CHECK:",
        error
      );
      return;
    }

    if (data?.session) {
      if (
        location.pathname.endsWith("index.html") ||
        location.pathname.endsWith("/")
      ) {
        location.href = "dashboard.html";
      }
    }

  } catch (e) {
    console.error(
      "SESSION CHECK ERROR:",
      e
    );
  }
}

/* =========================================================
   REGISTER
========================================================= */

async function registerPage() {
  const refInput =
    document.getElementById("referral");

  const params =
    new URLSearchParams(location.search);

  const refFromLink =
    (params.get("ref") || "")
      .trim()
      .toUpperCase();

  if (
    refInput &&
    !refInput.value &&
    refFromLink
  ) {
    refInput.value = refFromLink;
  }

  window.register = async function () {
    const nama =
      document.getElementById("nama")
        ?.value.trim() || "";

    const email =
      document.getElementById("email")
        ?.value.trim()
        .toLowerCase() || "";

    const hp =
      document.getElementById("hp")
        ?.value.trim() || "";

    const password =
      document.getElementById("password")
        ?.value || "";

    const referral =
      (
        document.getElementById("referral")
          ?.value.trim()
          .toUpperCase() || ""
      ) || null;

    const err =
      document.getElementById("error");

    const ok =
      document.getElementById("success");

    const button =
      document.querySelector(
        'button[onclick="register()"]'
      );

    if (err) err.style.display = "none";
    if (ok) ok.style.display = "none";

    if (
      !nama ||
      !email ||
      !hp ||
      !password
    ) {
      if (err) {
        err.textContent =
          "Semua data wajib diisi.";
        err.style.display = "block";
      }
      return;
    }

    if (password.length < 6) {
      if (err) {
        err.textContent =
          "Password minimal 6 karakter.";
        err.style.display = "block";
      }
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "MEMPROSES...";
    }

    try {
      /*
       * Selalu gunakan domain yang sedang dibuka.
       * Jadi tidak tergantung pages.dev atau GitHub Pages.
       */
      const emailRedirectTo =
        location.origin +
        "/dashboard.html";

      console.log(
        "REGISTER REDIRECT:",
        emailRedirectTo
      );

      const { data, error } =
        await sb.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,

            data: {
              full_name: nama,
              phone: hp,
              referred_by_code: referral
            }
          }
        });

      if (error) throw error;

      if (!data?.session) {
        if (ok) {
          ok.innerHTML =
            "Pendaftaran berhasil.<br><br>" +
            "Silakan buka email Anda dan klik <b>verifikasi email</b>.<br><br>" +
            "Setelah verifikasi, login melalui MyShort.";

          ok.style.display = "block";
        }

        return;
      }

      if (ok) {
        ok.textContent =
          "Pendaftaran berhasil. Mengarahkan ke dashboard...";
        ok.style.display = "block";
      }

      setTimeout(() => {
        location.href = "dashboard.html";
      }, 700);

    } catch (e) {
      console.error(
        "REGISTER ERROR:",
        e
      );

      let message =
        e?.message ||
        "Pendaftaran gagal.";

      if (
        /already registered/i.test(message)
      ) {
        message =
          "Email sudah terdaftar. Silakan login menggunakan akun tersebut.";
      }

      if (
        /redirect/i.test(message) ||
        /url/i.test(message)
      ) {
        message =
          "URL verifikasi belum diizinkan di Supabase. Periksa Authentication > URL Configuration.";
      }

      if (err) {
        err.textContent = message;
        err.style.display = "block";
      }

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          "DAFTAR SEKARANG";
      }
    }
  };
}

/* =========================================================
   DASHBOARD
========================================================= */

async function dashboardPage() {
  const s = await initPage();
  if (!s) return;

  try {
    const p = await currentProfile();

    if (p) {
      setText(
        "memberName",
        p.full_name ||
        p.username ||
        "Member"
      );

      setText(
        "profileName",
        p.full_name ||
        p.username ||
        "Member"
      );

      setText(
        "profileEmail",
        p.email ||
        s.user?.email ||
        ""
      );

      setText(
        "avatar",
        (
          p.full_name ||
          p.username ||
          "M"
        ).charAt(0).toUpperCase()
      );
    }

  } catch (e) {
    console.error(
      "Gagal memuat profile dashboard:",
      e
    );
  }

  /* Wallet */
  try {
    const w = await loadWallet();

    if (w) {
      setText(
        "balanceValue",
        moneyIDR(
          Number(w.balance || 0)
        )
      );
    }

  } catch (e) {
    console.error(
      "Gagal memuat wallet:",
      e
    );
  }

  /* Mission count */
  try {
    const {
      count: mc,
      error
    } = await sb
      .from("user_missions")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("user_id", s.user.id)
      .eq("status", "completed");

    if (!error) {
      setText(
        "missionCount",
        mc || 0
      );
    } else {
      console.error(
        "Mission count error:",
        error
      );
    }

  } catch (e) {
    console.error(
      "Mission count exception:",
      e
    );
  }

  /* Referral count */
  try {
    const {
      count: rc,
      error
    } = await sb
      .from("referrals")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "referrer_id",
        s.user.id
      );

    if (!error) {
      setText(
        "refCount",
        rc || 0
      );
    } else {
      console.error(
        "Referral count error:",
        error
      );
    }

  } catch (e) {
    console.error(
      "Referral count exception:",
      e
    );
  }

  /* Toggle saldo */
  window.toggleBalance = async function () {
    const el =
      document.getElementById(
        "balanceValue"
      );

    if (!el) return;

    try {
      const w = await loadWallet();

      const hidden =
        el.dataset.hidden === "1";

      el.dataset.hidden =
        hidden ? "0" : "1";

      el.innerHTML = hidden
        ? `<span>Rp</span>${Number(
            w?.balance || 0
          ).toLocaleString("id-ID")}`
        : "Rp ••••••";

    } catch (e) {
      console.error(
        "Gagal refresh saldo:",
        e
      );
    }
  };

  window.logout =
    logoutSupabase;
}

/* =========================================================
   WALLET
========================================================= */

async function walletPage() {
  const s = await initPage();
  if (!s) return;

  const w =
    await refreshBalance([
      "amount"
    ]);

  window.toggleBalance =
    function () {
      const el =
        document.getElementById(
          "amount"
        );

      if (!el) return;

      const hidden =
        el.dataset.hidden === "1";

      el.dataset.hidden =
        hidden ? "0" : "1";

      el.innerHTML = hidden
        ? `<span>Rp</span>${Number(
            w?.balance || 0
          ).toLocaleString("id-ID")}`
        : "<span>Rp</span>••••••";
    };
}

/* =========================================================
   MISSION
========================================================= */

async function missionPage() {
  const s = await initPage();
  if (!s) return;

  let activePlan = null;
  let todayClaim = null;
  let refCount = 0;
  let filter = "all";

  const jakartaDate = () => {
    const d =
      new Date(
        new Date().toLocaleString(
          "en-US",
          {
            timeZone: "Asia/Jakarta"
          }
        )
      );

    return (
      `${d.getFullYear()}-` +
      `${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-` +
      `${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  };

  async function load() {
    const [
      p,
      c,
      r
    ] = await Promise.all([
      sb
        .from("ai_max_purchases")
        .select(
          "id,purchased_at,active"
        )
        .eq(
          "user_id",
          s.user.id
        )
        .eq(
          "active",
          true
        )
        .order(
          "purchased_at",
          {
            ascending: false
          }
        )
        .limit(1),

      sb
        .from("ai_max_daily_claims")
        .select(
          "id,claim_date,amount,claimed_at"
        )
        .eq(
          "user_id",
          s.user.id
        )
        .eq(
          "claim_date",
          jakartaDate()
        )
        .maybeSingle(),

      sb
        .from("referrals")
        .select(
          "referred_id,status",
          {
            count: "exact",
            head: true
          }
        )
        .eq(
          "referrer_id",
          s.user.id
        )
        .eq(
          "status",
          "qualified"
        )
    ]);

    if (p.error) throw p.error;
    if (c.error) throw c.error;
    if (r.error) throw r.error;

    activePlan =
      (p.data || [])[0] ||
      null;

    todayClaim =
      c.data || null;

    refCount =
      r.count || 0;

    render();
  }

  function render() {
    const list =
      document.getElementById(
        "list"
      );

    if (!list) return;

    const cards = [
      {
        cat: "daily",
        title: "Cek Harian",
        description:
          "Klaim Rp8.000 setiap hari setelah AI-MAX aktif.",
        reward: 8000,
        done: !!todayClaim,
        action:
          todayClaim
            ? "Selesai"
            : "Klaim Rp8.000",
        fn: claimDaily
      },

      {
        cat: "referral",
        title: "Undang Teman",
        description:
          `Undang 3 teman yang sudah membeli AI-MAX Rp100.000. Progress ${Math.min(
            refCount,
            3
          )}/3.`,
        reward: 25000,
        done: false,
        action:
          "Klaim Rp25.000",
        fn: claimReferral
      },

      {
        cat: "deposit",
        title: "Beli AI-MAX",
        description:
          "Beli AI-MAX menggunakan saldo wallet seharga Rp100.000.",
        reward: 0,
        done: !!activePlan,
        action:
          activePlan
            ? "Sudah Aktif"
            : "Beli AI-MAX",
        fn: purchase
      }
    ].filter(
      x =>
        filter === "all" ||
        x.cat === filter
    );

    list.innerHTML =
      cards
        .map(
          (x, i) => `
          <article class="mission">
            <div class="toprow">
              <div class="icon">✓</div>

              <div style="flex:1">
                <div class="name">
                  ${escapeHTML(x.title)}
                </div>

                <div class="desc">
                  ${escapeHTML(
                    x.description
                  )}
                </div>
              </div>

              <div class="reward">
                <small>Reward</small>
                <b>
                  ${moneyIDR(
                    x.reward
                  )}
                </b>
              </div>
            </div>

            <div class="foot">
              <span class="status">
                ${
                  x.done
                    ? "Selesai"
                    : x.cat === "referral" &&
                      refCount < 3
                    ? "Belum memenuhi 3 teman pembeli AI-MAX"
                    : x.cat === "deposit" &&
                      activePlan
                    ? "Sudah aktif"
                    : "Belum selesai"
                }
              </span>

              <span class="actions">
                <button
                  class="btn ${
                    x.done
                      ? "secondary"
                      : ""
                  }"
                  data-i="${i}"
                  ${
                    x.done ||
                    (
                      x.cat ===
                      "referral" &&
                      refCount < 3
                    )
                      ? "disabled"
                      : ""
                  }
                >
                  ${
                    x.done
                      ? "Selesai"
                      : x.action
                  }
                </button>
              </span>
            </div>
          </article>
        `
        )
        .join("");

    list
      .querySelectorAll(
        "[data-i]"
      )
      .forEach(button => {
        button.onclick =
          async () => {
            button.disabled = true;

            try {
              await cards[
                Number(
                  button.dataset.i
                )
              ].fn();

              await load();

            } catch (e) {
              button.disabled =
                false;

              toastMsg(
                e?.message ||
                "Gagal."
              );
            }
          };
      });
  }

  async function purchase() {
    const { error } =
      await sb.rpc(
        "purchase_ai_max"
      );

    if (error) throw error;

    toastMsg(
      "AI-MAX berhasil dibeli."
    );
  }

  async function claimDaily() {
    const { error } =
      await sb.rpc(
        "claim_ai_max_daily_reward"
      );

    if (error) throw error;

    toastMsg(
      "Hadiah Rp8.000 berhasil masuk."
    );
  }

  async function claimReferral() {
    const { error } =
      await sb.rpc(
        "claim_referral_reward"
      );

    if (error) throw error;

    toastMsg(
      "Hadiah Rp25.000 berhasil masuk."
    );
  }

  document
    .querySelectorAll(".tab")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          document
            .querySelectorAll(
              ".tab"
            )
            .forEach(x =>
              x.classList.remove(
                "active"
              )
            );

          button.classList.add(
            "active"
          );

          filter =
            button.dataset.f;

          render();
        }
      );
    });

  await load();
}

/* =========================================================
   PROFILE
   PERBAIKAN UTAMA
========================================================= */

async function profilePage() {
  const s = await initPage();
  if (!s) return;

  async function load() {
    try {
      /*
       * Ambil user Auth terlebih dahulu.
       */
      const user =
        await currentUser();

      if (!user) {
        console.error(
          "PROFILE: Auth user tidak ditemukan."
        );

        toastMsg(
          "Sesi login tidak ditemukan. Silakan login kembali."
        );

        return;
      }

      console.log(
        "PROFILE AUTH USER:",
        user
      );

      /*
       * Baca profile berdasarkan:
       * profiles.id = auth.users.id
       */
      const {
        data: p,
        error
      } = await sb
        .from("profiles")
        .select(
          "id,uid,username,full_name,email,phone,referral_code,status,level,xp,role"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

      console.log(
        "PROFILE DATABASE DATA:",
        p
      );

      console.log(
        "PROFILE DATABASE ERROR:",
        error
      );

      if (error) {
        toastMsg(
          "Gagal membaca profil: " +
          (
            error.message ||
            "Supabase error"
          )
        );

        return;
      }

      if (!p) {
        console.error(
          "PROFILE TIDAK DITEMUKAN.",
          "Auth User ID:",
          user.id
        );

        toastMsg(
          "Profil tidak ditemukan untuk akun login ini."
        );

        return;
      }

      /*
       * Nilai aman.
       */
      const fullName =
        p.full_name ||
        p.username ||
        "Member";

      const email =
        p.email ||
        user.email ||
        "";

      const username =
        p.username ||
        p.uid ||
        "—";

      const referral =
        p.referral_code ||
        "—";

      const status =
        p.status ||
        "active";

      const level =
        p.level ||
        "LV 1";

      const xp =
        Number(p.xp || 0);

      /*
       * HEADER
       */
      setText(
        "headerName",
        fullName
      );

      setText(
        "statusBadge",
        String(
          status
        ).toUpperCase()
      );

      /*
       * DATA AKUN UTAMA
       */
      setText(
        "nama",
        fullName
      );

      setText(
        "email",
        email
      );

      /*
       * UID:
       * tetap memakai UID dari profile.
       * Jika kosong, gunakan username.
       */
      setText(
        "uid",
        p.uid ||
        username
      );

      setText(
        "phone",
        p.phone ||
        "—"
      );

      setText(
        "referral",
        referral
      );

      setText(
        "status",
        status
      );

      setText(
        "level",
        level
      );

      /*
       * LEVEL CARD
       */
      const levelNumber =
        Number(
          String(level)
            .match(/\d+/)?.[0] ||
          1
        );

      setText(
        "levelShort",
        levelNumber
      );

      setText(
        "levelName",
        `LV ${levelNumber}`
      );

      setText(
        "nextLevel",
        `Menuju LV ${
          levelNumber + 1
        }`
      );

      /*
       * XP
       */
      const nextXP = 50;

      setText(
        "xpText",
        `${xp} / ${nextXP} XP`
      );

      const bars =
        document.querySelectorAll(
          "#xpBar"
        );

      bars.forEach(bar => {
        bar.style.width =
          Math.min(
            100,
            (xp / nextXP) * 100
          ) + "%";
      });

      /*
       * FORM EDIT PROFILE
       */
      const editNama =
        document.getElementById(
          "editNama"
        );

      const editEmail =
        document.getElementById(
          "editEmail"
        );

      const editPhone =
        document.getElementById(
          "editPhone"
        );

      if (editNama) {
        editNama.value =
          p.full_name || "";
      }

      if (editEmail) {
        editEmail.value =
          email;
      }

      if (editPhone) {
        editPhone.value =
          p.phone || "";
      }

      /*
       * DEBUG SUCCESS
       */
      console.log(
        "MYSHORT PROFILE BERHASIL:",
        {
          auth_user_id: user.id,
          profile_id: p.id,
          uid: p.uid,
          username: p.username,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          referral_code:
            p.referral_code,
          status: p.status,
          level: p.level,
          xp: p.xp,
          role: p.role
        }
      );

    } catch (e) {
      console.error(
        "PROFILE PAGE ERROR:",
        e
      );

      toastMsg(
        "Profile error: " +
        (
          e?.message ||
          e
        )
      );
    }
  }

  /*
   * Edit profile
   */
  window.showEdit =
    () => {
      document
        .getElementById(
          "editForm"
        )
        ?.classList.add(
          "show"
        );
    };

  window.hideEdit =
    () => {
      document
        .getElementById(
          "editForm"
        )
        ?.classList.remove(
          "show"
        );
    };

  window.saveProfile =
    async function () {
      const full_name =
        document
          .getElementById(
            "editNama"
          )
          ?.value.trim() || "";

      const email =
        document
          .getElementById(
            "editEmail"
          )
          ?.value.trim() || "";

      const phone =
        document
          .getElementById(
            "editPhone"
          )
          ?.value.trim() || "";

      if (!full_name || !email) {
        return toastMsg(
          "Nama dan email wajib diisi."
        );
      }

      try {
        const currentUser =
          await window.currentUser();

        if (!currentUser) {
          throw new Error(
            "Sesi login tidak ditemukan."
          );
        }

        /*
         * Update email Auth jika berubah.
         */
        if (
          email !==
          currentUser.email
        ) {
          const {
            error
          } =
            await sb.auth.updateUser(
              { email }
            );

          if (error) {
            throw error;
          }
        }

        /*
         * Update profile melalui RPC
         */
        const {
          error
        } =
          await sb.rpc(
            "update_my_profile",
            {
              p_full_name:
                full_name,
              p_phone:
                phone
            }
          );

        if (error) {
          throw error;
        }

        toastMsg(
          email !==
          currentUser.email
            ? "Profil tersimpan. Email akan tersinkron setelah perubahan Auth selesai."
            : "Profil tersimpan."
        );

        hideEdit();

        await load();

      } catch (e) {
        console.error(
          "SAVE PROFILE ERROR:",
          e
        );

        toastMsg(
          e?.message ||
          "Gagal menyimpan profil."
        );
      }
    };

  /*
   * Jalankan load pertama kali
   */
  await load();
}

/* =========================================================
   BANK
========================================================= */

async function bankPage() {
  const s = await initPage();
  if (!s) return;

  async function load() {
    const {
      data,
      error
    } = await sb
      .from("bank_accounts")
      .select("*")
      .eq(
        "user_id",
        s.user.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) throw error;

    const list =
      document.getElementById(
        "listBank"
      );

    if (!list) return;

    list.innerHTML =
      (data || [])
        .map(
          x => `
          <div class="bank-item">
            <b>
              ${escapeHTML(
                x.method
              )}
            </b>
            <br>
            ${escapeHTML(
              x.account_name
            )}
            •
            ${escapeHTML(
              x.account_number
            )}

            <button
              class="delete"
              data-id="${x.id}"
            >
              Hapus
            </button>
          </div>
        `
        )
        .join("") ||
      "<p>Belum ada rekening.</p>";

    list
      .querySelectorAll(
        "[data-id]"
      )
      .forEach(button => {
        button.onclick =
          async () => {
            if (
              !confirm(
                "Hapus rekening ini?"
              )
            ) {
              return;
            }

            const {
              error
            } =
              await sb
                .from(
                  "bank_accounts"
                )
                .delete()
                .eq(
                  "id",
                  button.dataset.id
                )
                .eq(
                  "user_id",
                  s.user.id
                );

            if (error) {
              toastMsg(
                error.message
              );
            } else {
              await load();
            }
          };
      });
  }

  window.simpanBank =
    async function () {
      const method =
        document.getElementById(
          "bank"
        )?.value || "";

      const name =
        document.getElementById(
          "nama"
        )?.value.trim() || "";

      const number =
        document.getElementById(
          "rekening"
        )?.value.trim() || "";

      if (
        !method ||
        !name ||
        !number
      ) {
        return toastMsg(
          "Lengkapi data rekening."
        );
      }

      const {
        error
      } =
        await sb
          .from(
            "bank_accounts"
          )
          .insert({
            user_id:
              s.user.id,
            method,
            account_name:
              name,
            account_number:
              number,
            is_default:
              true
          });

      if (error) {
        toastMsg(
          error.message
        );
      } else {
        toastMsg(
          "Rekening tersimpan."
        );

        document.getElementById(
          "nama"
        ).value = "";

        document.getElementById(
          "rekening"
        ).value = "";

        await load();
      }
    };

  await load();
}

/* =========================================================
   DEPOSIT
========================================================= */

async function depositPage() {
  const s = await initPage();
  if (!s) return;

  window.kirimDeposit =
    async function () {
      const method =
        document.getElementById(
          "metode"
        )?.value || "";

      const amount =
        Number(
          document.getElementById(
            "nominal"
          )?.value || 0
        );

      const note =
        document.getElementById(
          "catatan"
        )?.value.trim() || "";

      if (
        !method ||
        amount < 10000 ||
        amount > 10000000
      ) {
        return toastMsg(
          "Nominal deposit Rp10.000 - Rp10.000.000."
        );
      }

      const {
        error
      } =
        await sb.rpc(
          "request_deposit",
          {
            p_amount:
              amount,
            p_method:
              method,
            p_note:
              note || null
          }
        );

      if (error) {
        toastMsg(
          error.message
        );
      } else {
        toastMsg(
          "Pengajuan deposit berhasil. Menunggu verifikasi admin."
        );

        document.getElementById(
          "nominal"
        ).value = "";

        document.getElementById(
          "catatan"
        ).value = "";
      }
    };
}

/* =========================================================
   WITHDRAWAL
========================================================= */

async function withdrawalPage() {
  const s = await initPage();
  if (!s) return;

  const w =
    await loadWallet();

  setText(
    "saldo",
    moneyIDR(
      w?.balance || 0
    )
  );

  document
    .querySelectorAll(
      'a[href*="dashboard.dana.id"]'
    )
    .forEach(
      a =>
        a.style.display =
          "none"
    );

  const box =
    document.querySelector(
      ".container"
    );

  if (!box) return;

  const card =
    document.createElement(
      "div"
    );

  card.className = "card";
  card.style.marginTop =
    "18px";

  card.innerHTML = `
    <h3>Ajukan Withdrawal</h3>

    <label>Metode</label>

    <select id="wdMethod">
      <option>DANA</option>
      <option>BCA</option>
      <option>BRI</option>
      <option>BNI</option>
      <option>Mandiri</option>
      <option>Bank lainnya</option>
    </select>

    <label>
      Nomor rekening/akun
    </label>

    <input
      id="wdNumber"
      placeholder="Nomor DANA/rekening"
    >

    <label>
      Nama pemilik
    </label>

    <input
      id="wdName"
      placeholder="Sesuai rekening"
    >

    <label>
      Jumlah
    </label>

    <input
      id="wdAmount"
      type="number"
      min="10000"
      placeholder="Minimal Rp10.000"
    >

    <button
      id="wdBtn"
      class="dana-button"
      type="button"
    >
      Ajukan Withdrawal
    </button>
  `;

  box.appendChild(card);

  document.getElementById(
    "wdBtn"
  ).onclick = async () => {
    const amount =
      Number(
        document.getElementById(
          "wdAmount"
        )?.value || 0
      );

    const method =
      document.getElementById(
        "wdMethod"
      )?.value || "";

    const number =
      document.getElementById(
        "wdNumber"
      )?.value.trim() || "";

    const name =
      document.getElementById(
        "wdName"
      )?.value.trim() || "";

    if (
      amount < 10000 ||
      !number ||
      !name
    ) {
      return toastMsg(
        "Lengkapi data withdrawal."
      );
    }

    try {
      const {
        error
      } =
        await sb.rpc(
          "request_withdrawal",
          {
            p_amount:
              amount,
            p_method:
              method,
            p_account_number:
              number,
            p_account_name:
              name
          }
        );

      if (error) throw error;

      toastMsg(
        "Withdrawal berhasil diajukan."
      );

      setTimeout(
        () =>
          location.href =
            "history.html",
        700
      );

    } catch (e) {
      toastMsg(
        e?.message ||
        "Withdrawal gagal."
      );
    }
  };
}

/* =========================================================
   HISTORY
========================================================= */

async function historyPage() {
  const s = await initPage();
  if (!s) return;

  let rows = [];

  async function loadHistory(
    filter = "all"
  ) {
    const {
      data,
      error
    } =
      await sb
        .from("transactions")
        .select("*")
        .eq(
          "user_id",
          s.user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    if (error) throw error;

    rows = data || [];

    const deposits =
      rows
        .filter(
          x =>
            x.type ===
            "deposit"
        )
        .reduce(
          (a, x) =>
            a +
            Number(
              x.amount || 0
            ),
          0
        );

    const withdraw =
      rows
        .filter(
          x =>
            [
              "withdrawal",
              "withdrawal_refund"
            ].includes(
              x.type
            )
        )
        .reduce(
          (a, x) =>
            a +
            Number(
              x.type ===
              "withdrawal"
                ? x.amount
                : -x.amount
            ),
          0
        );

    setText(
      "totalDeposit",
      moneyIDR(
        deposits
      )
    );

    setText(
      "totalWithdraw",
      moneyIDR(
        Math.max(
          0,
          withdraw
        )
      )
    );

    setText(
      "jumlah",
      rows.length
    );

    const shown =
      filter === "all"
        ? rows
        : filter ===
          "Deposit"
        ? rows.filter(
            x =>
              x.type ===
              "deposit"
          )
        : rows.filter(
            x =>
              x.type ===
              "withdrawal"
          );

    const list =
      document.getElementById(
        "historyList"
      );

    if (!list) return;

    list.innerHTML =
      shown
        .map(
          x => `
          <div class="history-item">
            <b>
              ${escapeHTML(
                x.description ||
                x.type
              )}
            </b>

            <span>
              ${moneyIDR(
                x.amount
              )}
            </span>

            <small>
              ${formatDate(
                x.created_at
              )}
            </small>
          </div>
        `
        )
        .join("") ||
      "<p>Belum ada transaksi.</p>";
  }

  window.loadHistory =
    loadHistory;

  await loadHistory("all");
}

/* =========================================================
   REFERRAL
========================================================= */

async function referralPage() {
  const s = await initPage();
  if (!s) return;

  try {
    const p =
      await currentProfile();

    if (!p) {
      toastMsg(
        "Data profil tidak ditemukan. Silakan login ulang."
      );
      return;
    }

    const memberName =
      p.full_name ||
      p.username ||
      "Member";

    setText(
      "headerName",
      memberName
    );

    setText(
      "memberName",
      memberName
    );

    setText(
      "kode",
      p.referral_code ||
      "—"
    );

    const base =
      location.origin +
      location.pathname.replace(
        /[^/]+$/,
        ""
      );

    const url =
      base +
      "register.html?ref=" +
      encodeURIComponent(
        p.referral_code ||
        ""
      );

    setText(
      "link",
      url
    );

    window.copyLink =
      async function () {
        try {
          await navigator.clipboard.writeText(
            url
          );

          toastMsg(
            "Link referral disalin."
          );

        } catch (e) {
          window.prompt(
            "Salin link referral ini:",
            url
          );
        }
      };

    window.claimReward =
      async function () {
        const btn =
          document.getElementById(
            "claimBtn"
          );

        if (btn) {
          btn.disabled =
            true;
        }

        try {
          const {
            error
          } =
            await sb.rpc(
              "claim_referral_reward"
            );

          if (error)
            throw error;

          toastMsg(
            "Hadiah referral berhasil masuk ke wallet."
          );

          await load();

        } catch (e) {
          if (btn) {
            btn.disabled =
              false;
          }

          toastMsg(
            e?.message ||
            "Klaim referral gagal."
          );
        }
      };

    async function load() {
      const {
        data,
        error
      } =
        await sb
          .from("referrals")
          .select(
            "id,referred_id,status,reward,created_at"
          )
          .eq(
            "referrer_id",
            s.user.id
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      if (error) throw error;

      const rows =
        data || [];

      const ids =
        rows
          .map(
            x =>
              x.referred_id
          )
          .filter(Boolean);

      const names = {};

      if (ids.length) {
        const {
          data: ps,
          error: pe
        } =
          await sb
            .from("profiles")
            .select(
              "id,full_name,username"
            )
            .in(
              "id",
              ids
            );

        if (pe) throw pe;

        (ps || [])
          .forEach(
            x =>
              names[x.id] = x
          );
      }

      const list =
        document.getElementById(
          "listMember"
        );

      if (list) {
        list.innerHTML =
          rows
            .map(x => {
              const qualified =
                x.status ===
                "qualified";

              const label =
                qualified
                  ? "AI-MAX dibeli — memenuhi syarat"
                  : "Belum membeli AI-MAX";

              const member =
                names[
                  x.referred_id
                ];

              return `
                <div class="member">
                  <b>
                    ${escapeHTML(
                      member?.full_name ||
                      member?.username ||
                      "Member"
                    )}
                  </b>
                  <br>
                  Status:
                  ${label}
                </div>
              `;
            })
            .join("") ||
          '<div class="empty">Belum ada referral.</div>';
      }

      const count =
        rows.length;

      const qualifiedCount =
        rows.filter(
          x =>
            x.status ===
            "qualified"
        ).length;

      setText(
        "anggota",
        count
      );

      setText(
        "bonus",
        moneyIDR(0)
      );

      const btn =
        document.getElementById(
          "claimBtn"
        );

      if (btn) {
        btn.disabled =
          qualifiedCount < 3;

        btn.textContent =
          qualifiedCount >= 3
            ? "Klaim Rp25.000"
            : `Butuh 3 teman pembeli AI-MAX (${qualifiedCount}/3)`;
      }

      const rs =
        document.getElementById(
          "rewardStatus"
        );

      if (rs) {
        rs.textContent =
          qualifiedCount >= 3
            ? "3 teman sudah membeli AI-MAX. Verifikasi email tetap wajib."
            : `Progress pembelian AI-MAX: ${qualifiedCount}/3. Verifikasi email saja tidak cukup.`;
      }
    }

    await load();

  } catch (e) {
    console.error(
      "REFERRAL PAGE ERROR:",
      e
    );

    toastMsg(
      "Gagal memuat data referral: " +
      (
        e?.message ||
        "koneksi Supabase"
      )
    );
  }
}

/* =========================================================
   ADMIN
========================================================= */

async function adminPage() {
  const s = await initPage();
  if (!s) return;

  const p =
    await currentProfile();

  if (!p) {
    toastMsg(
      "Profil admin tidak ditemukan."
    );

    setTimeout(
      () =>
        location.href =
          "dashboard.html",
      700
    );

    return;
  }

  if (
    p.role !== "admin"
  ) {
    toastMsg(
      "Akses admin diperlukan."
    );

    setTimeout(
      () =>
        location.href =
          "dashboard.html",
      700
    );

    return;
  }

  const root =
    document.getElementById(
      "adminRoot"
    );

  if (!root) return;

  async function load() {
    const [
      {
        data: ws,
        error: we
      },
      {
        data: ds,
        error: de
      },
      {
        data: wd,
        error: wde
      }
    ] =
      await Promise.all([
        sb
          .from("profiles")
          .select(
            "id,uid,full_name,email,role,status,created_at"
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          ),

        sb
          .from("deposits")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(50),

        sb
          .from("withdrawals")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(50)
      ]);

    if (we) throw we;
    if (de) throw de;
    if (wde) throw wde;

    root.innerHTML = `
      <h2>Admin Panel</h2>

      <h3>Member</h3>

      <div class="table">
        ${
          (ws || [])
            .map(
              x => `
                <div class="row">
                  <span>
                    ${escapeHTML(
                      x.full_name ||
                      x.uid ||
                      "Member"
                    )}

                    <small>
                      ${escapeHTML(
                        x.email ||
                        ""
                      )}
                      •
                      ${escapeHTML(
                        x.role ||
                        ""
                      )}
                    </small>
                  </span>

                  <b>
                    ${escapeHTML(
                      x.status ||
                      ""
                    )}
                  </b>
                </div>
              `
            )
            .join("") ||
          "Tidak ada member."
        }
      </div>

      <h3>Deposit</h3>

      <div class="table">
        ${
          (ds || [])
            .map(
              x => `
                <div class="row">
                  <span>
                    #${x.id}
                    •
                    ${moneyIDR(
                      x.amount
                    )}

                    <small>
                      ${escapeHTML(
                        x.method ||
                        ""
                      )}
                      •
                      ${formatDate(
                        x.created_at
                      )}
                    </small>
                  </span>

                  <span>
                    ${
                      x.status ===
                      "pending"
                        ? `
                          <button
                            data-dep="${x.id}"
                            data-st="approved"
                          >
                            Setujui
                          </button>

                          <button
                            data-dep="${x.id}"
                            data-st="rejected"
                          >
                            Tolak
                          </button>
                        `
                        : escapeHTML(
                            x.status ||
                            ""
                          )
                    }
                  </span>
                </div>
              `
            )
            .join("") ||
          "Tidak ada"
        }
      </div>

      <h3>Withdrawal</h3>

      <div class="table">
        ${
          (wd || [])
            .map(
              x => `
                <div class="row">
                  <span>
                    #${x.id}
                    •
                    ${moneyIDR(
                      x.amount
                    )}

                    <small>
                      ${escapeHTML(
                        x.method ||
                        ""
                      )}
                      ${escapeHTML(
                        x.account_number ||
                        ""
                      )}
                      •
                      ${formatDate(
                        x.created_at
                      )}
                    </small>
                  </span>

                  <span>
                    ${
                      x.status ===
                      "pending"
                        ? `
                          <button
                            data-wd="${x.id}"
                            data-st="approved"
                          >
                            Setujui
                          </button>

                          <button
                            data-wd="${x.id}"
                            data-st="rejected"
                          >
                            Tolak
                          </button>
                        `
                        : escapeHTML(
                            x.status ||
                            ""
                          )
                    }
                  </span>
                </div>
              `
            )
            .join("") ||
          "Tidak ada"
        }
      </div>
    `;

    root
      .querySelectorAll(
        "[data-dep]"
      )
      .forEach(button => {
        button.onclick =
          async () => {
            const {
              error
            } =
              await sb.rpc(
                "admin_set_deposit_status",
                {
                  p_id:
                    Number(
                      button.dataset.dep
                    ),
                  p_status:
                    button.dataset.st,
                  p_note:
                    null
                }
              );

            if (error) {
              toastMsg(
                error.message
              );
            } else {
              await load();
            }
          };
      });

    root
      .querySelectorAll(
        "[data-wd]"
      )
      .forEach(button => {
        button.onclick =
          async () => {
            const {
              error
            } =
              await sb.rpc(
                "admin_set_withdrawal_status",
                {
                  p_id:
                    Number(
                      button.dataset.wd
                    ),
                  p_status:
                    button.dataset.st,
                  p_note:
                    null
                }
              );

            if (error) {
              toastMsg(
                error.message
              );
            } else {
              await load();
            }
          };
      });
  }

  await load();
}

/* =========================================================
   PAGE DISPATCHER
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      /*
       * Supabase config harus sudah dimuat
       * sebelum pages.js.
       */
      if (
        typeof sb === "undefined"
      ) {
        console.error(
          "Supabase client belum tersedia."
        );

        return;
      }

      keepMemberSession();

      if (
        page === "index.html" ||
        page === ""
      ) {
        await loginPage();

      } else if (
        page ===
        "forgot-password.html"
      ) {
        await forgotPasswordPage();

      } else if (
        page ===
        "reset-password.html"
      ) {
        await resetPasswordPage();

      } else if (
        page ===
        "register.html"
      ) {
        await registerPage();

      } else if (
        page ===
        "dashboard.html"
      ) {
        await dashboardPage();

      } else if (
        page ===
        "wallet.html"
      ) {
        await walletPage();

      } else if (
        page ===
        "mission.html"
      ) {
        await missionPage();

      } else if (
        page ===
        "profile.html"
      ) {
        await profilePage();

      } else if (
        page ===
        "bank.html"
      ) {
        await bankPage();

      } else if (
        page ===
        "deposit.html"
      ) {
        await depositPage();

      } else if (
        page ===
        "withdrawal.html"
      ) {
        await withdrawalPage();

      } else if (
        page ===
        "history.html"
      ) {
        await historyPage();

      } else if (
        page ===
        "referral.html"
      ) {
        await referralPage();

      } else if (
        page ===
        "admin.html"
      ) {
        await adminPage();
      }

    } catch (e) {
      console.error(
        "MYSHORT PAGE ERROR:",
        e
      );

      if (
        typeof toastMsg ===
        "function"
      ) {
        toastMsg(
          e?.message ||
          "Terjadi kesalahan."
        );
      }
    }
  }
);
