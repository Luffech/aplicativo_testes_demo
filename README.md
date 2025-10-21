# 🧩 Test Manager ERP (DEMO)

Sistema web de **gerenciamento de testes ERP** com identidade visual inspirada na **GE Aerospace**.  
Permite que administradores e testadores gerenciem, executem e acompanhem casos de teste de forma intuitiva e visual.

---

## 🖥️ Demonstração Visual

Tela de login:
![Login preview](<img width="1855" height="913" alt="Screenshot 2025-10-21 at 13-26-10 Login • Test Manager ERP (DEMO)" src="https://github.com/user-attachments/assets/4a75a554-4063-4e16-b13c-1584df8ec303" />
)

Painel administrativo:
![Admin dashboard](<img width="1855" height="913" alt="Screenshot 2025-10-21 at 13-26-28 Admin • Casos de Teste" src="https://github.com/user-attachments/assets/917114c2-2ee0-4a99-9eea-b8b7598a86f3" />
)

---

## ⚙️ Tecnologias Utilizadas

**Backend:**
- [Python 3.x](https://www.python.org/)
- [Flask](https://flask.palletsprojects.com/)
- Mock de banco de dados em memória (sem persistência)

**Frontend:**
- HTML5 + CSS3 (design system próprio inspirado no Tailwind)
- JavaScript vanilla (sem dependências externas)
- Layout responsivo e compatível com navegadores modernos

---

## 🧠 Estrutura de Páginas

| Página | Caminho | Descrição |
|:--|:--|:--|
| `login.html` | `/` | Tela inicial com autenticação mockada |
| `admin-dashboard.html` | `/admin` | Hub principal do administrador |
| `admin-tests.html` | `/admin/tests` | Gerenciamento e criação de casos de teste |
| `admin-users.html` | `/admin/users` | Cadastro e controle de testadores |
| `admin-metrics.html` | `/admin/metrics` | Painel com métricas e KPIs do sistema |
| `tester-dashboard.html` | `/tester` | Área de execução e acompanhamento dos testes |

---

## 🧩 Estrutura de Pastas

project/
│
├── app.py # Backend Flask principal
├── static/
│ ├── style.css # Estilos globais e do login
│ ├── script.js # Lógica front-end (login, admin, tester)
│ └── logoge.png # Logotipo GE (mock)
│
├── templates/
│ ├── login.html
│ ├── admin-dashboard.html
│ ├── admin-tests.html
│ ├── admin-users.html
│ ├── admin-metrics.html
│ └── tester-dashboard.html
│
└── README.md


---

## 💻 Instalação e Execução no PowerShell (Windows)

> Estes passos assumem que você já possui **Python 3** instalado.  
> Para verificar, digite no PowerShell:
> ```bash
> python --version
> ```

### 1. **Abrir o PowerShell**
No menu Iniciar do Windows, procure por **PowerShell** e abra.

### 2. **Navegar até a pasta do projeto**
Use o comando `cd` para entrar na pasta onde você salvou o projeto:

```bash
cd "C:\caminho\para\pasta\do\projeto"

Exemplo:

cd "C:\Users\seunome\Documents\python_com_lufech\test_manager"

3. Criar um ambiente virtual (opcional, mas recomendado)

Isso isola as dependências do projeto:

python -m venv venv

Ativar o ambiente virtual:

venv\Scripts\Activate

Você saberá que deu certo se aparecer algo assim no início da linha:

(venv) PS C:\Users\seunome\Documents\python_com_lufech\test_manager>

4. Instalar o Flask

Agora, com o ambiente ativado, execute:

pip install flask

Se quiser confirmar que foi instalado:

pip list

Deve aparecer algo como:

Package    Version
---------- -------
Flask      3.0.x

5. Executar o servidor Flask

Com tudo instalado, rode o sistema com:

python app.py

Você verá uma mensagem parecida com:

 * Running on http://127.0.0.1:5000

Abra o navegador e acesse:
👉 http://127.0.0.1:5000
🔐 Credenciais de Acesso
Tipo	Usuário	Senha
Admin	adm123	adm123
Testadores	igor, isaque, luiz, kevin, diego	adm123
🎯 Funcionalidades
👤 Login

    Autenticação simulada (mock)

    Interface moderna e responsiva

    Validação de credenciais diretamente no front-end

🧑‍💼 Admin

    Criar, editar, reordenar e remover casos de teste

    Cadastrar e excluir usuários testadores

    Painel de métricas visuais com barras coloridas e KPIs

🧪 Testador

    Visualiza lista de testes disponíveis

    Executa testes simulados

    Acompanha taxa de sucesso e histórico

🎨 Identidade Visual

    Baseada na GE Aerospace

    Fundo com ondas e gradientes CSS puros

    Cores principais:

        Azul primário #0f3fa4

        Azul claro #2563eb

        Azul escuro #0b4ee6

📈 Futuras Sprints
Sprint	Foco	Objetivo
1	CRUD Mockado	Estrutura funcional com dados simulados
2	Banco real	Integração com PostgreSQL
3	Autenticação real	JWT e controle de sessões
4	Relatórios	Exportação de logs e métricas
5	Integração ERP	Comunicação com sistemas SAP reais
🧑‍💻 Autor

Desenvolvido por Luiz Fernando Francedino Chagas
Projeto educacional da trilha Residência TIC / Brisa + Serratec

    © 2025 – Todos os direitos reservados.
