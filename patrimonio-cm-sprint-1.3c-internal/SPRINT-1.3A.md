# Sprint 1.3A — Divisão em foco (v1.13.2)

## Revisão v1.13.2 — transferência aprovada entre divisões

- Após a aprovação, o local atual define a divisão do item no Painel e na Relação. A divisão de origem permanece no detalhe e no histórico, sem conceder uma segunda presença visual. Antes da aprovação, origem e destino sugerido continuam vendo a transferência pendente; uma rejeição mantém o item na origem.
- Documentos antigos sem `localizacaoAtual` continuam usando `divisaoOrigem` ou `divisao`. Uma conferência posterior no destino não faz o item voltar à origem.
- A Relação filtra os resultados durante a paginação e preenche a página com até 50 itens visíveis, inclusive quando há muitos itens transferidos que ainda correspondem às consultas por origem histórica. O reinício de divisão também considera apenas os itens visíveis nela.
- No Painel com divisão em foco, as contagens do Firestore são corrigidas com leituras dos itens transferidos para fora. Na visão **Todas** do Conferente com até dez divisões, a mesma correção elimina itens que saíram de todas as divisões atribuídas. As consultas adicionais selecionam apenas itens com `localizacaoAtual` preenchido e diferente da divisão histórica; não fazem uma leitura integral dos itens da divisão.
- Se as consultas adicionais necessitarem de índices compostos, o Firestore exibirá o link para criá-los. Enquanto a contagem não estiver disponível, o Painel mostra **—**, e a Relação continua consultável. Verificar as consultas no projeto real antes da publicação.
- A atualização do PWA usa o shell `v1.13.2`. Não há migração nem alteração nas regras do Firebase.

## Revisão v1.13.1 — cores do Painel

- O card **Pendentes** agora usa vermelho, e **Aguardando aprovação** usa âmbar, acompanhando as etiquetas e contornos dos itens na Relação.
- Nenhuma consulta, permissão ou regra do Firebase foi alterada. A nova versão do shell permite que o PWA instalado apresente **ATUALIZAR AGORA**.

## Alcance

- Base: CM APP v1.12.5. Esta primeira parte da Sprint 1.3 trata somente da seleção de escopo visual no Painel e na Relação.
- Gestor e Administrador conservam acesso global e iniciam em **Todas as divisões permitidas**. Podem selecionar qualquer divisão do catálogo para visualizar seus números e itens.
- Conferente com uma divisão inicia nela. Com várias, escolhe a divisão antes de consultar Painel ou Relação; pode optar explicitamente por **Todas as divisões permitidas**. A escolha fica na sessão do dispositivo para o mesmo UID.
- A barra aparece acima do Painel e da Relação, inclusive em telas pequenas. O filtro antigo de divisão na Relação foi substituído por essa única escolha compartilhada.
- O escopo não altera direitos de leitura ou gravação nem o local escolhido na tela de Leitura. A Fila de aprovação continua global para perfis validadores, com contador global independente do foco do Painel.
- A Relação mantém páginas de até 50 e reinicia cursores/caches quando muda o foco. Respostas de consultas anteriores à mudança não substituem a divisão atual.
- No Painel filtrado, as agregações incluem vínculos históricos para abranger documentos antigos. A revisão v1.13.2 desconta itens movidos para outra divisão, mantendo a divisão efetiva como referência.
- Se uma consulta de contagem falhar, o Painel mostra **—** para o foco selecionado; não baixa os documentos da divisão como alternativa só para exibir os números. A Relação pode exigir um índice indicado pelo Firestore caso o projeto ainda não tenha usado essa combinação de filtros.
- Para Conferente com mais de dez divisões, selecionar **Todas** preserva o Painel com **—** e a Relação paginada; uma divisão isolada passa a usar agregações.

## Publicação e validação

- Esta parte não modifica regras do Firestore/Storage, dados, coleções, índices por definição, ou configurações de autenticação. Manter as regras já publicadas da v1.12.2.
- Publique o pacote público completo e aceite **ATUALIZAR AGORA** no app instalado. O service worker usa cache `v1.13.2`.
- Com uma transferência aprovada de A para B, verifique que só B mostra o item no Painel e na Relação. Repita após nova conferência em B; confirme que o histórico ainda registra A. Antes da aprovação, confira a pendência em A e B; após rejeição, apenas em A. Teste também a última página e itens legados sem `localizacaoAtual`.
- Testar login de Conferente com uma, várias e mais de dez divisões; selecionar cada divisão e depois **Todas**. Na primeira entrada de um Conferente com várias divisões, verificar que Painel/Relação não carregam patrimônios até escolher.
- Testar Gestor e Administrador em **Todas** e em uma divisão, com Fila sempre global. Testar pendências com destino na divisão selecionada e sem duplicidade na contagem.
- Testar troca rápida de foco durante o carregamento, filtros de status/plaqueta, botão **Carregar mais 50**, navegação Painel ↔ Relação e atualização do PWA.
- Conferir no Console do Firestore se alguma contagem filtrada exige índice e verificar as leituras reais. A redução total de consumo depende do uso e dos índices examinados; nenhuma economia fixa foi presumida.

## Decisões posteriores da Sprint 1.3

- **1.3B — Usuários:** substituir remoção por desativação e reativação, preservando o documento e histórico. Fazer a alteração de credencial/acesso em backend confiável.
- **1.3C — Inventários:** definir encerramento, fotografia histórica consultável e início de novo ciclo antes de alterar o botão atual de reinício.
- **1.3D — Notificações:** definir eventos, destinatários e consentimento após as operações administrativas.
