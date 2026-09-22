# CM APP — decisões e próximos passos

## Identidade do produto

- O nome genérico da aplicação no navegador passa a ser `CM APP`.
- `Patrimônio` continua sendo o módulo atual e pode conservar sua identificação dentro da interface.
- O favicon foi iniciado na Sprint 1.0; manifesto, ícones instaláveis e service worker foram concluídos na Sprint 1.2.
- O modo instalado usa `standalone` para ocultar a interface de navegação do navegador e aproximar a experiência de um aplicativo. Em uma aba comum, a barra continua sob controle do navegador.

## PWA, instalação e funcionamento offline

- A instalação simplificada observada no Android antes da Sprint 1.2 não substituía o controle formal de identidade, escopo, ícones e atualização.
- `manifest.webmanifest` identifica o produto como `CM APP` e mantém `Patrimônio` como módulo atual.
- O service worker armazena somente o shell e dependências estáticas; dados patrimoniais, credenciais, fotos e respostas dinâmicas do Firebase não integram o cache do app.
- O app pode abrir sua interface sem conexão, mas consultas, aprovações e alterações continuam online.
- Não haverá fila local de alterações nem sincronização posterior nesta etapa, evitando conflitos e registros patrimoniais desatualizados.
- Uma nova versão aguarda a ação `ATUALIZAR AGORA`; o app não recarrega durante uma conferência sem decisão do usuário.
- A opção interna de instalação é exibida somente quando o navegador oferece `beforeinstallprompt` e desaparece no modo instalado.

## Perfil do usuário e credenciais

- A Sprint 1.1 concentra nome, e-mail, perfil, abrangência, foto e credenciais na página `Meu perfil`; o Painel não repete essas informações.
- A foto circular aparece na barra superior, na sidebar e na tela de perfil. Sem foto ou sem Storage, o app mantém as iniciais.
- A imagem é recortada no centro, reduzida para 512 × 512 e gravada como um único objeto no caminho do próprio UID.
- O Cloud Storage exige o plano Blaze; a ausência do serviço não bloqueia as demais funções do perfil.
- Cada usuário autenticado pode alterar a própria senha após informar a senha atual e passar pela reautenticação do Firebase.
- Exclusivamente na interface do Administrador, a lista de usuários oferece envio do fluxo oficial de redefinição para o e-mail cadastrado.
- Futuramente, Administradores e Gestores poderão visualizar a foto ampliada e os dados principais ao abrir o card de um usuário na Gestão de Usuários.
- O e-mail usa português do Brasil e deve receber identidade `CM APP` no modelo do Firebase. Manipulador e domínio próprios ficam vinculados à evolução do PWA/backend.
- Não armazenar senhas no documento `usuarios`; credenciais e redefinições continuam sob responsabilidade do Firebase Authentication.

## Catálogo de divisões

- A divisão temporária `CM/DIVISÃOdeTESTE` foi removida manualmente do Firestore.
- `divisoes` permanece como catálogo somente de leitura no app.
- Um CRUD completo só deverá ser retomado junto de regras para criação, renomeação, desativação, auditoria e tratamento de vínculos existentes.

## Papéis e divisões

- Administrador e Gestor têm abrangência global no módulo de patrimônio.
- `divisoesAtribuidas` tem significado somente para Conferentes.
- Gestor pode editar apenas o próprio nome; não pode alterar o próprio perfil ou divisões.
- A normalização dos Gestores antigos foi concluída pelo Administrador; os registros agora usam `divisoesAtribuidas: []`.
- Na Sprint 1.3A, Gestor e Administrador podem focar uma divisão no Painel e na Relação, preservando acesso geral. Conferentes com várias divisões escolhem o foco antes das consultas. Isso é preferência de visualização e não muda permissões. A Fila de aprovação permanece global.
- Para a Sprint 1.3B, o comando de remoção de usuário deverá virar desativação reversível, preservando a identidade vinculada aos eventos históricos.
- Para a Sprint 1.3C, encerrar um inventário e registrar seu estado histórico deverá ser uma operação separada do reinício do próximo ciclo.

## Relação e leituras

- A paginação de 50 documentos permanece como comportamento padrão.
- Depois de o usuário carregar todas as páginas, a base completa é preservada na sessão e os filtros passam a ser locais.
- Não será criado botão “Carregar tudo”. A paginação permanece como mecanismo oficial de controle de leituras, tráfego e memória.
- A partir da Sprint 0.6, `Atualizar dados da relação` fica separado das exportações e disponível também para Conferentes. Exportações permanecem restritas a Administrador e Gestor.

## Validação de movimentações

- A partir de `v1.12.1`, toda leitura que altera a localização efetiva gera pendência na Fila, inclusive se registrada por Administrador ou Gestor. Nenhum perfil efetiva a transferência durante a leitura.
- Administrador e Gestor resolvem a pendência na Fila. Somente a aprovação atualiza `localizacaoAtual`; a rejeição mantém o local anterior.
- Uma leitura na localização já efetiva registra a conferência sem criar transferência. Enquanto houver transferência pendente, novas leituras e o reinício desse patrimônio ficam bloqueados até a decisão.
- Toda atualização preserva a divisão histórica de origem e acrescenta um registro ao histórico.
- A detecção de mudança compara o destino informado com `localizacaoAtual` quando ela existir; `divisaoOrigem` permanece como referência histórica.
- Ao rejeitar uma transferência, manter `localizacaoAtual`, limpar `divisaoDestinoSugerida` e registrar a decisão no histórico.
- Ao aprovar, promover o destino sugerido para `localizacaoAtual`, limpar a sugestão e registrar a decisão no histórico.
- O modal apresenta “Local sugerido” somente enquanto a transferência estiver pendente; nos demais estados, apresenta separadamente o local efetivo.
- Na revisão `v1.12.2`, a Relação e o CSV identificam separadamente `Aguardando aprovação`; o Painel do Conferente conta uma pendência quando a divisão atual/de origem ou o destino sugerido pertence à sua alçada. O card abre a Relação filtrada, sem abrir a Fila de decisões.

## Câmera e leitura

- A Sprint 0.8 implementa inicialização controlada, seleção e memorização da câmera, preferência pela câmera traseira, foco contínuo, zoom físico quando suportado e aproximação visual como alternativa.
- Lanterna, foco e zoom são exibidos conforme as capacidades informadas pelo dispositivo; a ausência de um recurso não bloqueia a leitura.
- A leitura bem-sucedida pausa o scanner para evitar duplicidades e oferece ação explícita para ler outra plaqueta.
- A câmera é liberada ao trocar de aba, sair da conta ou colocar o app em segundo plano, com retomada ao voltar quando apropriado.
- Mudanças de orientação reinicializam o enquadramento do scanner.
- O OCR usa o recorte central em escala de cinza e com contraste ampliado, mostra progresso e procura candidatos numéricos plausíveis.
- Manter digitação manual e OCR como alternativas quando a leitura óptica não for suficiente.
- Na Sprint 0.9, a rolagem até o visor acontece somente quando o usuário solicita `Ligar Câmera`; reinicializações técnicas não deslocam a tela.
- Após código de barras ou OCR reconhecer uma plaqueta, o scanner pausa, preserva um recorte estático ampliado da região central e rola até o painel de resultado posicionado imediatamente antes do formulário.
- O recorte mantém pouca imagem além da região anteriormente delimitada pela moldura azul. Não há número ou caixa desenhados sobre a imagem, pois a plaqueta já aparece no cabeçalho do resultado.
- O aviso laranja de câmera pausada permanece disponível para pausas manuais e processamento, mas é ocultado após o reconhecimento porque o painel de resultado já comunica esse estado.
- Depois de dez segundos sem resultado, o app oferece `Usar OCR`, `Digitar plaqueta` e `Continuar tentando`. A simples exibição dessa ajuda não interrompe o scanner.
- Ao escolher digitação manual, o scanner pausa para evitar que uma leitura automática substitua o que está sendo digitado; a retomada continua disponível.
- A orquestração de câmera, OCR, ciclo de vida, ajuda e apresentação do resultado reside em `js/controllers/camera.controller.js`; regras determinísticas permanecem em `js/core/camera.js`.
- A suíte pública em `tests/` pode ser executada com `node --test tests/*.test.mjs` e cobre regras da câmera, estrutura da integração e presença dos controles no HTML.

## Layout responsivo

- A Sprint 1.0 adota um shell mobile-first inspirado em painéis administrativos, sem incorporar o AdminLTE como dependência.
- No mobile, a navegação funciona como gaveta lateral acionada por hambúrguer; no desktop, a sidebar permanece visível, pode ser recolhida e memoriza essa preferência localmente.
- A barra superior concentra título, breadcrumbs e acesso ao perfil; a navegação exibe somente as opções autorizadas e identifica a tela ativa.
- O avatar usa foto real quando disponível e iniciais como fallback.
- A sidebar recolhida expande temporariamente por hover ou foco no desktop, sem alterar a preferência gravada pelo usuário.
- O botão voltar fecha primeiro camadas sobrepostas e depois percorre as telas visitadas; no Painel, sem camada aberta, mantém o comportamento normal de saída.
- Breadcrumbs permanecem informativos enquanto não houver hierarquia navegável. Futuras telas filhas poderão transformá-los em links.
- O conteúdo principal possui largura máxima e grades responsivas para aproveitar o desktop sem prejudicar a leitura.
- Na tela `Inventários`, as ações do ciclo atual iniciam visíveis.
- A Fila agrupa pendências por divisão em ordem alfabética usando `<details>` e `<summary>`; as plaquetas também são ordenadas dentro de cada grupo.
- Leitura, usuários e Relação possuem botão `X` para limpar a pesquisa e restaurar o estado correspondente.
- A partir da revisão `v1.11.2`, o grupo `Gestão` separa `Usuários` e `Inventários` em telas próprias, evitando misturar administração de acessos com o ciclo patrimonial.
- Continuar revisando a experiência em dispositivos reais durante as próximas sprints, mantendo mobile-first e suporte completo ao desktop.

## Inventários e histórico

- A tela `Inventários` concentra as ações do ciclo atual, acessíveis a Administradores e Gestores.
- A revisão `v1.11.2` apenas reserva visualmente o espaço para inventários históricos; não cria coleção, gravação ou migração de dados.
- Antes de implementar históricos, definir ciclo, período, responsáveis, estado, contagens, resultado, encerramento, reabertura, relatórios e política de retenção.
- A futura modelagem deve preservar os registros já existentes e receber regras específicas do Firestore antes de qualquer gravação em produção.

## Feedback e notificações

- As caixas nativas `alert()` e `confirm()` foram substituídas na Sprint 1.0 por toasts e diálogos internos, com estados acessíveis e linguagem mais clara.
- Toasts são usados para resultados, avisos e erros que não exigem decisão imediata.
- Toasts aparecem no topo, abaixo do header, para evitar conflito com controles do navegador e do PWA na parte inferior.
- Cada operação informa explicitamente o tipo semântico do toast. A classificação pelo texto existe somente como fallback.
- Ações destrutivas ou sensíveis usam diálogo de confirmação com ação principal explícita.
- Esses avisos existem enquanto o app está aberto e não são push notifications do sistema operacional.
- A Sprint 1.2 implementa o service worker, mas não solicita permissão de push.
- Push notifications ficam para a arquitetura da Sprint 1.3, pois exigem consentimento, tokens por dispositivo, regras e envio por backend confiável.

## Patrimônio não cadastrado

- Uma plaqueta não localizada apresenta estado persistente, preservando o toast apenas como aviso complementar.
- O usuário deve conferir o número e comunicar um Gestor ou Administrador quando a plaqueta estiver correta.
- O app não cadastra automaticamente um patrimônio sem descrição, origem, responsabilidade e validação.
- Futuramente será criada uma fila de ocorrências com plaqueta, usuário, data, localização, método de leitura, observação e status.
- A fila exigirá nova coleção, regras do Firestore e definição de resolução por Gestor ou Administrador.
- Imagens não serão enviadas ao Firebase Storage na primeira versão dessa funcionalidade; essa necessidade será reavaliada considerando custo, privacidade e retenção.

## Métricas do Firestore

- O painel e o rastreamento local de métricas foram removidos na Sprint 1.0.
- O Console/relatório de faturamento do Firebase é a fonte oficial de leituras, gravações e custos.
- Uma futura etapa de observabilidade deve consumir fontes confiáveis e não recriar estimativas locais de sessão como se fossem equivalentes ao faturamento.

## Cronograma preservado

- Sprint 1.1: perfil, foto, alteração da própria senha e redefinição de senha pelo Administrador concluídos em `v1.11.0`; falso feedback de erro corrigido em `v1.11.1`; gestão separada em `Usuários` e `Inventários` em `v1.11.2`.
- Sprint 1.2: PWA formal concluído em `v1.12.0`; `v1.12.1` exige aprovação para toda mudança de divisão, `v1.12.2` corrige a classificação e a visibilidade das pendências do Conferente, `v1.12.3` reduz leituras nas consultas para até dez divisões, `v1.12.4` mantém a Relação paginada também acima desse limite e `v1.12.5` destaca estados/observações e registra o método de conferência por evento histórico. Para mais de dez divisões, o Painel não calcula totais por leitura completa. As regras do Firestore foram revistas até `v1.12.2`. Push foi avaliado e adiado.
- Sprint 1.3: operações administrativas sensíveis em backend confiável e arquitetura de push notifications.
- Sprint 1.4: observabilidade com fontes oficiais.
- Sprint 2.0: consolidação final da refatoração.

## Repositório e publicação

- O pacote público não inclui regras do Firestore/Storage, decisões, notas de sprint ou instruções operacionais.
- Esses documentos permanecem como documentação interna, fora do pacote de deploy.
- A segurança não depende de ocultar a configuração web do Firebase ou as regras; depende de regras publicadas corretamente, autenticação e negação por padrão.
