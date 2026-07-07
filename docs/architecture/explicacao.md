## ① CI/CD Pipeline — "O caminho do código até ao servidor"

**CI/CD** significa *Continuous Integration / Continuous Deployment* — integração contínua e entrega contínua. É o sistema que garante que o código novo não parte nada antes de chegar ao utilizador.

### 👨‍💻 Developer → GitHub Repository

O **Developer** (tu) escreve código e faz `git push`. O **GitHub Repository** é simplesmente o "cofre" onde o código vive na cloud — pensa nele como uma pasta partilhada com histórico completo de todas as alterações alguma vez feitas. 

### GitHub Repository → GitHub Actions CI

**GitHub Actions** é um sistema de automação que o próprio GitHub disponibiliza. Quando alguém faz `push` ou abre um *Pull Request* (PR — uma proposta de juntar código novo ao código existente), o GitHub Actions acorda automaticamente e executa uma sequência de tarefas. É como um assistente que verifica o teu trabalho de forma automática antes de avançar. 

### GitHub Actions → pnpm install → Vitest → Firebase Emulator

Esta é a sequência de verificação automática: 

- **pnpm install** — `pnpm` é um gestor de pacotes (como um "instalador de bibliotecas externas" para Node.js, semelhante ao `npm` mas mais rápido e eficiente em disco). O `install` descarrega todas as dependências do projeto de forma determinística — ou seja, sempre as mesmas versões, sem surpresas.
- **Vitest** — framework de testes unitários para JavaScript/TypeScript. Testes *unitários* são pequenas verificações automáticas que confirmam que uma função ou lógica específica faz o que se espera. É como ter uma bateria de perguntas de "sim/não" sobre o comportamento do código.
- **Firebase Emulator (rules tests)** — o Firebase Emulator é um simulador local que replica o comportamento da base de dados Firebase sem precisar de acesso à internet ou à base de dados real. É usado aqui especificamente para testar as *regras de segurança* (quem pode ler e escrever o quê) sem risco de afetar dados reais. 

### → ✓ CI passa

Se todos os testes passarem, o sistema assinala "CI passa" e o código está autorizado a seguir para o servidor.

***

## ② Deploy & Pedido HTTP — "O código chega ao servidor e o utilizador bate à porta"

### ✓ CI passa → Vercel (Deploy automático)

**Vercel** é uma plataforma de *hosting* (alojamento) especializada em aplicações Next.js. Quando o CI passa, o Vercel recebe automaticamente o código aprovado e faz **deploy** — ou seja, coloca a versão nova do site em funcionamento nos seus servidores distribuídos pelo mundo. O termo "deploy" é literalmente "colocar em campo". 

### Vercel → Next.js App (App Router)

**Next.js** é a *framework* (estrutura de desenvolvimento) que organiza toda a aplicação. Em vez de seres tu a inventar como organizar páginas, rotas, e como o servidor e o browser comunicam, o Next.js define convenções para isso. O **App Router** é o sistema de navegação interno do Next.js — cada pasta no código corresponde a uma rota da aplicação (ex: `/professor/estagios` é uma pasta `professor/estagios/` no código). 

### 🌐 Browser do Utilizador → Next.js App (seta "HTTPS request")

Quando um utilizador abre o browser e acede ao site, está a fazer um **pedido HTTPS**. O **HTTPS** (*HyperText Transfer Protocol Secure*) é o protocolo de comunicação na internet — o "S" de *Secure* significa que a comunicação é encriptada, ou seja, ninguém no meio consegue ler os dados trocados. É o cadeado que vês no browser. 

### Next.js → reCAPTCHA v3 (seta tracejada "login/registo")

**reCAPTCHA v3** é um serviço da Google que deteta se quem está a fazer login ou registo é um humano ou um bot (programa automático malicioso). A versão 3 é *invisível* — não mostra o famoso "não sou um robô" — analisa o comportamento do utilizador em segundo plano e atribui uma pontuação de 0 a 1 (0 = provavelmente bot, 1 = provavelmente humano). O Next.js envia essa pontuação ao servidor para verificação antes de processar qualquer registo. 

### Next.js → Zod (seta tracejada "API routes + forms")

**Zod** é uma biblioteca de validação de dados para TypeScript. Quando um formulário é submetido ou uma API recebe dados, o Zod verifica se esses dados têm o formato esperado antes de os processar — por exemplo, confirma que um NIF tem 9 dígitos, que um email tem `@`, ou que uma data é válida. É a primeira linha de defesa contra dados mal formatados ou maliciosos. 

### Browser → Vercel Analytics (seta tracejada)

**Vercel Analytics** é o sistema de monitorização de desempenho e visitas do Vercel. Regista métricas como tempo de carregamento das páginas e número de visitantes, diretamente do browser do utilizador, de forma anónima. 

***

## ③ Edge Middleware — proxy.ts — "O porteiro da aplicação"

Esta zona é o sistema de controlo de acesso — acontece *antes* de qualquer página carregar.

### Next.js → proxy.ts (seta "rota protegida")

**Middleware** é código que corre *entre* o pedido HTTP e a resposta — é um intermediário. O ficheiro `proxy.ts` é o middleware de **Edge** desta aplicação. **Edge** significa que este código corre nos servidores do Vercel mais próximos do utilizador (na "borda" da rede — *edge of the network*), antes de chegar ao servidor principal, o que o torna muito rápido. Toda a vez que alguém tenta aceder a uma rota protegida (dashboard, painel do professor, etc.), o `proxy.ts` é o primeiro a correr. 

### proxy.ts → 1. Lê cookie `internlink_session`

Um **cookie** é um pequeno ficheiro de texto que o browser guarda no computador do utilizador e envia automaticamente em cada pedido ao servidor. O cookie `internlink_session` contém o **JWT** da sessão do utilizador. É marcado como *HTTP-only* (o JavaScript no browser não o consegue ler, protegendo contra roubo) e *Secure* (só é enviado em conexões HTTPS). 

### → 2. Valida JWT (jose + JWKS Google)

**JWT** — *JSON Web Token* — é um formato de token de identificação. Imagina-o como um bilhete de cinema assinado digitalmente: contém informação sobre o utilizador (quem é, que papel tem, quando expira) e uma assinatura que prova que foi emitido por uma fonte confiável (Firebase/Google). Não pode ser falsificado sem a chave privada.

**jose** é uma biblioteca JavaScript que sabe ler e verificar JWTs de forma compatível com o ambiente Edge (muito leve, sem dependências pesadas).

**JWKS** — *JSON Web Key Set* — é o conjunto de chaves públicas que a Google disponibiliza numa URL pública. O `proxy.ts` usa estas chaves para verificar se a assinatura do JWT é genuinamente da Google/Firebase, sem nunca ter de contactar o Firebase diretamente. É como verificar um selo oficial sem ligar para a entidade emissora. 

### → 3. Verifica role + estado vs. rota pedida

**Role** (papel/função) é a categoria do utilizador: `aluno`, `professor`, `tutor`, `admin_escolar`, etc. **Estado** é a situação da conta: `ativo`, `pendente`, `recusado`, etc. O proxy verifica se o role e estado extraídos do JWT têm permissão para aceder à rota pedida. Por exemplo, um `aluno` não pode aceder a `/professor/estagios`. 

### → ✅ Acesso permitido / 🚫 Redirect /login ou /account-status

Se tudo for válido, o utilizador passa e vê a página. Se o JWT for inválido ou expirado, é redirecionado para `/login`. Se o JWT for válido mas o estado da conta não for `ativo` (por exemplo, está `pendente` de aprovação), é redirecionado para `/account-status` — uma página que explica a situação da conta. 

***

## ④ Firebase Platform — "O motor de dados da aplicação"

**Firebase** é uma plataforma da Google que disponibiliza múltiplos serviços de backend (servidor) prontos a usar, sem necessidade de gerir servidores próprios. O Next.js comunica com o Firebase através de dois SDKs (*Software Development Kit* — conjunto de ferramentas de programação):

- **Admin SDK** — usado no lado do servidor (API routes), tem permissões totais e usa uma chave privada secreta
- **Client SDK** — usado no browser, tem apenas as permissões definidas pelas regras de segurança 

### 🔑 Firebase Auth — "Quem és tu?"

**Firebase Auth** é o sistema de autenticação. Gere o login com email + password e com Google Sign-In. Quando um utilizador faz login com sucesso, o Firebase emite um **ID Token** (um JWT) que prova a sua identidade. A aplicação troca esse ID Token por um cookie de sessão `internlink_session` de 14 dias. Os **Custom Claims** são campos extra adicionados ao JWT pelo servidor — neste caso, o `role` e o `estado` do utilizador, que o proxy usa para tomar decisões de acesso. 

### 🗄 Firestore — "A base de dados principal"

**Firestore** é uma base de dados *NoSQL* orientada a documentos. Em vez de tabelas com linhas (como Excel ou SQL), organiza dados em **coleções** (equivalente a tabelas) e **documentos** (equivalente a linhas), mas onde cada documento pode ter estrutura diferente e conter subcoleções. A InternLink tem 14+ coleções (utilizadores, estágios, empresas, cursos, etc.) com 19 índices compostos para consultas complexas. O Firestore é a fonte de verdade de todos os dados da plataforma. 

### ⚡ Realtime Database — "O chat em tempo real"

**Realtime Database** (RTDB) é outra base de dados da Firebase, mas estruturada como uma grande árvore JSON e otimizada para **sincronização em tempo real** — quando um utilizador escreve uma mensagem, todos os outros utilizadores na mesma conversa recebem a atualização em milissegundos sem precisar de refrescar a página. É usada exclusivamente para o sistema de chat da aplicação (mensagens, estado de digitação, contadores de mensagens não lidas). 

### 📦 Firebase Storage — "Os ficheiros"

**Firebase Storage** é um serviço de armazenamento de ficheiros (como o Google Drive, mas para programadores). Guarda os PDFs dos documentos de estágio, imagens de perfil, logótipos de empresas, assinaturas digitais, e relatórios finais. Cada pasta tem regras de acesso próprias — por exemplo, só o próprio utilizador pode fazer upload da sua assinatura, e só os membros de um estágio podem ler os seus documentos. 

### Regras de segurança (linhas tracejadas de baixo)

As três caixas amarelas (`firestore.rules`, `database.rules.json`, `storage.rules`) representam ficheiros de código que definem **quem pode fazer o quê** em cada serviço — são avaliadas diretamente nos servidores da Google, completamente independentes da aplicação. Mesmo que alguém tentasse aceder diretamente ao Firebase (sem passar pelo Next.js), estas regras bloqueariam acessos não autorizados. 

- `firestore.rules` — 771 linhas, define permissões de leitura/escrita por coleção e por role
- `database.rules.json` — 200 linhas, controla quem pode ler/escrever no chat
- `storage.rules` — 161 linhas, controla quem pode fazer upload/download de cada tipo de ficheiro

### ☁ Cloud Functions — "Tarefas automáticas em background"

**Cloud Functions** são pequenos programas que correm nos servidores da Google em resposta a eventos ou agendamentos, sem servidor próprio (*serverless*). Neste projeto são usadas para limpeza periódica dos **audit logs** (registos de auditoria — histórico de todas as ações feitas na plataforma por razões de rastreabilidade e conformidade). 

***

## Resumo da arquitetura num parágrafo

O **developer** escreve código e envia para o **GitHub**, que aciona o **GitHub Actions** para correr testes automáticos (**Vitest** + **Firebase Emulator**). Se tudo passar, o **Vercel** faz deploy automático da aplicação **Next.js**. Quando um utilizador abre o browser e faz um pedido **HTTPS**, o **proxy.ts** (Edge Middleware) interceta-o, lê o **cookie** de sessão, valida o **JWT** com as chaves públicas **JWKS** da Google via **jose**, e verifica se o `role` e `estado` do utilizador têm acesso à rota pedida — caso contrário, redireciona. Nos formulários de login/registo, o **reCAPTCHA v3** garante que não é um bot. O **Zod** valida os dados nas APIs. Depois de autenticado e autorizado, o Next.js comunica com o **Firebase** para ler/escrever dados no **Firestore**, trocar mensagens em tempo real no **Realtime Database**, ou gerir ficheiros no **Storage** — tudo protegido por regras de segurança independentes que correm nos servidores da Google. 