# Sprint 1.2 — fundação PWA

## Identificação

- Sprint: `1.2`
- Aplicação: `v1.12.5` (revisões pontuais da `v1.12.0`)
- Base: Sprint 1.1, revisão `v1.11.2`

## Objetivo

Formalizar o CM APP como Progressive Web App, controlando identidade, instalação, funcionamento em janela própria, disponibilidade do shell, estado de conexão e ciclo de atualização. A sprint não transforma as operações patrimoniais em operações offline.

## Revisão v1.12.1 — aprovação de toda transferência

- Leitura por Conferente, Gestor ou Administrador que informa outra divisão cria `statusTransferencia: 'pendente'`, guarda o destino sugerido e preserva `localizacaoAtual`.
- Administrador e Gestor podem aprovar ou rejeitar a pendência na Fila. A aprovação efetiva o novo local; a rejeição mantém o anterior.
- Uma leitura na localização efetiva segue como conferência normal, sem pendência.
- Patrimônios com transferência pendente não aceitam outra leitura nem reinício do inventário antes da decisão. Reinícios em lote ignoram esses itens e informam a quantidade ignorada.
- As regras do Firestore passam a impor essas transições também em gravações feitas fora do app. **Publicar o arquivo interno `firestore.rules` antes de disponibilizar `v1.12.1`.**

## Revisão v1.12.2 — situação e visibilidade da pendência

- Na Relação, uma transferência pendente aparece com o status `AGUARDANDO APROVAÇÃO` e mostra o destino sugerido sem substituir o local atual. Ela não entra na contagem de itens localizados nos agrupamentos nem no filtro `Localizados`.
- O filtro `Aguardando aprovação` foi incluído na Relação. O CSV também reflete esse estado.
- O Conferente vê o card `Aguardando aprovação` no Painel com transferências de suas divisões atuais/de origem ou com destino sugerido em suas divisões. Ao tocar, abre a Relação filtrada; a Fila e as decisões continuam restritas a Gestor e Administrador.
- A regra do Firestore concede leitura de patrimônios pendentes destinados a uma das divisões atribuídas ao Conferente, sem permitir que ele aprove ou rejeite. **Publique o `firestore.rules` atualizado antes de disponibilizar `v1.12.2`.**
- Uma pendência visível pela origem e pelo destino conta apenas uma vez no Painel do Conferente.

## Revisão v1.12.3 — controle de leituras

- O Painel do Conferente com 8 a 10 divisões mantém contagens por agregação; deixa de carregar toda a sua base por causa do limite de 30 alternativas por consulta.
- Para até três divisões, as pendências de entrada são contadas com duas agregações (total de destinos e sobreposição com a base). Se a consulta não estiver disponível, a alternativa lê somente as pendências de entrada.
- Na Relação de Conferentes com 8 a 10 divisões, a consulta principal continua paginada em 50. Uma segunda consulta busca as pendências destinadas ao setor, descarta itens já cobertos pela consulta principal e não se repete ao usar `Carregar mais`.
- O limite de dez divisões foi corrigido na revisão `v1.12.4`; a base completa deixou de ser necessária para abrir a Relação.
- A versão `v1.12.3` não altera novamente as regras; as regras internas da `v1.12.2` continuam obrigatórias.

## Revisão v1.12.4 — paginação para Conferentes com muitas divisões

- Com mais de dez divisões, a Relação consulta os patrimônios em lotes de até sete divisões, intercala os resultados por ID, elimina repetições entre lotes e apresenta até 50 itens por clique em `Carregar mais`.
- Cada consulta ao Firestore recebe um limite; não há mais chamada para carregar todos os mais de 3.000 patrimônios só por abrir a Relação. Consultas de lotes podem pré-carregar um pequeno conjunto além dos 50 itens exibidos; os itens ficam em memória para a próxima página.
- A contagem exata do total não é exibida antes de percorrer todos os lotes. Nesse caso a área de paginação informa quantos itens foram carregados e se há mais disponíveis.
- No Painel, para esse perfil, as contagens exatas são mostradas como `—` e o progresso orienta a usar a Relação paginada. Não se lê a base completa em segundo plano só para calcular os quatro cards.
- Permanece necessária a regra do Firestore da `v1.12.2`; `v1.12.4` não altera `firestore.rules` nem `storage.rules`.

## Revisão v1.12.5 — apresentação e origem da conferência

- Na Relação, o contorno dos cards acompanha a situação: verde para Localizado, âmbar para Aguardando aprovação e vermelho para Pendente. O realce ao passar o mouse usa a mesma cor.
- Na Fila, a observação da conferência recebe bloco próprio destacado e permanece visível mesmo quando não foi informada.
- Cada nova conferência grava `metodoLocalizacao` no respectivo evento do array `historico`: `codigo_barras`, `ocr` ou `digitacao`, junto do responsável já registrado. Os detalhes da Leitura e da Relação exibem o nome do método. Eventos anteriores à revisão exibem `Não registrado`.
- Digitar ou alterar manualmente a plaqueta, usar as sugestões ou o botão Buscar registra `digitacao`; capturas da câmera preservam código de barras ou OCR. O campo é reiniciado ao limpar o formulário.
- A revisão não cria consultas ou coleções e não altera as regras do Firestore/Storage. O campo novo fica dentro de `historico`, já autorizado para acréscimo pelas regras existentes.

## Entregas

### Instalação e identidade

- `manifest.webmanifest` com nome `CM APP`, escopo próprio e `display: standalone`.
- Ícones PNG de 192 × 192 e 512 × 512.
- Ícone `maskable` com área segura para recortes do Android.
- `apple-touch-icon` e metadados básicos para instalação em dispositivos Apple.
- Opção `INSTALAR CM APP` no menu e na página de perfil quando o navegador disponibiliza o fluxo nativo.
- Detecção de execução instalada para não oferecer uma segunda instalação.
- Uma recusa não gera nova oferta interna durante sete dias; o menu do navegador permanece disponível.

### Service worker e cache

- Cache versionado do shell local e das dependências estáticas necessárias para renderização.
- Navegações e arquivos de código usam prioridade para a rede, com cache como alternativa.
- O service worker ignora requisições que não sejam `GET`.
- Chamadas dinâmicas do Firestore, Authentication e Storage não são armazenadas pelo cache do app.
- `offline.html` orienta o usuário quando nem mesmo o shell principal estiver disponível.

### Conectividade

- Banner persistente informa quando o dispositivo está offline.
- A tela de login também informa que a conexão é necessária.
- Ao recuperar a conexão, um toast confirma que as consultas podem ser retomadas.
- Nenhuma alteração patrimonial é enfileirada ou gravada localmente para sincronização posterior.

### Atualizações

- Uma nova versão instalada pelo service worker aguarda decisão do usuário.
- O app exibe toast persistente com a ação `ATUALIZAR AGORA`.
- Somente após essa ação o novo worker assume o controle e a página é recarregada.
- Caches `cmapp-*` de versões anteriores são removidos na ativação.

## Decisão sobre push notifications

Push notifications não foram ativadas nesta sprint. A implementação exige tokens por dispositivo, consentimento, regras, limpeza dos tokens e emissão por backend confiável. Esse trabalho permanece associado à Sprint 1.3.

Eventos candidatos já identificados:

- nova transferência aguardando aprovação;
- transferência aprovada ou rejeitada;
- patrimônio não cadastrado encontrado em campo;
- abertura, encerramento ou alteração de um ciclo de inventário;
- comunicação administrativa relevante.

O aplicativo não solicita permissão de notificação nesta versão.

## Firebase e publicação

- As revisões `v1.12.1` e `v1.12.2` alteram as regras do Firestore: publique o arquivo interno `firestore.rules` atualizado antes do app. As regras de Storage não mudam.
- Não há nova coleção, documento, índice ou Cloud Function.
- Não é necessário habilitar Firebase Cloud Messaging.
- A hospedagem deve usar HTTPS e publicar `manifest.webmanifest`, `service-worker.js`, `offline.html`, `js/pwa.js` e os novos ícones.
- O arquivo `service-worker.js` não deve receber cache imutável de longa duração no servidor.

## Arquivos principais

- `manifest.webmanifest`: identidade, escopo, modo de exibição e ícones.
- `service-worker.js`: cache do shell e ciclo de atualização.
- `offline.html`: orientação quando o shell não puder ser carregado.
- `js/pwa.js`: instalação, conectividade e atualização.
- `js/ui/feedback.js`: ação opcional dentro de toast.
- `assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` e `apple-touch-icon.png`.
- `tests/pwa.test.mjs`: regressões específicas da Sprint 1.2.
- `js/core/movimentacao.js` e `tests/movimentacao.test.mjs`: fluxo de solicitação e resolução de transferências.
- `js/core/relacao.js` e `tests/relacao.test.mjs`: situação do patrimônio, alcance do Conferente e contagem das pendências.
- `js/core/paginacao.js` e `tests/paginacao.test.mjs`: intercalação ordenada de páginas por divisões e eliminação de duplicidades.
- `firestore.rules` (somente pacote interno): bloqueio de mudanças diretas na localização e de reinício de itens com pendência.

## Testes automatizados

Executar na pasta pública:

```bash
node --test tests/*.test.mjs
```

A suíte cobre câmera, estrutura, navegação, feedback, perfil, credenciais, PWA e movimentação. Os testes de código não substituem o teste das regras publicadas no Firebase.

## Roteiro de teste manual

1. Publicar todos os arquivos em HTTPS.
2. No Android, remover o atalho ou instalação anterior do CM APP antes do primeiro teste.
3. Abrir o app no Chrome, interagir com a página e verificar a opção de instalação no navegador ou em `Meu perfil`.
4. Instalar e confirmar nome `CM APP`, ícone próprio e abertura sem a barra de endereço.
5. Abrir `Meu perfil` no app instalado e confirmar a mensagem de que ele está em modo de aplicativo.
6. Testar câmera, OCR, leitura manual, botão voltar, sidebar e menu do perfil no modo instalado.
7. Com uma sessão autenticada, desligar a internet e confirmar o banner de indisponibilidade.
8. Reabrir o app offline e confirmar que o shell pode abrir, sem permitir consultas ou alterações no servidor.
9. Restaurar a conexão e confirmar o toast de conexão restabelecida.
10. Abrir em uma aba comum e confirmar que a aplicação continua funcionando normalmente.
11. Testar também em desktop; a instalação deve ser opcional e a responsividade deve ser preservada.
12. Em uma publicação futura, confirmar que uma nova versão exibe `ATUALIZAR AGORA` antes de recarregar.
13. Após publicar as novas regras, ler um patrimônio em outra divisão como Gestor, Administrador e Conferente: verificar pendência na Fila, local atual anterior e destino sugerido nos detalhes.
14. Aprovar uma pendência na Fila e confirmar a mudança do local efetivo; rejeitar outra e confirmar que o local anterior permanece.
15. Ler um bem na própria localização efetiva e confirmar que a conferência é concluída sem pendência.
16. Tentar ler e reiniciar um patrimônio com transferência pendente: a leitura individual e o reinício individual devem ser bloqueados; o reinício em lote deve informar os itens ignorados.
17. Na instalação antiga, aceitar `ATUALIZAR AGORA` para atualizar o shell à `v1.12.5` antes desses testes.
18. Testar a `v1.12.2` com um item localizado em `SALA VIP` e transferência pendente para `DA`: a Relação mostra `AGUARDANDO APROVAÇÃO`, o local atual `SALA VIP` e o sugerido `DA`; o filtro `Localizados` não inclui o item.
19. Entrar como Conferente atribuído apenas à `DA`: o card `Aguardando aprovação` inclui o item, e tocá-lo abre a Relação filtrada. O Conferente não vê a Fila nem pode tomar a decisão.
20. Entrar como Conferente da `SALA VIP` e confirmar que o mesmo item aparece no card. Um Conferente com ambas as divisões deve contá-lo apenas uma vez.
21. Aprovar ou rejeitar a pendência e conferir a atualização do card, dos filtros da Relação e do CSV após atualizar os dados.
22. Se o Firebase indicar que falta um índice para a consulta de pendências pelo destino, criar o índice indicado pelo link fornecido pelo Console e aguardar sua ativação antes de repetir os testes.
23. Com um Conferente vinculado a 8–10 divisões, abrir o Painel e depois a Relação; verificar no Console que a Relação continua consultando páginas e que o Painel não baixa todos os patrimônios.
24. Com Conferente atribuído a todas as divisões (mais de dez), confirmar que o Painel mostra `—` nos totais, abrir a Relação e verificar 50 itens, botão `Carregar mais 50` e avanço por páginas sem transferência dos milhares de documentos em uma única abertura.
25. Testar filtros por status, divisão e plaqueta com esse Conferente e verificar que a contagem de itens exibidos não duplica um patrimônio ligado a mais de uma das suas divisões.
26. Conferir as três cores de contorno na Relação e o destaque da observação na Fila, inclusive quando estiver vazia.
27. Registrar uma conferência por código de barras, outra por OCR e outra por digitação; conferir o método e o responsável nos detalhes da Leitura e na Linha do Tempo da Relação. Em um histórico anterior, confirmar `Não registrado`.

## Próximas sprints

- Sprint 1.3: operações administrativas sensíveis em backend confiável e arquitetura de push notifications.
- Sprint 1.4: observabilidade com fontes oficiais.
- Sprint 2.0: consolidação final da refatoração.
