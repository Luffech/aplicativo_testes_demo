from flask import Flask, request, jsonify, render_template, send_from_directory
from datetime import datetime
from copy import deepcopy

app = Flask(__name__)

# =========================
# Helpers 
# =========================

def _now_iso():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def _norm_username(u: str) -> str:
    return (u or "").strip().lower()

def _find_user(users_list, username):
    nu = _norm_username(username)
    return next((u for u in users_list if _norm_username(u.get("username")) == nu), None)

def _next_test_id():
    global _TEST_SEQ
    _TEST_SEQ += 1
    return _TEST_SEQ

def _require_headers():
    user = (request.headers.get("X-User") or "").strip()
    role = (request.headers.get("X-Role") or "").strip()
    if not user or not role:
        return None, None, ("Acesso negado (sessão ausente).", 403)
    return user, role, None

def _require_admin():
    u, r, err = _require_headers()
    if err: return err
    if r != "admin": return ("Acesso restrito a administradores.", 403)
    return None

def _require_tester():
    u, r, err = _require_headers()
    if err: return err
    if r not in ("tester", "admin"): return ("Acesso restrito a testadores.", 403)
    return None

# =========================
# Mock data 
# =========================

users = [
    {"username":"adm123","name":"Administrador","email":"admin@example.com","credential":"admin","department":"QA","birth_date":"","active":True,"role":"admin"},
    {"username":"igor","name":"Igor Tester","email":"igor@example.com","credential":"tester","department":"QA","birth_date":"","active":True,"role":"tester"},
    {"username":"isaque","name":"Isaque Tester","email":"isaque@example.com","credential":"tester","department":"QA","birth_date":"","active":True,"role":"tester"},
    {"username":"luiz","name":"Luiz Tester","email":"luiz@example.com","credential":"tester","department":"QA","birth_date":"","active":True,"role":"tester"},
    {"username":"kevin","name":"Kevin Tester","email":"kevin@example.com","credential":"tester","department":"QA","birth_date":"","active":True,"role":"tester"},
    {"username":"diego","name":"Diego Tester","email":"diego@example.com","credential":"tester","department":"QA","birth_date":"","active":True,"role":"tester"},
]

# senha mock: "adm123" para todos
MOCK_PASSWORD = "adm123"

systems = [
    {
        "id": 1,
        "name": "SAP ECC",
        "modules": ["MM", "SD", "FI", "CO", "PP"]
    }
]

test_templates = {
    "MM": [
        {"code":"MM-001","name":"Entrada de NF","category":"Sanity","desc":"Validação de entrada de nota fiscal"},
        {"code":"MM-010","name":"Pedido de compra","category":"Core","desc":"Criação e liberação de pedido"}
    ],
    "SD": [
        {"code":"SD-002","name":"Ordem de venda","category":"Core","desc":"Criação e faturamento"},
        {"code":"SD-011","name":"Entrega","category":"Sanity","desc":"Picking, packing e PGI"}
    ],
    "FI": [
        {"code":"FI-005","name":"Baixa de título","category":"Core","desc":"Liquidação de títulos a receber"}
    ],
    "CO": [
        {"code":"CO-003","name":"Centro de custo","category":"Sanity","desc":"Cadastro e rateio"}
    ],
    "PP": [
        {"code":"PP-007","name":"Ordem produção","category":"Core","desc":"CRP e confirmação"}
    ]
}

tests = [
    # exemplo inicial
    {"id":1, "name":"Sanity MM", "description":"Smoke básico MM", "system_id":1, "module":"MM",
     "tokens":"MM-001,MM-010","project":"Global","cycles_qty":1,"active":True},
    {"id":2, "name":"Fluxo SD", "description":"Venda->Entrega->Faturamento", "system_id":1, "module":"SD",
     "tokens":"SD-002,SD-011","project":"Global","cycles_qty":1,"active":True}
]
_TEST_SEQ = max([t["id"] for t in tests] or [0])

# Execuções (resultados)
results = []  # cada item: {username, test_id, test_name, cycles, successes, failures, ts}

# Logs simples por usuário
user_logs = []  # {username, event, ts}


# =========================
# Páginas (templates)
# =========================

@app.route("/")
def page_login():
    return render_template("login.html")

@app.route("/admin")
def admin_hub():
    return render_template("admin-dashboard.html")

@app.route("/admin/tests")
def admin_tests_page():
    return render_template("admin-tests.html")

@app.route("/admin/users")
def admin_users_page():
    return render_template("admin-users.html")

@app.route("/admin/metrics")
def admin_metrics_page():
    return render_template("admin-metrics.html")

@app.route("/tester-dashboard.html")
def tester_dashboard_page():
    return render_template("tester-dashboard.html")


# =========================
# API: Autenticação
# =========================

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    lu = _norm_username(data.get("username",""))
    pw = data.get("password","")
    user = next((u for u in users if _norm_username(u.get("username")) == lu), None)
    if not user or pw != MOCK_PASSWORD or not user.get("active", True):
        return jsonify(ok=False, message="Credenciais inválidas."), 401
    # mock de log
    user_logs.append({"username": user["username"], "event": "login", "ts": _now_iso()})
    return jsonify(ok=True, username=user["username"], role=user["role"])


# =========================
# API: Sistemas / Templates
# =========================

@app.route("/api/systems")
def api_systems():
    err = _require_headers()[2]
    if err: return jsonify(ok=False, message=err[0]), err[1]
    return jsonify(ok=True, systems=systems)

@app.route("/api/test-templates")
def api_templates():
    err = _require_headers()[2]
    if err: return jsonify(ok=False, message=err[0]), err[1]
    module = (request.args.get("module") or "").strip()
    return jsonify(ok=True, templates=test_templates.get(module, []))


# =========================
# API: Admin - Tests
# =========================

@app.route("/api/admin/tests", methods=["GET"])
def api_admin_tests_get():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    # devolve na ordem atual (lista já reflete ordem)
    return jsonify(ok=True, tests=tests)

@app.route("/api/admin/tests", methods=["POST"])
def api_admin_tests_create():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    system_id = data.get("system_id")
    module = (data.get("module") or "").strip()
    if not name or not system_id or not module:
        return jsonify(ok=False, message="Nome, Sistema e Módulo são obrigatórios."), 400
    new_obj = {
        "id": _next_test_id(),
        "name": name,
        "description": (data.get("description") or "").strip(),
        "system_id": int(system_id),
        "module": module,
        "tokens": (data.get("tokens") or "").strip(),
        "project": (data.get("project") or "Global").strip(),
        "cycles_qty": int(data.get("cycles_qty") or 1),
        "active": True
    }
    tests.append(new_obj)
    return jsonify(ok=True, test=new_obj), 201

@app.route("/api/admin/tests/update", methods=["POST"])
def api_admin_tests_update():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    tid = data.get("id")
    t = next((x for x in tests if x["id"] == tid), None)
    if not t:
        return jsonify(ok=False, message="Teste não encontrado."), 404
    for k in ["name","description","module","tokens","project","cycles_qty","active","system_id"]:
        if k in data and data[k] is not None:
            if k in ["system_id","cycles_qty"]:
                t[k] = int(data[k])
            else:
                t[k] = data[k] if isinstance(data[k], bool) else str(data[k]).strip()
    return jsonify(ok=True, test=t)

@app.route("/api/admin/tests/delete", methods=["POST"])
def api_admin_tests_delete():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    tid = data.get("id")
    idx = next((i for i,x in enumerate(tests) if x["id"] == tid), None)
    if idx is None:
        return jsonify(ok=False, message="Teste não encontrado."), 404
    tests.pop(idx)
    # opcional: remover resultados do teste
    global results
    results = [r for r in results if r.get("test_id") != tid]
    return jsonify(ok=True)

@app.route("/api/admin/tests/reorder", methods=["POST"])
def api_admin_tests_reorder():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    ordered_ids = data.get("ordered_ids") or []
    if len(ordered_ids) != len(tests):
        return jsonify(ok=False, message="Lista de IDs incompleta."), 400
    id_to_test = {t["id"]: t for t in tests}
    try:
        new_list = [id_to_test[i] for i in ordered_ids]
    except KeyError:
        return jsonify(ok=False, message="IDs inválidos."), 400
    tests.clear()
    tests.extend(new_list)
    return jsonify(ok=True)


# =========================
# API: Admin - Users (username único seguro)
# =========================

@app.route("/api/admin/users", methods=["GET"])
def api_admin_users_get():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    return jsonify(ok=True, users=users)

@app.route("/api/admin/users", methods=["POST"])
def api_admin_users_create():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    if not username:
        return jsonify(ok=False, message="Username é obrigatório."), 400
    if _find_user(users, username) is not None:
        return jsonify(ok=False, message="Username já existente."), 409
    new_user = {
        "username": username,
        "name": (data.get("name") or "").strip(),
        "email": (data.get("email") or "").strip(),
        "credential": (data.get("credential") or "").strip(),
        "department": (data.get("department") or "").strip(),
        "birth_date": (data.get("birth_date") or "").strip(),
        "active": True,
        "role": "tester"
    }
    users.append(new_user)
    return jsonify(ok=True, user=new_user), 201

@app.route("/api/admin/users/update", methods=["POST"])
def api_admin_users_update():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    user = _find_user(users, username)
    if user is None:
        return jsonify(ok=False, message="Usuário não encontrado."), 404

    new_username = data.get("new_username")
    if new_username:
        if _find_user(users, new_username) and _norm_username(new_username) != _norm_username(username):
            return jsonify(ok=False, message="Username já existente."), 409
        user["username"] = new_username.strip()

    for field in ["name","email","credential","department","birth_date","active"]:
        if field in data:
            user[field] = data[field]
    return jsonify(ok=True, user=user)

@app.route("/api/admin/users/delete", methods=["POST"])
def api_admin_users_delete():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    idx = next((i for i,u in enumerate(users) if _norm_username(u["username"]) == _norm_username(username)), None)
    if idx is None:
        return jsonify(ok=False, message="Usuário não encontrado."), 404
    users.pop(idx)
    return jsonify(ok=True)

@app.route("/api/admin/users/logs")
def api_admin_users_logs():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    username = (request.args.get("username") or "").strip()
    logs = [l for l in user_logs if _norm_username(l["username"]) == _norm_username(username)]
    return jsonify(ok=True, logs=logs, login_count=len([x for x in logs if x["event"]=="login"]))


# =========================
# API: Admin - Métricas
# =========================

@app.route("/api/admin/metrics")
def api_admin_metrics():
    err = _require_admin()
    if err: return jsonify(ok=False, message=err[0]), err[1]

    # por teste
    per_test = []
    for t in tests:
        rs = [r for r in results if r["test_id"] == t["id"]]
        total_runs = len(rs)
        total_cycles = sum(r["cycles"] for r in rs) if rs else 0
        succ = sum(r["successes"] for r in rs) if rs else 0
        fail = sum(r["failures"] for r in rs) if rs else 0
        rate = round((succ / (succ + fail) * 100), 1) if (succ + fail) else 0
        per_test.append({
            "test_name": t["name"], "module": t["module"], "project": t["project"],
            "total_runs": total_runs, "total_cycles": total_cycles, "success_rate": rate
        })

    # por usuário
    per_user = []
    by_user = {}
    for r in results:
        u = r["username"]
        by_user.setdefault(u, {"runs":0,"total_cycles":0,"succ":0,"fail":0})
        by_user[u]["runs"] += 1
        by_user[u]["total_cycles"] += r["cycles"]
        by_user[u]["succ"] += r["successes"]
        by_user[u]["fail"] += r["failures"]
    for u, ag in by_user.items():
        rate = round((ag["succ"] / (ag["succ"] + ag["fail"]) * 100), 1) if (ag["succ"] + ag["fail"]) else 0
        per_user.append({"username": u, "runs": ag["runs"], "total_cycles": ag["total_cycles"], "success_rate": rate})

    # geral
    total_succ = sum(r["successes"] for r in results) or 0
    total_fail = sum(r["failures"] for r in results) or 0
    overall = round((total_succ / (total_succ + total_fail) * 100), 1) if (total_succ + total_fail) else 0

    return jsonify(ok=True, per_test=per_test, per_user=per_user, overall_success_rate=overall)


# =========================
# API: Tester
# =========================

@app.route("/api/tester/tests")
def api_tester_tests():
    err = _require_tester()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    active_tests = [t for t in tests if t.get("active")]
    return jsonify(ok=True, tests=active_tests)

@app.route("/api/tester/execute", methods=["POST"])
def api_tester_execute():
    user, role, err = _require_headers()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    if role not in ("tester","admin"):
        return jsonify(ok=False, message="Acesso restrito a testadores."), 403

    data = request.get_json(silent=True) or {}
    tid = data.get("id")
    cycles = int(data.get("cycles") or 1)
    t = next((x for x in tests if x["id"] == tid and x.get("active")), None)
    if not t:
        return jsonify(ok=False, message="Teste não encontrado/ativo."), 404

    # Simulação simples: 70% de sucesso por ciclo
    successes = 0
    failures = 0
    import random
    for _ in range(cycles):
        successes += 1 if random.random() < 0.7 else 0
    failures = cycles - successes

    results.append({
        "username": user, "test_id": t["id"], "test_name": t["name"],
        "cycles": cycles, "successes": successes, "failures": failures, "ts": _now_iso()
    })
    return jsonify(ok=True)

@app.route("/api/tester/results")
def api_tester_results():
    user, role, err = _require_headers()
    if err: return jsonify(ok=False, message=err[0]), err[1]
    my = [r for r in results if _norm_username(r["username"]) == _norm_username(user)]
    succ = sum(r["successes"] for r in my)
    fail = sum(r["failures"] for r in my)
    rate = round((succ / (succ + fail) * 100), 1) if (succ + fail) else 0
    return jsonify(ok=True, results=my, my_success_rate=rate)


# =========================
# Static pass-through (se servir por Flask)
# =========================

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


# =========================
# Dev runner
# =========================

if __name__ == "__main__":
    # debug=True apenas em dev
    app.run(host="127.0.0.1", port=5000, debug=True)
