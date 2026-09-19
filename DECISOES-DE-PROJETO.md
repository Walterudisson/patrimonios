# Patrimônio CM — decisões e próximos passos

## Catálogo de divisões

- Decisão atual: usar `divisoes` como catálogo somente de leitura no app.
- Motivo: a sincronização inicial já foi concluída; manter comandos de escrita incompletos aumenta o risco de inconsistência.
- Próxima etapa futura: implementar CRUD apenas com regras para criar, renomear, desativar e auditar divisões, incluindo o impacto sobre patrimônios e usuários vinculados.

## Layout responsivo

- Requisito registrado: realizar um redesenho responsivo completo do aplicativo para uso em desktop.
- Abrangência: todas as telas, não apenas Administração ou Catálogo de Divisões.
- Direção: melhorar aproveitamento de largura, hierarquia visual, densidade de informação, navegação, formulários, tabelas/listas e comportamento entre celular, tablet e desktop.
- Momento: sprint específica de UX/layout, depois das refatorações estruturais prioritárias, para evitar redesenhar componentes que ainda serão reorganizados.

## Métricas do Firestore

- O Console do Firebase é a referência para acompanhar o uso do projeto; em divergências de cobrança, prevalece o relatório de faturamento.
- O contador no app é um diagnóstico parcial da aba atual.
- Uma futura observabilidade mais precisa deverá registrar operações em backend ou telemetria própria, sem prometer equivalência com o faturamento do Firestore.

## Segurança e identidade

- O Firestore adota negação por padrão e autorização baseada no documento `usuarios/{uid}`.
- O cadastro público do primeiro Administrador não faz parte do cliente web.
- O Administrador inicial deve ser provisionado por processo controlado.
- A gestão definitiva de contas do Firebase Authentication deverá migrar para backend confiável com Admin SDK ou Cloud Functions.
- Custom Claims ficam previstas para uma futura sprint de autorização, sem armazenar nelas listas extensas de divisões.
