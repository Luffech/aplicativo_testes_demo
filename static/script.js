const BASE_URL = "http://127.0.0.1:5000";

function saveSession(username, role){ localStorage.setItem("tm_user", JSON.stringify({username, role})); }
function getSession(){ try{return JSON.parse(localStorage.getItem("tm_user")||"{}");}catch{return{};} }
function clearSession(){ localStorage.removeItem("tm_user"); }

async function apiGet(path){
  const s = getSession();
  const r = await fetch(`${BASE_URL}${path}`, { headers:{ "X-User": s.username||"", "X-Role": s.role||"" }});
  return r.json();
}
async function apiPost(path, body){
  const s = getSession();
  const r = await fetch(`${BASE_URL}${path}`, {
    method:"POST",
    headers:{ "Content-Type":"application/json", "X-User": s.username||"", "X-Role": s.role||"" },
    body: JSON.stringify(body||{})
  });
  return r.json();
}

function table(headers, rows){
  const th = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>`;
  const tb = `<tbody>${rows.join("")}</tbody>`;
  return `<table>${th}${tb}</table>`;
}
function tsToStr(ts){ return new Date(ts*1000).toLocaleString(); }

async function initLogin(){
  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const res = await fetch(`${BASE_URL}/api/login`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();
    if(!data.ok){ alert(data.message||"Falha no login."); return; }

    saveSession(data.username, data.role);
    if (data.role === "admin") {
        location.href = "/admin";
    } else {
        location.href = "/tester-dashboard.html";
    }
  });
}

async function initAdminTests(){
  const s = getSession(); if(!s.username){ location.href="/"; return; }
  document.getElementById("btnLogout").onclick = ()=>{ clearSession(); location.href="/"; };

  const nameEl = document.getElementById("t_name");
  const sysEl  = document.getElementById("t_system");
  const modEl  = document.getElementById("t_module");
  const descEl = document.getElementById("t_desc");
  const btnCreate = document.getElementById("btnCreateTest");
  const btnUpdate = document.getElementById("btnUpdateTest");
  const btnDelete = document.getElementById("btnDeleteTest");
  const btnToggle = document.getElementById("btnToggleTest");
  const btnSaveOrder = document.getElementById("btnSaveOrder");
  const listWrap = document.getElementById("testsList");
  const templatesContainer = document.getElementById("testTemplatesContainer");

  let selected = null;
  let cachedTests = [];
  let systems = [];
  let selectedTemplates = {};
  let currentSystemModules = [];

  // CARREGAR SISTEMAS E MÓDULOS
  async function loadSystems(){
    const data = await apiGet("/api/systems");
    systems = data.systems || [];
    sysEl.innerHTML = systems.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
    updateModules();
  }
  
  function updateModules(){
    const id = Number(sysEl.value||1);
    const sys = systems.find(s=>s.id===id);
    
    currentSystemModules = (sys && sys.modules) || [];
    modEl.innerHTML = `
        <option value="">Selecione um Módulo</option>
        <option value="CORE">CORE (Geral/Login)</option>
        ${currentSystemModules.map(m=>`<option value="${m}">${m}</option>`).join("")}
    `;
    
    modEl.value = "";
    loadTestTemplates(); 
  }
  sysEl.addEventListener("change", updateModules);
  modEl.addEventListener("change", loadTestTemplates);

  // CARREGAR TEMPLATES DE TESTE (CARDS)
  async function loadTestTemplates(){
    const module = modEl.value;
    templatesContainer.innerHTML = "";
    selectedTemplates = {};
    nameEl.value=""; descEl.value=""; 
    
    btnCreate.disabled = !module; 
    
    if(!module){
        templatesContainer.innerHTML = `<p class="hint" style="grid-column:1/-1;text-align:center;">Selecione um módulo acima para ver os testes.</p>`;
        return;
    }
    
    const data = await apiGet(`/api/test-templates?module=${module}`);
    const templates = data.templates || [];
    
    if(!templates.length){
        templatesContainer.innerHTML = `<p class="hint" style="grid-column:1/-1;text-align:center;">Nenhum template disponível para ${module}.</p>`;
        return;
    }
    
    templatesContainer.innerHTML = templates.map(t => `
        <div class="card test-template" data-code="${t.code}" data-name="${t.name}" data-desc="${t.desc}" data-module="${module}">
            <strong>${t.name}</strong>
            <p class="muted" style="font-size:.8rem; margin-top:5px;">[${t.code}] ${t.desc}</p>
            <span class="badge" style="position:absolute;top:10px;right:10px;font-size:.65rem">${t.category}</span>
        </div>
    `).join("");
    
    enableTemplateSelection();
}

  // HABILITAR SELEÇÃO DE TEMPLATES
  function enableTemplateSelection(){
    templatesContainer.querySelectorAll(".test-template").forEach(card => {
        card.style.cursor = 'pointer';
        card.onclick = () => {
            const code = card.getAttribute("data-code");
            if(selectedTemplates[code]){
                // Remove do teste (toggle: desliga)
                delete selectedTemplates[code];
                card.classList.remove("selected-template");
            } else {
                // Adiciona ao teste (toggle: liga)
                selectedTemplates[code] = {
                    name: card.getAttribute("data-name"),
                    description: card.getAttribute("data-desc"),
                    module: card.getAttribute("data-module")
                };
                card.classList.add("selected-template");
            }
            updateTestNameAndDesc(); // Reconstrói o Nome/Descrição com a nova lista
        };
    });
}

  // ATUALIZAR NOME E DESCRIÇÃO DO CONJUNTO DE TESTES
  function updateTestNameAndDesc(){
      const codes = Object.keys(selectedTemplates);
      
      const names = codes.map(c => selectedTemplates[c].name).join(' | ');
      const descs = codes.map(c => `[${c}] ${selectedTemplates[c].description}`).join('\n');
      
      document.getElementById("t_name").value = codes.length > 0 ? `[${modEl.value}] Conjunto de Testes: ${names.substring(0, 50)}...` : '';
      document.getElementById("t_desc").value = descs;
      
      btnCreate.disabled = codes.length === 0;
  }

  // CARREGAR TESTES EXISTENTES
  async function loadTests(){
    const data = await apiGet("/api/admin/tests");
    cachedTests = data.tests || [];
    systems = data.systems || systems;
    if(sysEl.options.length===0) loadSystems();

    const rows = cachedTests.map(t=>`
      <tr class="draggable selectable" draggable="true" data-id="${t.id}">
        <td style="width:56px">${t.priority}</td>
        <td>${t.name}</td>
        <td>${(systems.find(s=>s.id===t.system_id)||{}).name || '-'}</td>
        <td>${t.module || '-'}</td>
        <td>${t.description||'-'}</td>
        <td><span class="badge ${t.active?'on':'off'}">${t.active?'Ativo':'Inativo'}</span></td>
      </tr>
    `);
    listWrap.innerHTML = table(["Ord.","Nome","Sistema","Módulo","Descrição","Status"], rows.length?rows:[`<tr><td colspan="6">Nenhum teste.</td></tr>`]);

    enableSelection();
    enableDragDrop();
    btnSaveOrder.disabled = !rows.length;
  }

  // HABILITAR SELEÇÃO DE TESTES NA TABELA (PARA EDIÇÃO)
  function enableSelection(){
    listWrap.querySelectorAll("tr.selectable").forEach(tr=>{
      tr.onclick = ()=>{
        listWrap.querySelectorAll("tr.selectable").forEach(n=>n.classList.remove("selected"));
        tr.classList.add("selected");
        const id = Number(tr.getAttribute("data-id"));
        selected = cachedTests.find(t=>t.id===id);

        nameEl.value = selected.name||"";
        sysEl.value = selected.system_id;
        updateModules();
        modEl.value = selected.module||"";
        descEl.value = selected.description||"";

        btnUpdate.disabled = false;
        btnDelete.disabled = false;
        btnToggle.disabled = false;
        
        selectedTemplates = {};
        templatesContainer.innerHTML = "";
        btnCreate.disabled = true;
      };
    });
  }

  // HABILITAR DRAG & DROP
  function enableDragDrop(){
    const rows = listWrap.querySelectorAll("tbody tr.draggable");
    let dragging = null;
    rows.forEach(r=>{
      r.addEventListener("dragstart", e=>{ dragging = r; r.classList.add("dragging"); });
      r.addEventListener("dragend", e=>{ dragging = null; r.classList.remove("dragging"); updateOrderPreview(); });
      r.addEventListener("dragover", e=>{
        e.preventDefault();
        const target = r;
        target.classList.add("drag-over");
      });
      r.addEventListener("dragleave", ()=> r.classList.remove("drag-over"));
      r.addEventListener("drop", e=>{
        e.preventDefault();
        const body = r.parentElement;
        r.classList.remove("drag-over");
        if(!dragging || dragging===r) return;
        const all = Array.from(body.children);
        const draggingIdx = all.indexOf(dragging);
        const targetIdx = all.indexOf(r);
        if(draggingIdx < targetIdx) body.insertBefore(dragging, r.nextSibling);
        else body.insertBefore(dragging, r);
      });
    });
  }

  // ATUALIZAR PREVIEW DE ORDENAÇÃO
  function updateOrderPreview(){
    const ords = listWrap.querySelectorAll("tbody tr");
    ords.forEach((tr, idx)=>{ tr.children[0].textContent = (idx+1); });
    btnSaveOrder.disabled = false;
  }

  // EVENTO DE CRIAÇÃO
  btnCreate.onclick = async ()=>{
    const payload = {
      name: nameEl.value.trim(),
      description: descEl.value.trim(),
      system_id: Number(sysEl.value||1),
      module: (modEl.value||"").trim()
    };
    
    if (Object.keys(selectedTemplates).length === 0) {
        alert("Selecione pelo menos um teste base (template) ou limpe os campos para criação manual.");
        return;
    }
    
    if (!payload.name) {
        alert("O Nome do Conjunto de Testes é obrigatório.");
        return;
    }

    const resp = await apiPost("/api/admin/tests", payload);
    if(!resp.ok){ alert(resp.message||"Erro ao criar."); return; }
    
    nameEl.value=""; descEl.value=""; selectedTemplates={}; 
    templatesContainer.innerHTML = "";
    await loadTests();
  };

  // EVENTO DE ATUALIZAÇÃO
  btnUpdate.onclick = async ()=>{
    if(!selected){ alert("Selecione um teste."); return; }
    const payload = {
      id: selected.id,
      name: nameEl.value.trim(),
      description: descEl.value.trim(),
      system_id: Number(sysEl.value||1),
      module: (modEl.value||"").trim()
    };
    const resp = await apiPost("/api/admin/tests/update", payload);
    if(!resp.ok){ alert(resp.message||"Erro ao atualizar."); return; }
    await loadTests();
  };

  // EVENTO DE EXCLUSÃO
  btnDelete.onclick = async ()=>{
    if(!selected){ alert("Selecione um teste."); return; }
    if(!confirm(`Excluir o teste "${selected.name}"?`)) return;
    const resp = await apiPost("/api/admin/tests/delete", {id: selected.id});
    if(!resp.ok){ alert(resp.message||"Erro ao excluir."); return; }
    selected=null; btnUpdate.disabled=btnDelete.disabled=btnToggle.disabled=true;
    await loadTests();
  };

  // EVENTO DE TOGGLE ATIVO/INATIVO
  btnToggle.onclick = async ()=>{
    if(!selected){ alert("Selecione um teste."); return; }
    const resp = await apiPost("/api/admin/tests/update", {id: selected.id, active: !selected.active});
    if(!resp.ok){ alert(resp.message||"Erro ao alternar."); return; }
    await loadTests();
  };

  // EVENTO DE SALVAR ORDEM
  btnSaveOrder.onclick = async ()=>{
    const ids = Array.from(listWrap.querySelectorAll("tbody tr")).map(tr=>Number(tr.getAttribute("data-id")));
    const resp = await apiPost("/api/admin/tests/reorder", {order: ids});
    if(!resp.ok){ alert(resp.message||"Erro ao salvar ordem."); return; }
    btnSaveOrder.disabled = true;
    await loadTests();
  };

  await loadSystems();
  await loadTests();
}

async function initAdminUsers(){
  const s = getSession(); if(!s.username){ location.href="/"; return; }
  document.getElementById("btnLogout").onclick = ()=>{ clearSession(); location.href="/"; };

  const usersWrap = document.getElementById("usersList");
  const logsWrap  = document.getElementById("userLogs");
  const newEl = document.getElementById("u_new");
  const editEl = document.getElementById("u_edit");
  const btnAdd = document.getElementById("btnAddUser");
  const btnUpdate = document.getElementById("btnUpdateUser");
  const btnToggle = document.getElementById("btnToggleUser");
  const btnDelete = document.getElementById("btnDeleteUser");

  let selected = null;
  let cached = [];

  async function loadUsers(){
    const data = await apiGet("/api/admin/users");
    cached = data.users || [];
    const rows = cached.map(u=>`
      <tr class="selectable" data-id="${u.username}">
        <td>${u.username}</td>
        <td><span class="badge ${u.active?'on':'off'}">${u.active?'Ativo':'Inativo'}</span></td>
        <td><code>adm123</code></td>
      </tr>
    `);
    usersWrap.innerHTML = table(["Username","Status","Senha (demo)"], rows.length?rows:[`<tr><td colspan="3">Sem testadores.</td></tr>`]);
    enableSelection();
  }

  function enableSelection(){
    listWrap.querySelectorAll("tr.selectable").forEach(tr=>{
      tr.onclick = ()=>{
        listWrap.querySelectorAll("tr.selectable").forEach(n=>n.classList.remove("selected"));
        tr.classList.add("selected");
        const id = Number(tr.getAttribute("data-id"));
        selected = cachedTests.find(t=>t.id===id);

        nameEl.value = selected.name||"";
        sysEl.value = selected.system_id;
        updateModules();
        modEl.value = selected.module||"";
        descEl.value = selected.description||"";

        btnUpdate.disabled = false;
        btnDelete.disabled = false;
        btnToggle.disabled = false;
        
        // NOVO: Limpa a seleção de templates e a interface
        selectedTemplates = {};
        templatesContainer.innerHTML = `<p class="hint" style="grid-column:1/-1;text-align:center;">Editando teste existente. Desmarque para criar um novo.</p>`;
        btnCreate.disabled = true; // Desabilita o botão "Salvar (novo)" durante a edição
      };
    });
  }

  async function loadLogs(username){
    const data = await apiGet(`/api/admin/users/logs?username=${encodeURIComponent(username)}`);
    const rows = (data.logs||[]).map(l=>`<tr><td>${l.username}</td><td>${l.event}</td><td>${tsToStr(l.ts)}</td></tr>`);
    logsWrap.innerHTML = table(["Usuário","Evento","Quando"], rows.length?rows:[`<tr><td colspan="3">Sem logs.</td></tr>`]);
  }

  btnAdd.onclick = async ()=>{
    const username = newEl.value.trim();
    if(!username){ alert("Informe um username."); return; }
    const resp = await apiPost("/api/admin/users", {username});
    if(!resp.ok){ alert(resp.message||"Erro ao adicionar."); return; }
    newEl.value=""; await loadUsers();
  };

  btnUpdate.onclick = async ()=>{
    if(!selected){ alert("Selecione um usuário."); return; }
    const new_username = editEl.value.trim();
    if(!new_username){ alert("Novo username inválido."); return; }
    const resp = await apiPost("/api/admin/users/update", {username: selected.username, new_username});
    if(!resp.ok){ alert(resp.message||"Erro ao atualizar."); return; }
    await loadUsers();
  };

  btnToggle.onclick = async ()=>{
    if(!selected){ alert("Selecione um usuário."); return; }
    const resp = await apiPost("/api/admin/users/update", {username: selected.username, active: !selected.active});
    if(!resp.ok){ alert(resp.message||"Erro ao alternar."); return; }
    await loadUsers();
  };

  btnDelete.onclick = async ()=>{
    if(!selected){ alert("Selecione um usuário."); return; }
    if(!confirm(`Excluir "${selected.username}"?`)) return;
    const resp = await apiPost("/api/admin/users/delete", {username: selected.username});
    if(!resp.ok){ alert(resp.message||"Erro ao excluir."); return; }
    selected=null; btnUpdate.disabled=btnToggle.disabled=btnDelete.disabled=true;
    await loadUsers();
    logsWrap.innerHTML="";
  };

  await loadUsers();
}

async function initAdminMetrics(){
  const s = getSession(); if(!s.username){ location.href="/"; return; }
  document.getElementById("btnLogout").onclick = ()=>{ clearSession(); location.href="/"; };

  const byTestWrap = document.getElementById("metricsByTest");
  const byUserWrap = document.getElementById("metricsByUser");
  const overallEl  = document.getElementById("overallSuccess");
  const chartOverall = document.getElementById("chartOverall");
  const chartTests = document.getElementById("chartTests");
  const chartUsers = document.getElementById("chartUsers");
  document.getElementById("btnRefreshMetrics").onclick = ()=> load();

  function bar(percent){
    const pct = Math.max(0, Math.min(100, percent||0));
    const h = Math.round((pct/100)*80);
    return `<div class="bar" style="height:${h}px" title="${pct.toFixed(1)}%"></div>`;
  }
  function meter(label, percent){
    const pct = Math.max(0, Math.min(100, percent||0));
    return `<div class="chart-item"><div class="label">${label}</div><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
    }

  async function load(){
    const data = await apiGet("/api/admin/metrics");
    overallEl.textContent = (data.overall_success||0).toFixed(1)+"%";
    chartOverall.innerHTML = bar(data.overall_success||0);

    const rowsT = (data.per_test||[]).map(m=>`<tr><td>${m.test_id}</td><td>${m.test_name}</td><td>${m.module||'-'}</td><td>${m.total_runs}</td><td>${m.total_cycles}</td><td style="color:${m.success_rate>=50?'#43B02A':'#E4002B'}">${m.success_rate.toFixed(1)}%</td></tr>`);
    byTestWrap.innerHTML = table(["ID","Teste","Módulo","Execuções","Ciclos","Sucesso"], rowsT.length?rowsT:[`<tr><td colspan="6">Sem dados.</td></tr>`]);
    chartTests.innerHTML = (data.per_test||[]).map(m=>meter(m.test_name, m.success_rate)).join("");

    const rowsU = (data.per_user||[]).map(u=>`<tr><td>${u.username}</td><td>${u.runs}</td><td>${u.total_cycles}</td><td style="color:${u.success_rate>=50?'#43B02A':'#E4002B'}">${u.success_rate.toFixed(1)}%</td></tr>`);
    byUserWrap.innerHTML = table(["Usuário","Execuções","Ciclos","Sucesso"], rowsU.length?rowsU:[`<tr><td colspan="4">Sem dados.</td></tr>`]);
    chartUsers.innerHTML = (data.per_user||[]).map(u=>meter(u.username, u.success_rate)).join("");
  }

  await load();
}

async function initTester(){
  const s = getSession(); if(!s.username){ location.href="/"; return; }
  document.getElementById("whoami").textContent = `Olá, ${s.username} (tester)`;
  document.getElementById("btnLogout").onclick = ()=>{ clearSession(); location.href="/"; };

  const activeWrap = document.getElementById("activeTests");
  const btnExecute = document.getElementById("btnExecute");
  let selectedId = null;

  async function loadActive(){
    const data = await apiGet("/api/tester/tests");
    const rows = (data.tests||[]).map(t=>`<tr class="selectable" data-id="${t.id}"><td>${t.priority}</td><td>${t.name}</td><td>${t.module||'-'}</td><td>${t.description||'-'}</td></tr>`);
    activeWrap.innerHTML = table(["Ord.","Nome","Módulo","Descrição"], rows.length?rows:[`<tr><td colspan="4">Nenhum teste ativo.</td></tr>`]);
    activeWrap.querySelectorAll("tr.selectable").forEach(tr=>{
      tr.onclick=()=>{ activeWrap.querySelectorAll("tr.selectable").forEach(n=>n.classList.remove("selected")); tr.classList.add("selected"); selectedId = Number(tr.getAttribute("data-id")); btnExecute.disabled=false; };
    });
  }

  async function loadMyResults(){
    const data = await apiGet("/api/tester/results");
    document.getElementById("myRate").textContent = (data.my_success_rate||0).toFixed(1)+"%";
    const rows = (data.results||[]).slice().reverse().map(r=>`<tr><td>${r.test_id}</td><td>${r.test_name}</td><td>${r.cycles}</td><td style="color:#43B02A">${r.successes}</td><td style="color:#E4002B">${r.failures}</td><td>${tsToStr(r.ts)}</td></tr>`);
    document.getElementById("myResults").innerHTML = table(["ID","Teste","Ciclos","Sucessos","Falhas","Quando"], rows.length?rows:[`<tr><td colspan="6">Sem execuções.</td></tr>`]);
  }

  btnExecute.onclick = async ()=>{
    if(!selectedId){ alert("Selecione um teste."); return; }
    const cycles = Math.max(1, Math.min(5, Number(document.getElementById("cycles").value||1)));
    const resp = await apiPost("/api/tester/execute", {test_id:selectedId, cycles});
    if(!resp.ok){ alert(resp.message||"Falha ao executar."); return; }
    await loadMyResults();
  };

  await loadActive();
  await loadMyResults();
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const id = document.body.id;
  if(id==="page-login") await initLogin();
  if(id==="page-admin-tests") await initAdminTests();
  if(id==="page-admin-users") await initAdminUsers();
  if(id==="page-admin-metrics") await initAdminMetrics();
  if(id==="page-tester") await initTester();
});