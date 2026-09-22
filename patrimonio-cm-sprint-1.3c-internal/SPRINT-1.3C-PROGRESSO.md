# Sprint 1.3C — Progresso por divisão no inventário atual (v1.13.3)

## O que foi implementado

- A aba **Inventários** reúne uma lista de divisões com barra e percentual de progresso, quantidades de localizados, pendentes e aguardando aprovação, além do atalho **Ver na Relação**.
- Conferentes podem abrir a aba para consultar apenas suas divisões atribuídas. As ações de reinício continuam ocultas e bloqueadas para esse perfil. Gestores e Administradores visualizam as divisões do catálogo e mantêm as ações administrativas atuais.
- O percentual usa **localizados / itens efetivamente na divisão**. Transferências aguardando aprovação permanecem no local efetivo de origem e contam como aguardando nessa divisão; para o destino, aparecem como **entrada aguardando aprovação** à parte e não entram no percentual antes da decisão. Após a aprovação, o local efetivo passa a ser o destino. A Relação continua permitindo acompanhar a pendência em origem e destino.
- Os itens legados sem `localizacaoAtual` usam `divisaoOrigem` ou `divisao` como local efetivo. Itens já transferidos não são somados novamente à origem histórica.
- A lista é consultada somente ao abrir a aba, com até duas divisões em paralelo. Cada divisão usa agregações do Firestore e busca apenas documentos relevantes para ajustar transferências históricas e entradas pendentes. Resultados ficam em memória por até dois minutos. **Atualizar progresso** força nova consulta. Reiniciar uma divisão ou o inventário geral atualiza a lista imediatamente.
- Se uma divisão falhar por erro de consulta ou índice, seu card indica **Contagem indisponível**, sem exibir um percentual incorreto. Outros cards continuam carregando.
- O atalho para a Relação seleciona a divisão para o usuário e limpa os filtros de plaqueta e status. A escolha permanece na sessão, como a seleção feita no Painel.

## Publicação

- Publique o pacote público completo v1.13.3 e aceite **ATUALIZAR AGORA** no PWA. O shell do service worker passa a `v1.13.3`.
- Não há mudança nas regras do Firestore ou Storage, coleção adicional nem gravação de histórico. Os dois índices compostos da v1.13.2, `divisaoOrigem + localizacaoAtual` e `divisao + localizacaoAtual`, devem estar ativos. Caso o Firestore peça índice para `statusTransferencia + divisaoDestinoSugerida`, use o link indicado pelo erro e aguarde a ativação antes de testar a contagem de entrada.

## Verificação no projeto

1. Entre como Conferente com uma divisão e depois com várias. Confira que Inventários está disponível, mostra somente as divisões atribuídas e não exibe reinício.
2. Entre como Gestor ou Administrador. Confira todas as divisões, atualização manual e reinício com recálculo da barra.
3. Use um item pendente de aprovação da divisão A para B: em A ele conta como aguardando; em B aparece como entrada fora do total e do percentual. Após aprovação, confira remoção em A e presença em B. Após rejeição, confira somente A.
4. Use **Ver na Relação**, volte à aba e confirme a divisão em foco e o resultado sem filtros anteriores. Teste divisão sem itens, falha isolada de consulta e recarregamento do PWA.

## Próxima parte

Esta versão acompanha apenas o inventário **atual**. A definição de encerramento, fotografia do resultado, identificação do ciclo e histórico consultável precede qualquer alteração no fluxo de reinício para ciclos históricos.
