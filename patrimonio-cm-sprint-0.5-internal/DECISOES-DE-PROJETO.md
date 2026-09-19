# CM APP — decisões e próximos passos

## Identidade do produto

- O nome genérico da aplicação no navegador passa a ser `CM APP`.
- `Patrimônio` continua sendo o módulo atual e pode conservar sua identificação dentro da interface.
- O favicon foi iniciado nesta sprint. Manifesto, ícones instaláveis e service worker ficam para uma etapa futura de PWA.

## Catálogo de divisões

- A divisão temporária `CM/DIVISÃOdeTESTE` foi removida manualmente do Firestore.
- `divisoes` permanece como catálogo somente de leitura no app.
- Um CRUD completo só deverá ser retomado junto de regras para criação, renomeação, desativação, auditoria e tratamento de vínculos existentes.

## Papéis e divisões

- Administrador e Gestor têm abrangência global no módulo de patrimônio.
- `divisoesAtribuidas` tem significado somente para Conferentes.
- Gestor pode editar apenas o próprio nome; não pode alterar o próprio perfil ou divisões.
- Registros antigos de Gestores com divisões podem ser normalizados por um Administrador, salvando-os com `divisoesAtribuidas: []`.

## Relação e leituras

- A paginação de 50 documentos permanece como comportamento padrão.
- Depois de o usuário carregar todas as páginas, a base completa é preservada na sessão e os filtros passam a ser locais.
- Não haverá carregamento automático de todos os patrimônios nesta sprint.
- Um futuro botão “Carregar tudo” deve ser deliberado, preferencialmente limitado a Admin/Gestor, com estimativa de leituras, progresso e cancelamento.

## Layout responsivo

- Será realizada uma sprint de UX/layout para todo o app, com prioridade para desktop sem degradar o uso móvel.
- Em Administração, revisar o estado inicial de `GESTÃO DE CICLO E INVENTÁRIO`, hoje recolhido, e avaliar persistência da preferência do usuário.
- Na Fila, agrupar pendências por divisão em ordem alfabética.
- Para esses agrupamentos, usar preferencialmente os elementos semânticos nativos `<details>` e `<summary>`, com estilos, foco visível e estados acessíveis.

## Métricas do Firestore

- A atividade local rastreada permanece durante o cronograma de refatoração até a versão 2.0.
- Na versão 2.0, decidir entre remover o painel ou restringi-lo ao Administrador.
- O Console/relatório de faturamento do Firebase continua sendo a referência; o contador local é diagnóstico parcial da sessão.

## Repositório e publicação

- O pacote público não inclui regras, decisões, notas de sprint ou instruções operacionais.
- Esses documentos permanecem como documentação interna, fora do pacote de deploy.
- A segurança não depende de ocultar a configuração web do Firebase ou as regras; depende de regras publicadas corretamente, autenticação e negação por padrão.

