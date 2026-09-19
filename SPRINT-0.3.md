# Patrimônio CM — Sprint 0.3

## Objetivo

Paginar a Relação Patrimonial e criar um catálogo próprio de divisões, eliminando a necessidade de ler a coleção inteira para preencher seletores e filtros.

## Alterações implementadas

- Relação paginada em blocos de 50 patrimônios.
- Paginação por cursor com `startAfter()`; nenhum uso de `offset`.
- Botão `Carregar mais 50`.
- Contador `itens carregados / total encontrado`.
- Contagem total feita por agregação do Firestore.
- Status, divisão e prefixo de plaqueta enviados para a consulta no servidor.
- Busca de plaqueta com mínimo de três números e debounce de 400 ms.
- Exportações da Relação identificadas como exportação dos itens já carregados.
- Nova coleção `divisoes` como fonte dos seletores do sistema.
- Administração ganhou o painel `Catálogo de Divisões`.
- Administrador pode adicionar divisões individualmente.
- Administrador pode executar uma sincronização inicial a partir dos patrimônios existentes.
- A sincronização completa é explícita, confirmada e registrada no medidor de leituras.
- Catálogo possui fallback temporário para divisões atribuídas aos usuários caso a coleção ainda esteja vazia ou sem permissão.
- Nomes do catálogo são apresentados usando `textContent` e elementos DOM, evitando injeção de HTML nessa interface.

## Implantação

1. Ajuste as regras conforme `FIRESTORE-SETUP.md`.
2. Publique a aplicação da Sprint 0.3.
3. Entre com um perfil Administrador.
4. Abra `Administração`.
5. Expanda `Catálogo de Divisões`.
6. Execute `Sincronizar a partir dos patrimônios` uma única vez.
7. Confirme se todas as divisões aparecem no catálogo.
8. Teste os seletores de Scanner, Relação, Usuários e Gestão de Ciclo.

## Consumo esperado da Relação

Ao abrir a Relação:

- uma agregação para contar o resultado;
- até 50 leituras de documentos para a primeira página.

Ao selecionar `Carregar mais 50`:

- até 50 novas leituras;
- nenhuma releitura deliberada das páginas anteriores.

Ao trocar filtros:

- a paginação é reiniciada;
- uma nova contagem é executada;
- somente a primeira página do novo resultado é carregada.

## Compatibilidade

- Admin e Gestor podem consultar todas as divisões, mantendo o comportamento atual da aplicação.
- Conferente recebe consultas limitadas às divisões atribuídas.
- Se um Conferente possuir mais de dez divisões, a tela utiliza o fallback documental da Sprint 0.2. Esse caso deverá ser eliminado quando o modelo de permissões for migrado para a arquitetura V2.
- Itens sem o campo booleano `localizado` não aparecem no filtro `Pendentes`; a futura migração deve normalizar esse campo para `false`.

## Testes manuais

1. Abrir a Relação com cada perfil.
2. Confirmar que a primeira carga não ultrapassa 50 itens.
3. Usar `Carregar mais 50` e verificar que os itens anteriores permanecem.
4. Filtrar por divisão.
5. Filtrar por localizado e pendente.
6. Pesquisar pelo prefixo de uma plaqueta.
7. Alterar rapidamente o texto e validar o debounce.
8. Atualizar os dados manualmente.
9. Exportar os itens carregados.
10. Sincronizar o catálogo em ambiente de homologação.
11. Adicionar uma divisão manualmente.
12. Validar o contador de leituras no Dashboard.

## Fora do escopo

- Paginação reversa.
- Exportação integral no backend.
- Desativação ou renomeação de divisões.
- Normalização automática de campos antigos.
- Custom Claims e revisão completa das Security Rules.
- Novo modelo de ciclos, transferências e auditoria imutável.

