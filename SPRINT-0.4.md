# Patrimônio CM — Sprint 0.4

## Objetivo

Aplicar os ajustes encontrados nos testes da Sprint 0.3 e iniciar a modularização do JavaScript sem alterar os fluxos centrais do inventário.

## Alterações implementadas

- O contador e o botão `Carregar mais 50` foram movidos para o início da tela Relação, antes dos filtros e das divisões.
- Os seletores e listas de caixas de seleção de divisões são reconstruídos em ordem alfabética usando regras de ordenação `pt-BR`.
- A seleção atual é preservada quando as opções são reconstruídas.
- O painel administrativo de criação e sincronização de divisões foi removido.
- A coleção `divisoes` continua sendo a fonte de leitura dos seletores, com fallback temporário para as divisões atribuídas aos usuários.
- O app não contém mais comandos de escrita ou sincronização integral da coleção `divisoes`.
- O indicador do Dashboard foi renomeado para `Atividade local rastreada` e agora informa que é uma estimativa parcial da aba atual.
- O Console do Firebase ficou documentado como referência para a visão do projeto, e o relatório de faturamento como referência para a cobrança.
- A configuração do Firebase foi extraída para `js/config/firebase.js`.
- O medidor local foi extraído para `js/core/firestore-metrics.js`.
- A leitura do catálogo foi extraída para `js/services/divisoes.service.js`.
- As regras completas do Firestore foram adicionadas em `firestore.rules`.
- O bootstrap público do primeiro Administrador foi removido para compatibilidade com as regras seguras.
- O autocomplete e o seletor de localização do Conferente passaram a respeitar as divisões atribuídas também nas consultas ao servidor.
- Coleções desconhecidas ficam bloqueadas por padrão.

## Decisão sobre o catálogo

Nesta etapa foi adotado o caminho de menor risco: manter a base já criada e retirar a manutenção do catálogo da interface. Um CRUD completo fica adiado até que sejam definidos validação, auditoria, renomeação, desativação e impactos sobre patrimônios e usuários existentes.

## Sobre as leituras

O número mostrado no app não deve ser comparado como se fosse igual ao total diário do Console do Firebase. O contador local começa ao abrir a aba e cobre apenas os pontos instrumentados no código. Ele não conhece outras abas, usuários ou sessões, nem reproduz com exatidão leituras de índices, avaliações de regras ou reconexões de listeners.

## Testes manuais recomendados

1. Abrir a Relação e confirmar que o contador aparece antes do bloco de filtros.
2. Carregar a primeira página e usar `Carregar mais 50` no topo.
3. Confirmar a preservação dos itens anteriores após carregar a página seguinte.
4. Verificar a ordem alfabética nos seletores de Leitura, Relação, Usuários e Gestão de Ciclo.
5. Confirmar que a seção Catálogo de Divisões não aparece mais em Administração.
6. Confirmar que os seletores continuam recebendo dados da coleção `divisoes`.
7. Validar o fallback com um usuário que tenha divisões atribuídas.
8. Comparar o texto explicativo do Dashboard com o total oficial exibido no Console.
9. Publicar `firestore.rules` somente depois de confirmar o UID e o documento do Administrador.
10. Executar o checklist de permissões de `FIRESTORE-SETUP.md` com os três perfis.

## Fora do escopo

- CRUD completo de divisões.
- Redesenho visual e responsivo global para desktop.
- Comparação exata ou reprodução do faturamento do Firestore dentro do navegador.
- Migração total do arquivo principal para módulos.
- Custom Claims e revisão completa das Security Rules.
