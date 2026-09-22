# Sprint 1.3A — Divisão em foco (v1.13.0)

## Alcance

- Base: CM APP v1.12.5. Esta primeira parte da Sprint 1.3 trata somente da seleção de escopo visual no Painel e na Relação.
- Gestor e Administrador conservam acesso global e iniciam em **Todas as divisões permitidas**. Podem selecionar qualquer divisão do catálogo para visualizar seus números e itens.
- Conferente com uma divisão inicia nela. Com várias, escolhe a divisão antes de consultar Painel ou Relação; pode optar explicitamente por **Todas as divisões permitidas**. A escolha fica na sessão do dispositivo para o mesmo UID.
- A barra aparece acima do Painel e da Relação, inclusive em telas pequenas. O filtro antigo de divisão na Relação foi substituído por essa única escolha compartilhada.
- O escopo não altera direitos de leitura ou gravação nem o local escolhido na tela de Leitura. A Fila de aprovação continua global para perfis validadores, com contador global independente do foco do Painel.
- A Relação mantém páginas de até 50 e reinicia cursores/caches quando muda o foco. Respostas de consultas anteriores à mudança não substituem a divisão atual.
- No Painel filtrado, as contagens usam agregações do Firestore com os mesmos vínculos da Relação: divisão de origem, divisão legada, local atual e destino de transferência pendente. Por isso, um item deslocado ainda pode aparecer na divisão histórica de origem, conforme as regras e filtros anteriores da Relação. A identificação de **local efetivo exclusivamente** depende de normalizar os dados legados; ela deve ser discutida junto ao modelo de ciclos históricos.
- Se uma consulta de contagem falhar, o Painel mostra **—** para o foco selecionado; não baixa os documentos da divisão como alternativa só para exibir os números. A Relação pode exigir um índice indicado pelo Firestore caso o projeto ainda não tenha usado essa combinação de filtros.
- Para Conferente com mais de dez divisões, selecionar **Todas** preserva o Painel com **—** e a Relação paginada; uma divisão isolada passa a usar agregações.

## Publicação e validação

- Esta parte não modifica regras do Firestore/Storage, dados, coleções, índices por definição, ou configurações de autenticação. Manter as regras já publicadas da v1.12.2.
- Publique o pacote público completo e aceite **ATUALIZAR AGORA** no app instalado. O service worker usa cache `v1.13.0`.
- Testar login de Conferente com uma, várias e mais de dez divisões; selecionar cada divisão e depois **Todas**. Na primeira entrada de um Conferente com várias divisões, verificar que Painel/Relação não carregam patrimônios até escolher.
- Testar Gestor e Administrador em **Todas** e em uma divisão, com Fila sempre global. Testar pendências com destino na divisão selecionada e sem duplicidade na contagem.
- Testar troca rápida de foco durante o carregamento, filtros de status/plaqueta, botão **Carregar mais 50**, navegação Painel ↔ Relação e atualização do PWA.
- Conferir no Console do Firestore se alguma contagem filtrada exige índice e verificar as leituras reais. A redução total de consumo depende do uso e dos índices examinados; nenhuma economia fixa foi presumida.

## Decisões posteriores da Sprint 1.3

- **1.3B — Usuários:** substituir remoção por desativação e reativação, preservando o documento e histórico. Fazer a alteração de credencial/acesso em backend confiável.
- **1.3C — Inventários:** definir encerramento, fotografia histórica consultável e início de novo ciclo antes de alterar o botão atual de reinício.
- **1.3D — Notificações:** definir eventos, destinatários e consentimento após as operações administrativas.
