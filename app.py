from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import time
import random

systems = [
    {'id': 1, 'name': 'SAP', 'modules': ['FI', 'MM', 'SD', 'PP', 'QM']}
]

users = [
    {'username': 'adm123', 'password': 'adm123', 'role': 'admin', 'active': True},
    {'username': 'usertest', 'password': 'adm123', 'role': 'tester', 'active': True}
]

test_templates = {
    'FI': [
        {'code': 'FI001', 'name': 'Lançamento de Nota Fiscal de Entrada', 'desc': 'Verifica a criação correta de documento contábil para NF-e.', 'category': 'Transação'},
        {'code': 'FI002', 'name': 'Compensação de Contas a Pagar (F-53)', 'desc': 'Valida a conciliação entre pagamento e obrigação pendente.', 'category': 'Processo'},
        {'code': 'FI003', 'name': 'Relatório de Balanço (F.01)', 'desc': 'Geração e validação do balanço patrimonial e DRE.', 'category': 'Relatório'},
        {'code': 'FI004', 'name': 'Fechamento Mensal/Anual (ECC)', 'desc': 'Execução do ciclo de fechamento contábil e fiscal.', 'category': 'Processo'},
    ],
    'MM': [
        {'code': 'MM001', 'name': 'Criação de Pedido de Compra (ME21N)', 'desc': 'Teste completo do fluxo de criação e aprovação do PC.', 'category': 'Transação'},
        {'code': 'MM002', 'name': 'Entrada de Mercadoria (MIGO)', 'desc': 'Verifica o recebimento físico e o impacto contábil.', 'category': 'Transação'},
        {'code': 'MM003', 'name': 'Configuração de Preços (Condições)', 'desc': 'Validação de preços, descontos e impostos em compras.', 'category': 'Configuração'},
        {'code': 'MM004', 'name': 'Inventário Físico', 'desc': 'Processo completo de contagem e ajuste de estoque.', 'category': 'Processo'},
    ],
    'SD': [
        {'code': 'SD001', 'name': 'Criação de Pedido de Venda', 'desc': 'Teste do ciclo completo da ordem de venda.', 'category': 'Transação'},
        {'code': 'SD002', 'name': 'Cálculo de Imposto (Tax)', 'desc': 'Verifica a correta aplicação das regras de impostos na fatura.', 'category': 'Configuração'},
        {'code': 'SD003', 'name': 'Entrega e Saída de Mercadoria', 'desc': 'Fluxo de logística de vendas e impacto no estoque.', 'category': 'Transação'},
        {'code': 'SD004', 'name': 'Processamento de Devoluções (Retorno)', 'desc': 'Simulação de um ciclo de devolução de produtos por cliente.', 'category': 'Processo'},
    ],
    'PP': [ 
        {'code': 'PP001', 'name': 'Criação de Ordem de Produção', 'desc': 'Verifica a criação e liberação de uma ordem de produção.', 'category': 'Transação'},
        {'code': 'PP002', 'name': 'Apontamento de Tempos (Confirm.)', 'desc': 'Confirmação das etapas da ordem e consumo de insumos.', 'category': 'Processo'},
        {'code': 'PP003', 'name': 'Cálculo de Necessidades (MRP)', 'desc': 'Execução do MRP e verificação da criação de requisições.', 'category': 'Processo'},
        {'code': 'PP004', 'name': 'Custos de Produção (Custeio)', 'desc': 'Validação do custo do produto e encerramento da ordem.', 'category': 'Configuração'},
    ],
    'QM': [ 
        {'code': 'QM001', 'name': 'Registro de Lote de Inspeção', 'desc': 'Criação automática ou manual de um lote para inspeção.', 'category': 'Processo'},
        {'code': 'QM002', 'name': 'Registro de Resultados', 'desc': 'Inserção de resultados de medição e aprovação do lote.', 'category': 'Transação'},
        {'code': 'QM003', 'name': 'Liberação de Uso/Rejeição', 'desc': 'Decisão de uso (aceite) ou rejeição do material.', 'category': 'Processo'},
        {'code': 'QM004', 'name': 'Certificado de Qualidade', 'desc': 'Geração do Certificado de Análise (CoA) para clientes.', 'category': 'Relatório'},
    ],
    'CORE': [ 
        {'code': 'CORE01', 'name': 'Login/Logout com Bloqueio', 'desc': 'Verifica bloqueio de usuário após N tentativas.', 'category': 'Segurança'},
        {'code': 'CORE02', 'name': 'Performance de Carga (Home)', 'desc': 'Mede o tempo de carregamento do Dashboard inicial.', 'category': 'Performance'},
        {'code': 'CORE03', 'name': 'Controle de Acessos (Roles)', 'desc': 'Valida permissões de usuário (transações e objetos).', 'category': 'Segurança'},
        {'code': 'CORE04', 'name': 'Backup de Dados Críticos', 'desc': 'Simulação de recuperação de dados e integridade.', 'category': 'Infraestrutura'},
    ]
}

tests = []
test_results = []
user_logs = []

MAX_USERS = 10
MAX_TESTS = 15

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

def now_ts(): return int(time.time())

def find_user(username):
    return next((u for u in users if u['username'] == username), None)

def next_test_id():
    return (max([t['id'] for t in tests]) + 1) if tests else 1

def get_system(sys_id):
    return next((s for s in systems if s['id'] == sys_id), None)

def header_identity():
    return request.headers.get('X-User'), request.headers.get('X-Role')

def require_admin():
    u, r = header_identity()
    return (u, r) if r == 'admin' else (None, None)

@app.route('/')
def page_login(): return render_template('login.html')

@app.route('/admin')
def page_admin_home(): return render_template('admin-dashboard.html')

@app.route('/admin/tests')
def page_admin_tests(): return render_template('admin-tests.html')

@app.route('/admin/users')
def page_admin_users(): return render_template('admin-users.html')

@app.route('/admin/metrics')
def page_admin_metrics(): return render_template('admin-metrics.html')

@app.route('/tester-dashboard.html') 
def page_tester_dashboard(): return render_template('tester-dashboard.html')

@app.post('/api/login')
def api_login():
    data = request.get_json(force=True)
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    u = find_user(username)
    if not u or u['password'] != password or not u.get('active', True):
        return jsonify({'ok': False, 'message': 'Usuário/senha inválidos ou usuário inativo.'}), 401

    user_logs.append({'username': username, 'event': 'login', 'ts': now_ts()})
    return jsonify({'ok': True, 'username': u['username'], 'role': u['role']}), 200

@app.get('/api/check-session')
def api_check_session():
    username = request.args.get('username', '').strip()
    u = find_user(username)
    if not u:
        return jsonify({'ok': False}), 401
    return jsonify({'ok': True, 'username': u['username'], 'role': u['role'], 'active': u.get('active', True)}), 200

@app.get('/api/systems')
def api_systems():
    return jsonify({'ok': True, 'systems': systems}), 200

@app.get('/api/admin/tests')
def admin_list_tests():
    user, role = header_identity()
    if role != 'admin': return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    ordered = sorted(tests, key=lambda t: t.get('priority', 0))
    return jsonify({'ok': True, 'tests': ordered, 'systems': systems}), 200

@app.post('/api/admin/tests')
def admin_create_test():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    if len(tests) >= MAX_TESTS:
        return jsonify({'ok': False, 'message': 'Limite de 15 testes atingido (demo).'}), 400

    data = request.get_json(force=True)
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()
    system_id = int(data.get('system_id') or 1)
    module = (data.get('module') or '').strip()

    if not name: return jsonify({'ok': False, 'message': 'Nome é obrigatório.'}), 400
    if not get_system(system_id): return jsonify({'ok': False, 'message': 'Sistema inválido.'}), 400

    priority = len(tests) + 1
    new_test = {
        'id': next_test_id(), 'name': name, 'description': description,
        'system_id': system_id, 'module': module, 'active': True,
        'priority': priority, 'created_by': user or 'adm123'
    }
    tests.append(new_test)
    return jsonify({'ok': True, 'test': new_test}), 201

@app.post('/api/admin/tests/update')
def admin_update_test():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403

    data = request.get_json(force=True)
    test_id = int(data.get('id') or 0)
    t = next((x for x in tests if x['id'] == test_id), None)
    if not t: return jsonify({'ok': False, 'message': 'Teste não encontrado.'}), 404

    for key in ['name', 'description', 'module']:
        if key in data: t[key] = (data.get(key) or '').strip()
    if 'system_id' in data:
        sys_id = int(data.get('system_id') or 1)
        if not get_system(sys_id):
            return jsonify({'ok': False, 'message': 'Sistema inválido.'}), 400
        t['system_id'] = sys_id
    if 'active' in data: t['active'] = bool(data.get('active'))

    return jsonify({'ok': True, 'test': t}), 200

@app.post('/api/admin/tests/delete')
def admin_delete_test():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    data = request.get_json(force=True)
    test_id = int(data.get('id') or 0)
    global tests, test_results
    if not any(t['id'] == test_id for t in tests):
        return jsonify({'ok': False, 'message': 'Teste não encontrado.'}), 404
    tests = [t for t in tests if t['id'] != test_id]
    test_results = [r for r in test_results if r['test_id'] != test_id]
    for i, t in enumerate(sorted(tests, key=lambda x: x.get('priority', 0)), start=1):
        t['priority'] = i
    return jsonify({'ok': True}), 200

@app.post('/api/admin/tests/reorder')
def admin_reorder_tests():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    data = request.get_json(force=True)
    order = data.get('order') or []
    priority_map = {tid: i+1 for i, tid in enumerate(order)}
    for t in tests:
        if t['id'] in priority_map:
            t['priority'] = priority_map[t['id']]
    tests.sort(key=lambda x: x.get('priority', 0))
    return jsonify({'ok': True, 'tests': tests}), 200

@app.get('/api/admin/users')
def admin_list_users():
    user, role = header_identity()
    if role != 'admin': return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    testers = [u for u in users if u['role'] == 'tester']
    return jsonify({'ok': True, 'users': testers}), 200

@app.post('/api/admin/users')
def admin_create_user():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    if len(users) >= MAX_USERS:
        return jsonify({'ok': False, 'message': 'Limite de 10 usuários (demo).'}), 400

    data = request.get_json(force=True)
    username = (data.get('username') or '').strip()
    if not username: return jsonify({'ok': False, 'message': 'Username obrigatório.'}), 400
    if find_user(username): return jsonify({'ok': False, 'message': 'Usuário já existe.'}), 400

    users.append({'username': username, 'password': 'adm123', 'role': 'tester', 'active': True})
    testers = [u for u in users if u['role'] == 'tester']
    return jsonify({'ok': True, 'users': testers}), 201

@app.post('/api/admin/users/update')
def admin_update_user():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    data = request.get_json(force=True)
    username = (data.get('username') or '').strip()
    u = find_user(username)
    if not u or u['role'] != 'tester':
        return jsonify({'ok': False, 'message': 'Usuário não encontrado.'}), 404

    if 'new_username' in data:
        new_username = (data.get('new_username') or '').strip()
        if not new_username: return jsonify({'ok': False, 'message': 'Novo username inválido.'}), 400
        if find_user(new_username) and new_username != username:
            return jsonify({'ok': False, 'message': 'Novo username já existe.'}), 400
        for r in test_results:
            if r['username'] == username: r['username'] = new_username
        for lg in user_logs:
            if lg['username'] == username: lg['username'] = new_username
        u['username'] = new_username

    if 'active' in data:
        u['active'] = bool(data.get('active'))

    return jsonify({'ok': True, 'user': u}), 200

@app.post('/api/admin/users/delete')
def admin_delete_user():
    user, role = require_admin()
    if not role: return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    data = request.get_json(force=True)
    username = (data.get('username') or '').strip()
    u = find_user(username)
    if not u or u['role'] != 'tester':
        return jsonify({'ok': False, 'message': 'Usuário não encontrado.'}), 404
    global users, test_results, user_logs
    users = [x for x in users if x['username'] != username]
    test_results = [r for r in test_results if r['username'] != username]
    user_logs = [l for l in user_logs if l['username'] != username]
    return jsonify({'ok': True}), 200

@app.get('/api/admin/users/logs')
def admin_user_logs():
    user, role = header_identity()
    if role != 'admin': return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    username = request.args.get('username')
    logs = [l for l in user_logs if (not username or l['username'] == username)]
    logs.sort(key=lambda x: x['ts'], reverse=True)
    return jsonify({'ok': True, 'logs': logs[:200]}), 200

@app.get('/api/tester/tests')
def tester_list_tests():
    u, role = header_identity()
    if role not in ('tester', 'admin'): return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    active_tests = [t for t in tests if t['active']]
    active_tests.sort(key=lambda x: x.get('priority', 0))
    return jsonify({'ok': True, 'tests': active_tests}), 200

@app.get('/api/test-templates')
def api_test_templates():
    """Retorna os testes modelos disponíveis para seleção por módulo."""
    module = request.args.get('module')
    if module == 'CORE':
        templates = test_templates.get('CORE', [])
    elif module:
        templates = test_templates.get(module, [])
    else:
        # Se nenhum módulo for fornecido, retorna todos (útil para o sistema)
        templates = []
        for mod, tests in test_templates.items():
            templates.extend(tests)
            
    return jsonify({'ok': True, 'templates': templates}), 200

@app.post('/api/tester/execute')
def tester_execute():
    u, role = header_identity()
    if role not in ('tester', 'admin'): return jsonify({'ok': False, 'message': 'Acesso negado'}), 403

    data = request.get_json(force=True)
    test_id = int(data.get('test_id') or 0)
    cycles = max(1, min(5, int(data.get('cycles') or 1)))

    t = next((x for x in tests if x['id'] == test_id and x['active']), None)
    if not t: return jsonify({'ok': False, 'message': 'Teste não encontrado/inativo.'}), 404

    successes = sum(1 for _ in range(cycles) if random.random() < 0.8)
    failures = cycles - successes
    result = {'test_id': t['id'], 'test_name': t['name'], 'username': u,
              'cycles': cycles, 'successes': successes, 'failures': failures, 'ts': now_ts()}
    test_results.append(result)

    my_runs = [r for r in test_results if r['username'] == u]
    my_cycles = sum(r['cycles'] for r in my_runs)
    my_success = sum(r['successes'] for r in my_runs)
    my_rate = round((my_success / my_cycles) * 100, 1) if my_cycles else 0.0

    return jsonify({'ok': True, 'result': result, 'my_success_rate': my_rate}), 201

@app.get('/api/tester/results')
def tester_results():
    u, role = header_identity()
    if role not in ('tester', 'admin'): return jsonify({'ok': False, 'message': 'Acesso negado'}), 403
    my_runs = [r for r in test_results if r['username'] == u]
    my_cycles = sum(r['cycles'] for r in my_runs)
    my_success = sum(r['successes'] for r in my_runs)
    my_rate = round((my_success / my_cycles) * 100, 1) if my_cycles else 0.0
    return jsonify({'ok': True, 'results': my_runs, 'my_success_rate': my_rate}), 200

@app.get('/api/admin/metrics')
def admin_metrics():
    u, role = header_identity()
    if role != 'admin': return jsonify({'ok': False, 'message': 'Acesso negado'}), 403

    per_test = []
    for t in tests:
        runs = [r for r in test_results if r['test_id'] == t['id']]
        total_cycles = sum(r['cycles'] for r in runs)
        total_success = sum(r['successes'] for r in runs)
        rate = round((total_success / total_cycles) * 100, 1) if total_cycles else 0.0
        per_test.append({
            'test_id': t['id'], 'test_name': t['name'], 'module': t.get('module') or '-',
            'total_runs': len(runs), 'total_cycles': total_cycles, 'success_rate': rate
        })

    per_user = []
    for un in [x['username'] for x in users if x['role'] == 'tester']:
        runs = [r for r in test_results if r['username'] == un]
        total_cycles = sum(r['cycles'] for r in runs)
        total_success = sum(r['successes'] for r in runs)
        rate = round((total_success / total_cycles) * 100, 1) if total_cycles else 0.0
        per_user.append({'username': un, 'runs': len(runs), 'total_cycles': total_cycles, 'success_rate': rate})

    all_cycles = sum(r['cycles'] for r in test_results)
    all_success = sum(r['successes'] for r in test_results)
    overall = round((all_success / all_cycles) * 100, 1) if all_cycles else 0.0

    return jsonify({'ok': True, 'per_test': per_test, 'per_user': per_user, 'overall_success': overall}), 200

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)