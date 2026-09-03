// Shared application helpers.
async function initPage() {
  const s = await requireAuth();
  if (!s) return null;
  return s;
}
function setText(id, value) { const e=document.getElementById(id); if(e) e.textContent=value; }
function formatDate(v) {
  return v ? new Date(v).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}) : "-";
}
async function refreshBalance(ids=["balanceValue","amount"]) {
  try {
    const w=await loadWallet();
    ids.forEach(id=>setText(id, moneyIDR(w?.balance)));
    return w;
  } catch(e) { console.error(e); return null; }
}
