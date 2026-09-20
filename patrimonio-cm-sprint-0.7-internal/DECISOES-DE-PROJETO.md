# CM APP — decisões e próximos passos

## Identidade do produto

- O nome genérico da aplicação no navegador passa a ser `CM APP`.
- `Patrimônio` continua sendo o módulo atual e pode conservar sua identificação dentro da interface.
- O favicon foi iniciado nesta sprint. Manifesto, ícones instaláveis e service worker ficam para uma etapa futura de PWA.
- Quando o PWA for implementado, usar modo instalado `standalone` para ocultar a interface de navegação do navegador e aproximar a experiência visual de um aplicativo. Em uma aba comum, a barra continua sob controle do navegador.

## Perfil do usuário e credenciais

- Adicionar foto de perfil circular ao lado do nome no Painel, junto do perfil e da abrangência/divisões de atuação.
- Permitir que cada usuário autenticado altere a própria senha, com reautenticação quando exigida pelo Firebase.
- Adicionar, exclusivamente para o Administrador, uma ação na lista de usuários para enviar ao e-mail cadastrado o fluxo de redefinição de senha.
- Na mesma etapa, configurar e revisar no Firebase o modelo do e-mail de redefinição, nome do remetente, domínio/link de ação, identidade visual e textos em português.
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

## Relação e leituras

- A paginação de 50 documentos permanece como comportamento padrão.
- Depois de o usuário carregar todas as páginas, a base completa é preservada na sessão e os filtros passam a ser locais.
- Não será criado botão “Carregar tudo”. A paginação permanece como mecanismo oficial de controle de leituras, tráfego e memória.
- A partir da Sprint 0.6, `Atualizar dados da relação` fica separado das exportações e disponível também para Conferentes. Exportações permanecem restritas a Administrador e Gestor.

## Validação de movimentações

- Uma mudança de localização registrada por Administrador ou Gestor é efetivada imediatamente, sem gerar pendência na Fila, pois esses perfis exercem a validação patrimonial.
- O Conferente continua gerando pendência quando informa localização diferente da divisão de origem/responsabilidade.
- A atualização gerencial deve preservar a divisão histórica de origem, atualizar apenas a localização/responsabilidade atual e acrescentar o registro correspondente ao histórico.
- A detecção de mudança compara o destino informado com `localizacaoAtual` quando ela existir; `divisaoOrigem` permanece como referência histórica.
- Ao rejeitar uma transferência, manter `localizacaoAtual`, limpar `divisaoDestinoSugerida` e registrar a decisão no histórico.
- Ao aprovar, promover o destino sugerido para `localizacaoAtual`, limpar a sugestão e registrar a decisão no histórico.
- O modal apresenta “Local sugerido” somente enquanto a transferência estiver pendente; nos demais estados, apresenta separadamente o local efetivo.

## Câmera e leitura

- Reservar uma sprint específica para melhorar o uso da câmera e a experiência de leitura de etiquetas.
- Avaliar estabilidade de inicialização, seleção de câmera, foco, zoom, iluminação/lanterna quando disponível, orientação, permissões, feedback de leitura e recuperação após pausa ou erro.
- Manter digitação manual e OCR como alternativas quando a leitura óptica não for suficiente.

## Layout responsivo

- Será realizada uma sprint de UX/layout para todo o app seguindo abordagem mobile-first, com adaptação responsiva e melhor aproveitamento do espaço em desktop.
- Em Administração, revisar o estado inicial de `GESTÃO DE CICLO E INVENTÁRIO`, hoje recolhido, e avaliar persistência da preferência do usuário.
- Na Fila, agrupar pendências por divisão em ordem alfabética.
- Para esses agrupamentos, usar preferencialmente os elementos semânticos nativos `<details>` e `<summary>`, com estilos, foco visível e estados acessíveis.
- Adicionar um botão `X` nas barras de pesquisa para limpar imediatamente o termo e restaurar a listagem correspondente.

## Métricas do Firestore

- A atividade local rastreada permanece durante o cronograma de refatoração até a versão 2.0.
- Na versão 2.0, decidir entre remover o painel ou restringi-lo ao Administrador.
- O Console/relatório de faturamento do Firebase continua sendo a referência; o contador local é diagnóstico parcial da sessão.

## Repositório e publicação

- O pacote público não inclui regras, decisões, notas de sprint ou instruções operacionais.
- Esses documentos permanecem como documentação interna, fora do pacote de deploy.
- A segurança não depende de ocultar a configuração web do Firebase ou as regras; depende de regras publicadas corretamente, autenticação e negação por padrão.
