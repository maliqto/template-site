# Black Digital AI - Sistema de IA para Hacking Ético

🚀 **Sistema completo de IA especializada em segurança cibernética e hacking ético**

Um sistema web moderno e seguro que oferece ferramentas de IA para análise de segurança, teste de penetração, geração de código e muito mais.

## 🌟 Características Principais

- **IA Especializada**: Modelos de IA treinados para segurança cibernética
- **Interface Moderna**: Design escuro e futurista com animações fluidas
- **Sistema de Créditos**: Monetização através de sistema de créditos
- **Autenticação Segura**: JWT com refresh tokens e rate limiting
- **Pagamentos Integrados**: Suporte a Stripe para cartões e PIX
- **Dashboard Completo**: Painel administrativo e do usuário
- **API RESTful**: Backend profissional com Node.js e Express
- **Banco de Dados**: MongoDB com Mongoose ODM
- **Segurança Avançada**: Helmet, CORS, rate limiting e validação

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MongoDB** - Banco de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticação via tokens
- **Stripe** - Processamento de pagamentos
- **Socket.IO** - Comunicação em tempo real
- **Bcryptjs** - Hash de senhas
- **Helmet** - Segurança HTTP
- **Express Rate Limit** - Limitação de requisições

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Estilização moderna com gradientes e animações
- **JavaScript ES6+** - Funcionalidades interativas
- **SVG** - Ícones e logos vetorizados
- **Responsive Design** - Compatível com dispositivos móveis

## 📦 Instalação

### Pré-requisitos

- Node.js (versão 16 ou superior)
- MongoDB (local ou MongoDB Atlas)
- Conta no Stripe (para pagamentos)
- Conta de email (para envio de emails)

### Passo a Passo

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd "sms site"
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Copie o arquivo `.env` e configure as seguintes variáveis:

```env
# Servidor
PORT=3000
NODE_ENV=development
DOMAIN=localhost:3000

# Banco de Dados
MONGODB_URI=mongodb://localhost:27017/black-digital-ai

# JWT
JWT_SECRET=sua_chave_jwt_super_secreta_aqui
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=sua_chave_refresh_jwt_super_secreta_aqui
JWT_REFRESH_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
EMAIL_FROM=noreply@blackdigital.ai

# Outros
BCRYPT_ROUNDS=12
SESSION_SECRET=sua_chave_de_sessao_super_secreta
CSRF_SECRET=sua_chave_csrf_super_secreta
```

4. **Inicie o MongoDB**

Se estiver usando MongoDB local:
```bash
mongod
```

Ou configure a string de conexão do MongoDB Atlas no `.env`

5. **Execute o servidor**

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

6. **Acesse a aplicação**

Abra seu navegador e acesse: `http://localhost:3000`

## 🚀 Scripts Disponíveis

```bash
# Iniciar em modo de desenvolvimento
npm run dev

# Iniciar em modo de produção
npm start

# Executar testes
npm test

# Verificar código com ESLint
npm run lint

# Formatar código com Prettier
npm run format
```

## 📁 Estrutura do Projeto

```
sms site/
├── models/              # Modelos do banco de dados
│   ├── User.js         # Modelo de usuário
│   ├── Transaction.js  # Modelo de transações
│   └── AILog.js        # Modelo de logs de IA
├── middleware/          # Middlewares personalizados
│   ├── auth.js         # Autenticação e autorização
│   └── validation.js   # Validação de dados
├── routes/             # Rotas da API
│   ├── auth.js         # Autenticação
│   ├── users.js        # Usuários
│   ├── payments.js     # Pagamentos
│   ├── ai.js           # IA
│   └── admin.js        # Administração
├── public/             # Arquivos estáticos
│   ├── css/            # Estilos CSS
│   ├── js/             # JavaScript do frontend
│   └── images/         # Imagens e ícones
├── uploads/            # Arquivos enviados pelos usuários
├── server.js           # Servidor principal
├── package.json        # Dependências e scripts
├── .env                # Variáveis de ambiente
└── README.md           # Este arquivo
```

## 🔐 Segurança

O sistema implementa várias camadas de segurança:

- **Autenticação JWT** com refresh tokens
- **Rate Limiting** para prevenir ataques de força bruta
- **Validação de dados** em todas as entradas
- **Hash de senhas** com bcrypt
- **Headers de segurança** com Helmet
- **CORS** configurado adequadamente
- **Sanitização** de dados de entrada
- **Logs de auditoria** para todas as ações

## 💳 Sistema de Pagamentos

O sistema suporta:

- **Cartões de crédito/débito** via Stripe
- **PIX** (para usuários brasileiros)
- **Webhooks** para confirmação automática
- **Reembolsos** através do painel administrativo
- **Histórico completo** de transações

## 🤖 Funcionalidades de IA

- **Geração de código** para exploits e ferramentas
- **Análise de vulnerabilidades** em código e sistemas
- **Teste de penetração** automatizado
- **Geração de relatórios** de segurança
- **Análise de logs** e detecção de anomalias
- **Criação de payloads** personalizados

## 📊 Painel Administrativo

O painel admin oferece:

- **Dashboard** com métricas em tempo real
- **Gerenciamento de usuários** (criar, editar, suspender)
- **Controle de transações** e reembolsos
- **Logs de atividade** e auditoria
- **Relatórios** de receita e uso
- **Configurações** do sistema

## 🔧 Configuração de Produção

### Variáveis de Ambiente para Produção

```env
NODE_ENV=production
DOMAIN=seudominio.com
MONGODB_URI=mongodb+srv://...
# Configure todas as outras variáveis com valores de produção
```

### Recomendações

1. **Use HTTPS** em produção
2. **Configure um proxy reverso** (Nginx)
3. **Use PM2** para gerenciamento de processos
4. **Configure backups** regulares do banco
5. **Monitore logs** e métricas
6. **Use CDN** para arquivos estáticos

## 🐛 Solução de Problemas

### Problemas Comuns

**Erro de conexão com MongoDB:**
- Verifique se o MongoDB está rodando
- Confirme a string de conexão no `.env`
- Verifique permissões de rede (MongoDB Atlas)

**Erro de autenticação:**
- Verifique se JWT_SECRET está configurado
- Confirme se o token não expirou
- Verifique headers de autorização

**Problemas com pagamentos:**
- Confirme as chaves do Stripe
- Verifique se o webhook está configurado
- Teste com dados de cartão de teste

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte técnico:
- Email: suporte@blackdigital.ai
- Discord: [Link do servidor]
- Documentação: [Link da documentação]

## 🎯 Roadmap

- [ ] Integração com mais modelos de IA
- [ ] Suporte a mais métodos de pagamento
- [ ] App mobile (React Native)
- [ ] API pública para desenvolvedores
- [ ] Marketplace de ferramentas
- [ ] Integração com ferramentas de pentest

---

**⚠️ Aviso Legal**: Este sistema é destinado apenas para fins educacionais e testes de segurança autorizados. O uso inadequado das ferramentas pode violar leis locais e internacionais.

**🔒 Uso Ético**: Sempre obtenha autorização adequada antes de realizar testes de penetração ou análises de segurança em sistemas que não sejam seus.

---

*Desenvolvido com ❤️Sender*#   t e m p l a t e - s i t e 
 
 
