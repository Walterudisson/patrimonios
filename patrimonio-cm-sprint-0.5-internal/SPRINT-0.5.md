# Sprint 0.5 — Estado, identidade e permissões

## Objetivo

Corrigir inconsistências observadas nos testes da Sprint 0.4 sem antecipar o redesenho geral de layout.

## Entregas

- O título da página passa a ser `CM APP`, com favicon próprio.
- Perfis `admin` e `gestor` passam a ser tratados como perfis de abrangência global; divisões são atribuídas somente a `conferente`.
- Um Gestor que edita o próprio cadastro pode alterar somente o nome.
- As regras do Firestore reforçam as mesmas restrições da interface.
- Depois que todas as páginas da Relação forem carregadas, essa base completa permanece em memória.
- Alterações posteriores de status, divisão ou plaqueta filtram a base completa localmente, sem voltar aos primeiros 50 documentos e sem novas leituras.
- O botão Atualizar continua disponível para descartar a base local e consultar novamente o Firestore.

## Decisão sobre “carregar tudo”

Não foi criado um botão automático nesta sprint. Para o volume observado de aproximadamente 3.431 patrimônios, cada carga completa pode consumir aproximadamente uma leitura por documento, por usuário e por nova sessão, além de tráfego e memória no navegador.

A abordagem adotada preserva a paginação e aproveita a base completa somente quando o usuário deliberadamente já percorreu todas as páginas. Um comando explícito “Carregar tudo” pode ser avaliado depois para Administrador/Gestor, com aviso de custo, progresso e cancelamento.

## Arquivos públicos

- `index.html`
- `app.js`
- `app.css`
- `assets/favicon.svg`
- `js/config/firebase.js`
- `js/core/firestore-metrics.js`
- `js/services/divisoes.service.js`

## Arquivos internos

- `firestore.rules`
- `FIRESTORE-SETUP.md`
- `DECISOES-DE-PROJETO.md`
- `SPRINT-0.5.md`

Os arquivos internos não fazem parte do pacote destinado ao repositório público.

## Testes manuais recomendados

1. Entrar como Administrador, Gestor e Conferente.
2. Confirmar `CM APP` na aba do navegador e a exibição do favicon.
3. Como Gestor, abrir o próprio cadastro e confirmar que perfil e divisões não podem ser editados.
4. Como Administrador, editar um Gestor e salvar; confirmar `divisoesAtribuidas: []`.
5. Na Relação, carregar todas as páginas.
6. Alternar entre abas e voltar à Relação.
7. Filtrar por `Localizados`, `Pendentes`, divisão e plaqueta; confirmar a indicação `Filtro local` e a ausência de novas páginas.
8. Limpar os filtros; confirmar que toda a base carregada reaparece.
9. Usar `Atualizar`; confirmar que a primeira página é consultada novamente.
10. Executar uma alteração de patrimônio e confirmar que a Relação exige uma nova carga, evitando dados locais obsoletos.

