// ==== Config ====
const BASE_URL = ""; // same-origin

// ==== Sessão/Helpers ====
function getSession() { return { username: sessionStorage.getItem("username") || "", role: sessionStorage.getItem("role") || "" }; }
function setSession(u, r) { sessionStorage.setItem("username", u); sessionStorage.setItem("role", r); }
function clearSession() { sessionStorage.clear(); }
function ensureSessionOrRedirect() { const s = getSession(); if (!s.username || !s.role) { location.href = "/"; return null; } return s; }

async function apiGet(path) {
  const { username, role } = getSession();
  const r = await fetch(`${BASE_URL}${path}`, { headers: { "X-User": username, "X-Role": role } });
  let data = {}; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.message || `Erro ${r.status} em GET ${path}`);
  return data;
}
async function apiPost(path, body) {
  const { username, role } = getSession();
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User": username, "X-Role": role },
    body: JSON.stringify(body || {})
  });
  let data = {}; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.message || `Erro ${r.status} em POST ${path}`);
  return data;
}

// ==== UI genérico ====
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
function q(id){ return document.getElementById(id); }
function setDisabled(el, v){ if (!el) return; el.disabled = !!v; v ? el.setAttribute("disabled","disabled") : el.removeAttribute("disabled"); }

function renderTable(container, columns, rows, { selectable=false, rowId="id" }={}) {
  const wrap = (typeof container === "string") ? document.querySelector(container) : container;
  if (!wrap) return null;
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const trh = document.createElement("tr");
  columns.forEach(c => trh.appendChild(el(`<th>${c.header}</th>`)));
  thead.appendChild(trh);
  (rows||[]).forEach(r => {
    const tr = document.createElement("tr");
    if (selectable) tr.classList.add("selectable");
    tr.dataset.id = r[rowId];
    columns.forEach(c => {
      const td = document.createElement("td");
      td.innerHTML = (typeof c.cell === "function") ? c.cell(r) : (r[c.field] ?? "");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(thead); table.appendChild(tbody);
  wrap.innerHTML = ""; wrap.appendChild(table);
  return table;
}

// ⚠️ NÃO converte o id — quem chamar decide
function bindSelectableRows(table, onSelect) {
  if (!table) return;
  Array.from(table.querySelectorAll("tbody tr")).forEach(tr => {
    tr.addEventListener("click", () => {
      table.querySelectorAll("tbody tr").forEach(x => x.classList.remove("selected"));
      tr.classList.add("selected");
      onSelect?.(tr.dataset.id, tr);
    });
  });
}

function badgeOnOff(v) { return v ? `<span class="badge on">Ativo</span>` : `<span class="badge off">Inativo</span>`; }

// ==== Login ====
function initLogin() {
  const form = q("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = q("username").value.trim();
    const password = q("password").value.trim();
    try {
      const data = await apiPost("/api/login", { username, password });
      setSession(data.username, data.role);
      location.href = data.role === "admin" ? "/admin" : "/tester-dashboard.html";
    } catch (err) { alert(err.message || "Falha no login"); }
  });
}

// ==== Logout ====
function wireLogout() { const btn = q("btnLogout"); if (!btn) return; btn.addEventListener("click", () => { clearSession(); location.href = "/"; }); }

// ===================== ADMIN HUB =====================
function initAdminHub() { if (!ensureSessionOrRedirect()) return; wireLogout(); }

// ===================== ADMIN: TESTES =====================
let cachedTests = [];
let selectedTestId = null;
let selectedTemplates = [];

function requiredFilledForTest() {
  const name = q("t_name")?.value.trim();
  const sys  = String(q("t_system")?.value || "");
  const mod  = q("t_module")?.value.trim();
  return !!(name && sys && mod);
}
function updateTestFormButtons() {
  const reqOk = requiredFilledForTest();
  const hasSel = !!selectedTestId;
  setDisabled(q("btnCreateTest"), hasSel ? true : !reqOk);
  setDisabled(q("btnUpdateTest"), hasSel ? !reqOk : true);
  setDisabled(q("btnDeleteTest"), !hasSel);
  setDisabled(q("btnToggleTest"), !hasSel);
}
function wireRequiredInputs() {
  ["t_name","t_system","t_module","t_project","t_cycles","t_tokens","t_desc"].forEach(id=>{
    const e = q(id); if (!e) return;
    e.addEventListener("input", updateTestFormButtons);
    e.addEventListener("change", updateTestFormButtons);
  });
}

async function loadSystemsAndModules() {
  const sysSel = q("t_system"); const modSel = q("t_module");
  if (!sysSel || !modSel) return;
  const { systems } = await apiGet("/api/systems");
  sysSel.innerHTML = systems.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  if (systems.length) sysSel.value = String(systems[0].id);
  const mods = (systems[0]?.modules || []);
  modSel.innerHTML = `<option value="">Selecione um Módulo</option>` + mods.map(m => `<option value="${m}">${m}</option>`).join("");
  updateTestFormButtons();
}

async function loadTemplatesByModule() {
  const modSel = q("t_module"); const cont = q("testTemplatesContainer"); const desc = q("t_desc");
  cont.innerHTML = ""; selectedTemplates = []; desc.value = "";
  const module = modSel.value; if (!module) { updateTestFormButtons(); return; }
  const res = await apiGet(`/api/test-templates?module=${encodeURIComponent(module)}`);
  const list = res.templates || [];
  list.forEach(t => {
    const token = el(
      `<div class="test-token" data-code="${t.code}">
        <span class="token-tag">${t.category}</span><strong>${t.name}</strong><span class="token-code">${t.code}</span>
      </div>`
    );
    token.addEventListener("click", () => {
      token.classList.toggle("selected-template");
      const code = t.code;
      if (selectedTemplates.includes(code)) selectedTemplates = selectedTemplates.filter(x => x !== code);
      else selectedTemplates.push(code);
      const chosen = list.filter(x => selectedTemplates.includes(x.code));
      desc.value = chosen.map(x => `${x.name} (${x.code}) - ${x.desc}`).join(" | ");
    });
    cont.appendChild(token);
  });
  updateTestFormButtons();
}

function renderAdminTestsTable(tests) {
  cachedTests = [...tests];
  const cols = [
    { header: "ID", field: "id" },
    { header: "Nome", field: "name" },
    { header: "Módulo", field: "module" },
    { header: "Projeto", field: "project" },
    { header: "Ciclos", field: "cycles_qty" },
    { header: "Status", cell: r => badgeOnOff(!!r.active) }
  ];
  const table = renderTable("#testsList", cols, cachedTests, { selectable: true });
  makeRowsDraggable(table);

  // Converte id aqui (numérico)
  bindSelectableRows(table, (idStr) => {
    const id = Number(idStr);
    selectedTestId = id;
    const t = cachedTests.find(x => x.id === id);
    fillTestForm(t);
    updateTestFormButtons();
  });

  setDisabled(q("btnSaveOrder"), !(cachedTests.length > 0));
}

function fillTestForm(t) {
  q("t_id").value = t?.id || "";
  q("t_system").value = String(t?.system_id || q("t_system").value || "");
  q("t_module").value = t?.module || "";
  q("t_project").value = t?.project || "Global";
  q("t_cycles").value = t?.cycles_qty || 1;
  q("t_name").value = t?.name || "";
  q("t_desc").value = t?.description || "";
  q("t_tokens").value = t?.tokens || "";
}
function clearTestForm() {
  selectedTestId = null;
  ["t_id","t_name","t_desc","t_tokens"].forEach(id => q(id).value = "");
  q("t_cycles").value = 1;
  updateTestFormButtons();
}

async function loadAdminTests() {
  const data = await apiGet("/api/admin/tests");
  renderAdminTestsTable(data.tests || []);
}

function makeRowsDraggable(table) {
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  rows.forEach(tr => {
    tr.setAttribute("draggable", "true");
    tr.classList.add("draggable");
    tr.addEventListener("dragstart", e => { tr.classList.add("dragging"); e.dataTransfer.setData("text/plain", tr.dataset.id); });
    tr.addEventListener("dragend", () => tr.classList.remove("dragging"));
    tr.addEventListener("dragover", e => { e.preventDefault(); tr.classList.add("drag-over"); });
    tr.addEventListener("dragleave", () => tr.classList.remove("drag-over"));
    tr.addEventListener("drop", e => {
      e.preventDefault(); tr.classList.remove("drag-over");
      const fromId = e.dataTransfer.getData("text/plain");
      const body = table.querySelector("tbody"); const fromEl = body.querySelector(`tr[data-id="${fromId}"]`);
      if (!fromEl || fromId === tr.dataset.id) return;
      const toIndex = Array.from(body.children).indexOf(tr);
      body.removeChild(fromEl);
      body.insertBefore(fromEl, (Array.from(body.children)[toIndex] || null));
      const newOrder = Array.from(body.children).map(x => Number(x.dataset.id));
      cachedTests.sort((a,b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      setDisabled(q("btnSaveOrder"), !(cachedTests.length > 0));
    });
  });
}

function wireAdminTestsForm() {
  const form = q("testForm");
  if (form?.dataset.bound === "1") return;
  form.dataset.bound = "1";

  wireRequiredInputs();
  q("t_module")?.addEventListener("change", () => { loadTemplatesByModule().catch(()=>{}); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.saving === "1") return;
    form.dataset.saving = "1";
    try {
      const payload = {
        id: selectedTestId ? Number(selectedTestId) : undefined,
        name: q("t_name").value.trim(),
        description: q("t_desc").value.trim(),
        system_id: Number(q("t_system").value),
        module: q("t_module").value.trim(),
        tokens: q("t_tokens").value.trim(),
        project: q("t_project").value.trim(),
        cycles_qty: Number(q("t_cycles").value || 1)
      };
      if (!payload.name || !payload.system_id || !payload.module) { alert("Preencha Nome, Sistema e Módulo."); form.dataset.saving = "0"; return; }
      if (selectedTestId) await apiPost("/api/admin/tests/update", payload);
      else await apiPost("/api/admin/tests", payload);
      clearTestForm();
      await loadAdminTests();
      alert("Teste salvo!");
    } catch (err) {
      alert(err.message || "Erro ao salvar teste");
    } finally {
      form.dataset.saving = "0";
    }
  });

  q("btnDeleteTest")?.addEventListener("click", async () => {
    if (!selectedTestId) return;
    if (!confirm("Excluir este teste?")) return;
    try {
      await apiPost("/api/admin/tests/delete", { id: Number(selectedTestId) });
      clearTestForm();
      await loadAdminTests();
      alert("Teste excluído!");
    } catch (err) { alert(err.message || "Erro ao excluir teste"); }
  });

  q("btnToggleTest")?.addEventListener("click", async () => {
    if (!selectedTestId) return;
    const t = cachedTests.find(x => x.id === selectedTestId);
    if (!t) return;
    try {
      await apiPost("/api/admin/tests/update", { id: t.id, active: !t.active });
      await loadAdminTests();
    } catch (err) { alert(err.message || "Erro ao alterar status"); }
  });

  q("btnSaveOrder")?.addEventListener("click", async () => {
    try {
      const ordered_ids = cachedTests.map(t => t.id);
      await apiPost("/api/admin/tests/reorder", { ordered_ids });
      await loadAdminTests();
      alert("Ordem salva!");
    } catch (err) { alert(err.message || "Erro ao salvar ordem"); }
  });
}

function initAdminTests() {
  if (!ensureSessionOrRedirect()) return;
  wireLogout();
  wireAdminTestsForm();
  loadSystemsAndModules().then(updateTestFormButtons).catch(()=>{});
  loadAdminTests().catch(err => alert(err.message));
  updateTestFormButtons();
}

// ===================== ADMIN: USERS (username/email/credential únicos) =====================
let cachedUsers = [];
let selectedUsername = "";

async function loadUsers() {
  const data = await apiGet("/api/admin/users");
  cachedUsers = data.users || [];
  const cols = [
    { header: "Username", field: "username" },
    { header: "Nome", field: "name" },
    { header: "Email", field: "email" },
    { header: "Credencial", field: "credential" },
    { header: "Depto", field: "department" },
    { header: "Status", cell: r => badgeOnOff(!!r.active) }
  ];
  const table = renderTable("#usersList", cols, cachedUsers, { selectable: true, rowId: "username" });
  bindSelectableRows(table, (username) => {
    selectedUsername = String(username);
    const u = cachedUsers.find(x => x.username === selectedUsername);
    fillUserForm(u);
    toggleUserButtons(true);
    loadUserLogs(selectedUsername).catch(()=>{});
  });
}

function fillUserForm(u) {
  q("u_original_username").value = u?.username || "";
  q("u_username").value = u?.username || "";
  q("u_name").value = u?.name || "";
  q("u_email").value = u?.email || "";
  q("u_credential").value = u?.credential || "";
  q("u_department").value = u?.department || "";
  q("u_birth_date").value = u?.birth_date || "";
}
function clearUserForm() {
  selectedUsername = "";
  ["u_original_username","u_username","u_name","u_email","u_credential","u_department","u_birth_date"].forEach(id => { const e=q(id); if(e) e.value=""; });
  toggleUserButtons(false);
  q("userLogs").innerHTML = "";
  q("loginCount").textContent = "0";
}
function toggleUserButtons(enabled) {
  setDisabled(q("btnUpdateUser"), !enabled);
  setDisabled(q("btnToggleUser"), !enabled);
  setDisabled(q("btnDeleteUser"), !enabled);
}
async function loadUserLogs(username) {
  const data = await apiGet(`/api/admin/users/logs?username=${encodeURIComponent(username)}`);
  q("loginCount").textContent = String(data.login_count || 0);
  const cols = [
    { header: "Evento", field: "event" },
    { header: "Timestamp", field: "ts" },
    { header: "Usuário", field: "username" }
  ];
  renderTable("#userLogs", cols, data.logs || []);
}

function wireAdminUsersForm() {
  const form = q("userForm");
  if (form?.dataset.bound === "1") return;
  form.dataset.bound = "1";

  const norm = (s)=> (s||"").trim().toLowerCase();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.saving === "1") return;
    form.dataset.saving = "1";
    try {
      const body = {
        username: q("u_username").value.trim(),
        name: q("u_name").value.trim(),
        email: q("u_email").value.trim(),
        credential: q("u_credential").value.trim(),
        department: q("u_department").value.trim(),
        birth_date: q("u_birth_date").value
      };
      const original = q("u_original_username").value.trim();

      // Bloqueio no front (username/email/credential únicos)
      const conflict = (u) =>
        (!original || norm(u.username) !== norm(original)) && (
          (body.username && norm(u.username) === norm(body.username)) ||
          (body.email && u.email && norm(u.email) === norm(body.email)) ||
          (body.credential && u.credential && norm(u.credential) === norm(body.credential))
        );
      if (cachedUsers.some(conflict)) {
        alert("Já existe usuário com mesmo username, email ou credencial.");
        form.dataset.saving = "0";
        return;
      }

      if (original) {
        const payload = { username: original };
        if (body.username && norm(body.username) !== norm(original)) payload.new_username = body.username;
        ["name","email","credential","department","birth_date"].forEach(k => payload[k] = body[k] || "");
        await apiPost("/api/admin/users/update", payload);
      } else {
        if (!body.username) { alert("Username é obrigatório."); form.dataset.saving="0"; return; }
        await apiPost("/api/admin/users", body);
      }

      clearUserForm();
      await loadUsers();
      alert("Salvo!");
    } catch (err) {
      alert(err.message || "Erro ao salvar usuário");
    } finally {
      form.dataset.saving = "0";
    }
  });

  q("btnUpdateUser")?.addEventListener("click", () => form.requestSubmit());

  q("btnToggleUser")?.addEventListener("click", async () => {
    if (!selectedUsername) return;
    try {
      const u = cachedUsers.find(x => x.username === selectedUsername);
      await apiPost("/api/admin/users/update", { username: selectedUsername, active: !u.active });
      await loadUsers();
      alert("Status atualizado!");
    } catch (err) { alert(err.message || "Erro ao alterar status"); }
  });

  q("btnDeleteUser")?.addEventListener("click", async () => {
    if (!selectedUsername) return;

    const normStr = (s)=> (s||"").trim().toLowerCase();
    const stillExists = cachedUsers.some(u => normStr(u.username) === normStr(selectedUsername));
    if (!stillExists) {
      alert("O usuário selecionado não está mais na lista. Recarregando usuários…");
      await loadUsers();
      clearUserForm();
      return;
    }

    if (!confirm(`Excluir o usuário "${selectedUsername}"?`)) return;
    try {
      await apiPost("/api/admin/users/delete", { username: selectedUsername.trim() });
      clearUserForm();
      await loadUsers();
      alert("Usuário excluído!");
    } catch (err) {
      alert(err.message || "Erro ao excluir usuário");
    }
  });
}

function initAdminUsers() {
  if (!ensureSessionOrRedirect()) return;
  wireLogout();
  wireAdminUsersForm();
  loadUsers().catch(err => alert(err.message));
}

// ===================== ADMIN: MÉTRICAS =====================
async function loadMetrics() {
  const data = await apiGet("/api/admin/metrics");

  // === KPI geral (barra grande) ===
  const overall = Math.min(100, data.overall_success_rate || 0);
  q("overallSuccess").textContent = `${overall}%`;
  const kpi = q("chartOverall");
  kpi.innerHTML = `<div class="kpi-rail"><div class="kpi-fill" id="kpiFill"></div></div>`;
  requestAnimationFrame(() => { q("kpiFill").style.width = `${overall}%`; });

  // paleta
  const palette = [
    "#1d4ed8","#059669","#9333ea","#dc2626","#f59e0b","#0ea5e9",
    "#16a34a","#7c3aed","#ea580c","#14b8a6","#64748b","#2563eb"
  ];
  const color = (i) => palette[i % palette.length];
  const tier = (pct) => pct >= 80 ? ["Excelente","good"]
                   : pct >= 60 ? ["Bom","ok"]
                   : ["Atenção","poor"];

  // ========= POR TESTE =========
  // 1) Tabela (como antes)
  const colsT = [
    { header: "Teste", field: "test_name" },
    { header: "Módulo", field: "module" },
    { header: "Projeto", field: "project" },
    { header: "Runs", field: "total_runs" },
    { header: "Ciclos", field: "total_cycles" },
    { header: "Sucesso %", field: "success_rate" }
  ];
  const orderedTests = (data.per_test || []).slice()
    .sort((a,b)=> (b.success_rate||0) - (a.success_rate||0));
  renderTable("#metricsByTest", colsT, orderedTests);

  // 2) Barras coloridas com números
  const listTests = q("chartTests");
  listTests.className = "chart-list";
  listTests.innerHTML = "";
  orderedTests.forEach((t, i) => {
    const pct = Math.round(t.success_rate || 0);
    const [label, cls] = tier(pct);
    const row = el(`
      <div class="chart-row">
        <div class="chart-name">
          ${t.test_name}
          <span class="chart-badge">${t.module}</span>
          <span class="chart-badge">${t.project}</span>
          <span class="badge-tier ${cls}">${label}</span>
        </div>
        <div class="chart-bar">
          <div class="chart-fill" style="--bar-color:${color(i)}"></div>
          <span class="chart-value">${pct}%</span>
          <span class="chart-ghost">runs: ${t.total_runs} · ciclos: ${t.total_cycles}</span>
        </div>
      </div>
    `);
    listTests.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector(".chart-fill").style.width = `${pct}%`;
    });
  });

  // ========= POR USUÁRIO =========
  // 1) Tabela (como antes)
  const colsU = [
    { header: "Usuário", field: "username" },
    { header: "Runs", field: "runs" },
    { header: "Ciclos", field: "total_cycles" },
    { header: "Sucesso %", field: "success_rate" }
  ];
  const orderedUsers = (data.per_user || []).slice()
    .sort((a,b)=> (b.success_rate||0) - (a.success_rate||0));
  renderTable("#metricsByUser", colsU, orderedUsers);

  // 2) Barras coloridas com números
  const listUsers = q("chartUsers");
  listUsers.className = "chart-list";
  listUsers.innerHTML = "";
  orderedUsers.forEach((u, i) => {
    const pct = Math.round(u.success_rate || 0);
    const [label, cls] = tier(pct);
    const row = el(`
      <div class="chart-row">
        <div class="chart-name">
          ${u.username}
          <span class="badge-tier ${cls}">${label}</span>
        </div>
        <div class="chart-bar">
          <div class="chart-fill" style="--bar-color:${color(i+3)}"></div>
          <span class="chart-value">${pct}%</span>
          <span class="chart-ghost">runs: ${u.runs} · ciclos: ${u.total_cycles}</span>
        </div>
      </div>
    `);
    listUsers.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector(".chart-fill").style.width = `${pct}%`;
    });
  });
}


function initAdminMetrics() { if (!ensureSessionOrRedirect()) return; wireLogout(); loadMetrics().catch(err => alert(err.message)); q("btnRefreshMetrics")?.addEventListener("click", () => { loadMetrics().catch(err => alert(err.message)); }); }

// ===================== TESTER DASHBOARD =====================
let testerSelectedTestId = null;

async function loadTesterActiveTests() {
  const data = await apiGet("/api/tester/tests");
  const cols = [
    { header: "ID", field: "id" },
    { header: "Nome", field: "name" },
    { header: "Módulo", field: "module" },
    { header: "Projeto", field: "project" },
    { header: "Ciclos", field: "cycles_qty" }
  ];
  const table = renderTable("#activeTests", cols, data.tests || [], { selectable: true });

  // Converte id aqui (numérico)
  bindSelectableRows(table, (idStr) => {
    testerSelectedTestId = Number(idStr);
    setDisabled(q("btnExecute"), false);
  });
}

async function loadTesterMyResults() {
  const data = await apiGet("/api/tester/results");
  q("myRate").textContent = `${data.my_success_rate || 0}%`;
  const cols = [
    { header: "Teste", field: "test_name" },
    { header: "Ciclos", field: "cycles" },
    { header: "Sucessos", field: "successes" },
    { header: "Falhas", field: "failures" },
    { header: "Timestamp", field: "ts" }
  ];
  renderTable("#myResults", cols, data.results || []);
}

function wireTesterActions() {
  const btn = q("btnExecute");
  const cyclesEl = q("cycles");
  if (!btn) return;

  // evita adicionar o mesmo listener mais de uma vez
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  // trava contra clique duplo/rápido
  let running = false;

  btn.addEventListener("click", async (e) => {
    e.preventDefault(); // caso esteja dentro de um <form>
    if (running) return;
    running = true;

    try {
      if (!testerSelectedTestId) return;
      const cycles = Math.max(1, Math.min(5, Number(cyclesEl.value || 1))); // saneia 1–5
      await apiPost("/api/tester/execute", { id: testerSelectedTestId, cycles });
      await loadTesterActiveTests();
      await loadTesterMyResults();
    } catch (err) {
      alert(err.message || "Erro ao executar teste");
    } finally {
      running = false;
    }
  });
}

function initTesterDashboard() {
  const s = ensureSessionOrRedirect(); if (!s) return;
  wireLogout();
  q("whoami").textContent = s.username;
  setDisabled(q("btnExecute"), true);
  loadTesterActiveTests().catch(err => alert(err.message));
  loadTesterMyResults().catch(err => alert(err.message));
  wireTesterActions();
}

// ==== Bootstrap ====
document.addEventListener("DOMContentLoaded", () => {
  const bodyId = document.body?.id || "";
  if (bodyId === "page-login") initLogin();
  if (bodyId === "page-admin-hub") initAdminHub();
  if (bodyId === "page-admin-tests") initAdminTests();
  if (bodyId === "page-admin-users") initAdminUsers();
  if (bodyId === "page-admin-metrics") initAdminMetrics();
  if (bodyId === "page-tester") initTesterDashboard();
});
