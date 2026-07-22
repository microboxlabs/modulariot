import type { DetailPageData } from "./DetailPage";

// Conteúdo em português das páginas de detalhe. Mesma forma que detail-content.ts (es).

export const detailPagesPt: Record<string, DetailPageData> = {
  "producto/ingesta-gps-core": {
    eyebrow: "Produto · Ingestão GPS Core",
    icon: "signal",
    graphic: "ingesta",
    title: "Cada sinal da sua frota, na sua nuvem, em milissegundos",
    subtitle:
      "A caixa base da ModularIoT. Recebe cada ping GPS, valor de sensor e evento do motorista —não importa o fornecedor do hardware— e entrega à sua própria infraestrutura em tempo real.",
    blocks: [
      {
        type: "split",
        kicker: "O que faz",
        title: "O pipeline sobre o qual tudo o mais roda",
        body:
          "A Ingestão GPS Core normaliza e transmite a telemetria bruta da sua frota para seus sistemas. É a fundação: sintomas, integrações e vídeo são construídos sobre este fluxo. Sem dependência de fornecedor e com os dados sempre sob seu controle.",
        bullets: [
          "API de último sinal por ativo (lastsignal)",
          "Rastreamento AVL em tempo real",
          "Captura de mudanças (CDC) para seus sistemas downstream",
          "Backbone de mensageria com Apache Pulsar",
          "Gravação direta no seu PostgreSQL / armazenamento",
        ],
      },
      {
        type: "grid",
        kicker: "Capacidades",
        title: "Ingestão pronta para produção",
        cards: [
          { icon: "signal", title: "Qualquer hardware", body: "Adaptadores universais para provedores GPS (Redd, Samtech, GAMA e mais). Você não troca seus dispositivos." },
          { icon: "bolt", title: "Latência < 56 ms", body: "Da leitura do sensor à sua aplicação, com processamento de stream de baixa latência." },
          { icon: "stack", title: "Alto volume", body: "Projetado para milhões de sinais por mês: 2.9M+ em operação real hoje, com margem para crescer." },
          { icon: "shield", title: "Seus dados, sua nuvem", body: "Os dados aterrissam na sua infraestrutura. Soberania completa, conformidade GDPR sem esforço." },
          { icon: "plug", title: "CDC integrado", body: "O Debezium captura mudanças e as propaga aos seus sistemas: sem polling, sem jobs batch." },
          { icon: "code", title: "APIs abertas", body: "REST e acesso direto ao banco de dados para construir o que precisar sobre o fluxo." },
        ],
      },
      {
        type: "steps",
        kicker: "Como funciona",
        title: "Do sinal ao seu banco de dados, em tempo real",
        subtitle: "Sem polling nem jobs em lote: cada sinal flui e aterrissa pronto para consultar.",
        steps: [
          { n: "01", title: "O sinal chega", body: "GPS, sensores e eventos de qualquer hardware entram de forma contínua, sem esperar." },
          { n: "02", title: "Processado na hora", body: "Cada sinal é normalizado e avaliado com latência mediana abaixo de 56 ms." },
          { n: "03", title: "Aterrissa na sua nuvem", body: "Os dados ficam no seu próprio banco: soberania completa, conformidade sem esforço." },
          { n: "04", title: "Consulte quando quiser", body: "Última posição e status de cada ativo por API aberta ou consulta direta ao banco." },
        ],
      },
    ],
  },

  "producto/sintomas-torre-control": {
    eyebrow: "Produto · Sintomas / Torre de Controle",
    icon: "radar",
    graphic: "sintomas",
    title: "Mais de 30 regras que transformam dados em decisões",
    subtitle:
      "Chega de dados brutos e alertas de ruído. Cada sinal é avaliado contra as regras da sua operação e, se algo desvia, um evento classificado por severidade é gerado, com responsável e rastreabilidade completa.",
    blocks: [
      {
        type: "split",
        kicker: "O que faz",
        title: "Ela interpreta, não apenas registra",
        body:
          "A diferença entre um GPS e a ModularIoT é a mesma que entre uma câmera de segurança e um guarda treinado. A torre de controle interpreta cada evento no seu contexto operacional: é zona de risco? há quanto tempo está ativo? quem deve atendê-lo?",
        bullets: [
          "Severidade e responsável atribuídos automaticamente",
          "Ciclo de vida do evento: abrir → tratar → fechar",
          "Exclusão inteligente de ruído: só o que exige ação",
          "Limites e zonas configurados para sua operação",
          "Rastreabilidade completa para auditorias",
        ],
      },
      {
        type: "grid",
        kicker: "Regras de detecção",
        title: "Uma regra para cada risco que importa para você",
        subtitle: "Mais de 30 regras ativas em produção, cada uma como microsserviço independente.",
        cards: [
          { icon: "radar", title: "Condução", body: "Excesso de velocidade por trecho, condução contínua sem descanso, movimento em horário não autorizado, motorista duplo." },
          { icon: "shield", title: "Segurança", body: "Botão de pânico (SOS), assistência na estrada, uso de EPI, homem-máquina, frenagem e curva bruscas, fadiga e sonolência." },
          { icon: "truck", title: "Carga e ativos", body: "Ausência e deficiência de amarração, superaquecimento do motor, Check Engine, bateria baixa, falha de carga." },
          { icon: "signal", title: "Zonas e rotas", body: "Cruzamento de área não permitida, parada em zona de risco, pernoite em zona não autorizada, desvio de ETA." },
        ],
      },
      {
        type: "steps",
        kicker: "Ciclo de vida",
        title: "O ciclo não termina em fechar: termina em reduzir",
        subtitle: "Fechar o ticket não resolve a causa. Por isso o ciclo adiciona mais um passo: reduzir a recorrência.",
        steps: [
          { n: "01", title: "O sintoma é detectado", body: "A regra avalia o sinal no contexto e gera um evento com severidade." },
          { n: "02", title: "Um responsável é atribuído", body: "O evento entra no painel da sua equipe operacional e é atribuído para gestão." },
          { n: "03", title: "É tratado", body: "O operador trata o evento com o contexto e a evidência necessários para agir." },
          { n: "04", title: "Fecha com rastreabilidade", body: "Fica registrado com timestamp, responsável e resolução. Nada se perde." },
          { n: "05", title: "A recorrência é reduzida", body: "O SuperProfile agrega o histórico por entidade e ataca a causa: menos eventos repetidos mês a mês, não apenas tickets fechados." },
        ],
      },
      {
        type: "linkgrid",
        kicker: "Ao vivo, com dados reais",
        title: "Explore sobre uma operação real",
        subtitle: "Os mesmos sintomas, rodando sobre dados de junho 2026 — não uma maquete.",
        links: [
          { title: "Torre de controle", body: "Os 36 sintomas, seu histórico e seus dashboards com dados reais.", href: "/torre" },
          { title: "SuperProfile", body: "O perfil vivo de cada transportadora e motorista: nível, risco e plano.", href: "/superprofile" },
          { title: "Canais de escalonamento", body: "O mesmo alerta em e-mail, WhatsApp, Teams, Webex e SMS.", href: "/canales" },
        ],
      },
    ],
  },

  "producto/integraciones": {
    eyebrow: "Produto · Integrações",
    icon: "plug",
    graphic: "integraciones",
    title: "Sua operação conectada ao que você já usa",
    subtitle:
      "Automação de fluxos, cofre de evidências documental, API gateway e webhooks. A ModularIoT não substitui seus sistemas: ela os conecta e potencializa.",
    blocks: [
      {
        type: "split",
        kicker: "O que faz",
        title: "Do evento à ação, automaticamente",
        body:
          "Quando um sintoma é detectado, vê-lo não basta: é preciso agir. As Integrações disparam o fluxo que você definiu —notificar, criar uma ordem de serviço, guardar evidência, avisar um sistema externo— sem intervenção manual.",
        bullets: [
          "Workflows e webhooks com n8n",
          "Cofre de evidências documental (gestor ECM)",
          "API gateway para expor e consumir serviços",
          "Servidor MCP para agentes de IA",
          "Automação de GAMA, RFID e processos sob medida",
        ],
      },
      {
        type: "grid",
        kicker: "Conectores",
        title: "Integre com seu stack real",
        cards: [
          { icon: "plug", title: "n8n", body: "Orquestre fluxos visuais: quando acontece X, faça Y. Sem escrever código de integração." },
          { icon: "doc", title: "Cofre de evidências", body: "Cada evento fica com sua documentação, pronta para fiscalizações e auditorias." },
          { icon: "code", title: "API Gateway", body: "Exponha seus serviços com segurança e consuma APIs de terceiros de um único ponto." },
          { icon: "stack", title: "Webhooks", body: "Notifique qualquer sistema externo em tempo real quando um evento relevante ocorre." },
          { icon: "bolt", title: "Servidor MCP", body: "Conecte agentes de IA à sua operação para consultas e ações assistidas." },
          { icon: "signal", title: "GAMA / RFID", body: "Ingestão de provedores e validação de etiquetas RFID via fluxos automatizados." },
        ],
      },
    ],
  },

  "producto/video-en-vivo": {
    eyebrow: "Produto · Vídeo ao Vivo / HLS",
    icon: "video",
    graphic: "video",
    title: "Contexto visual para cada evento que você detecta",
    subtitle:
      "Streams de vídeo contínuos de 24 horas das câmeras e dashcams a bordo dos seus ativos. Quando um sintoma dispara, você não só sabe o que aconteceu: você pode ver.",
    blocks: [
      {
        type: "split",
        kicker: "O que faz",
        title: "De frames de dispositivo a vídeo ao vivo",
        body:
          "O processador de streams consome os frames das suas câmeras e gera streams HLS contínuos com FFmpeg. Um vídeo rolante de 24 horas que dá contexto visual a cada alerta, sem depender de um fornecedor externo de videomonitoramento.",
        bullets: [
          "Streaming HLS contínuo de 24 horas",
          "Frames processados de câmeras e dashcams",
          "Contexto visual associado a cada evento detectado",
          "Armazenamento na sua própria infraestrutura",
          "Verificação offline de frames e recuperação",
        ],
      },
      {
        type: "grid",
        kicker: "Capacidades",
        title: "Vídeo operacional, não só gravação",
        cards: [
          { icon: "video", title: "HLS 24h", body: "Streams rolantes contínuos: sempre há vídeo disponível do período que você precisa revisar." },
          { icon: "bolt", title: "FFmpeg", body: "Processamento de frames em vídeo com o padrão da indústria, no seu pipeline." },
          { icon: "radar", title: "Ligado a sintomas", body: "Cada evento da torre de controle pode vincular o vídeo do momento exato." },
          { icon: "shield", title: "Seu armazenamento", body: "Frames e vídeo vivem no seu bucket. Sem licenças de videomonitoramento externo." },
        ],
      },
    ],
  },

  "producto/caracteristicas": {
    eyebrow: "Produto · Recursos",
    icon: "code",
    title: "Três capacidades principais",
    subtitle:
      "Tudo o que você precisa para processar, analisar e agir sobre dados de frota em tempo real, sobre uma arquitetura aberta que você controla.",
    blocks: [
      {
        type: "split",
        kicker: "Streaming",
        title: "Processe cada sinal conforme ele chega",
        body:
          "O motor avalia a telemetria em tempo real contra as regras da sua operação. Quando algo desvia, dispara a ação —notificar, escalonar, registrar— com latência subsegundo. Tudo configurável, sem escrever código.",
        bullets: [
          "Uma fonte: toda a telemetria da frota em um único fluxo",
          "Regras por sintoma: fadiga, excesso de velocidade, zonas e mais",
          "Ações automáticas: SMS ao supervisor, com evidência salva",
          "Prioridade e severidade por regra, ajustadas à sua operação",
          "Latência mediana ponta a ponta abaixo de 56 ms",
        ],
      },
      {
        type: "grid",
        kicker: "Por que importa",
        title: "Capacidades que se traduzem em operação",
        cards: [
          { icon: "bolt", title: "Tempo real", body: "Aja enquanto o evento acontece, não no dia seguinte. Latência mediana abaixo de 56 ms." },
          { icon: "radar", title: "Detecção inteligente", body: "Mais de 30 regras com exclusão de ruído: sua equipe vê só o que importa." },
          { icon: "doc", title: "Cofre de evidências", body: "Workflows automatizados com rastreabilidade de 7 anos, prontos para conformidade." },
        ],
      },
    ],
  },

  "producto/arquitectura": {
    eyebrow: "Produto · Arquitetura",
    icon: "stack",
    title: "Do dispositivo edge à sua infraestrutura",
    subtitle: "Veja como seus dados fluem dos dispositivos até sua nuvem em tempo real, com latência mediana ponta a ponta abaixo de 56 ms.",
    blocks: [
      {
        type: "steps",
        kicker: "O fluxo",
        title: "Três etapas, um pipeline",
        steps: [
          { n: "01", title: "Ingestão de dados", body: "Colete dados de GPS, sensores e eventos da sua frota em tempo real, de qualquer hardware." },
          { n: "02", title: "Processamento de streams", body: "Enriqueça e avalie fluxos de dados com latência subsegundo contra as regras da sua operação." },
          { n: "03", title: "Sua infraestrutura", body: "Os dados fluem diretamente para seu banco de dados, análise e aplicações. Você é o dono." },
        ],
      },
      {
        type: "stats",
        items: [
          { value: "<56ms", label: "latência mediana ponta a ponta" },
          { value: "2.9M+", label: "sinais processados por mês" },
          { value: "99.9%", label: "precisão de processamento de eventos" },
          { value: "24/7", label: "operação contínua" },
        ],
      },
      {
        type: "grid",
        kicker: "Princípios de design",
        title: "Aberta, modular e sua",
        cards: [
          { icon: "stack", title: "Modular", body: "Cada caixa é um serviço independente. Você contrata e escala só o que usa." },
          { icon: "shield", title: "Soberana", body: "O processamento ocorre na sua região/nuvem. Nunca armazenamos seus dados." },
          { icon: "plug", title: "Sem lock-in", body: "Tecnologias abertas (Pulsar, PostgreSQL, n8n). Você pode trocar componentes." },
        ],
      },
    ],
  },

  "producto/implementacion": {
    eyebrow: "Produto · Implantação",
    icon: "cloud",
    title: "Escolha o modelo que se adapta à sua operação",
    subtitle: "Sua nuvem, gerenciado pela MicroBox Labs ou edge híbrido. A mesma plataforma, o nível de controle e conformidade que você precisa.",
    blocks: [
      {
        type: "grid",
        kicker: "Opções",
        title: "Três formas de implantar a ModularIoT",
        cards: [
          { icon: "cloud", title: "Sua Nuvem", body: "Controle total na sua infraestrutura AWS, Azure ou GCP: soberania de dados, segurança do seu jeito, escalonamento ilimitado e acesso direto ao banco de dados." },
          { icon: "bolt", title: "Gerenciado pela MBL", body: "Nós cuidamos da infraestrutura enquanto você foca nos seus insights: zero overhead de DevOps, monitoramento 24/7, atualizações automáticas e SLA." },
          { icon: "stack", title: "Edge Híbrido", body: "Processamento edge para latência ultrabaixa com backup em nuvem: sub-10 ms, capacidade offline, sincronização e conformidade regional." },
        ],
      },
      {
        type: "steps",
        kicker: "Colocando em marcha",
        title: "Da assinatura à produção",
        steps: [
          { n: "01", title: "Diagnóstico", body: "Revisamos sua operação, hardware atual e os eventos que preocupam você. Sem custo." },
          { n: "02", title: "Integração e configuração", body: "Conectamos sua tecnologia, definimos limites e regras, e ativamos o painel. 5 a 10 dias úteis (48h no modo gerenciado)." },
          { n: "03", title: "Operação com visibilidade", body: "Sua equipe opera com dados em tempo real e recebe um relatório de impacto todo mês." },
        ],
      },
    ],
  },

  soluciones: {
    eyebrow: "Soluções",
    icon: "radar",
    title: "Visibilidade real para sua operação, seja qual for",
    subtitle:
      "A ModularIoT é configurada para o que importa na sua operação específica. Estes são os casos de uso e indústrias onde ela já gera impacto.",
    blocks: [
      {
        type: "grid",
        id: "casos-de-uso",
        kicker: "Casos de uso",
        title: "O que você pode monitorar hoje",
        cards: [
          { icon: "truck", title: "Motoristas e veículos", body: "Velocidade por trecho, condução contínua sem descanso, zonas de risco e estado mecânico. Cada evento classificado e com responsável." },
          { icon: "chart", title: "Telemetria e manutenção", body: "Temperatura, pressão, consumo e ciclos de uso. Sabemos quando um ativo vai falhar antes que falhe." },
          { icon: "shield", title: "Conformidade e auditorias", body: "O procedimento foi feito como definido? Monitoramento da execução real com evidência pronta para fiscalização." },
          { icon: "radar", title: "Torre de controle", body: "Uma visão unificada para sua equipe operacional: alertas com ciclo de vida e rastreabilidade completa." },
        ],
      },
      {
        type: "grid",
        id: "industrias",
        kicker: "Indústrias",
        title: "Operações que já confiam na ModularIoT",
        cards: [
          { icon: "truck", title: "Transporte de carga", body: "Excessos de velocidade na rota, cumprimento de descansos e evidência para clientes exigentes." },
          { icon: "stack", title: "Mineração", body: "Limites por trecho interno mais restritivos que o mapa oficial. Evidência pronta para qualquer fiscalização." },
          { icon: "signal", title: "Distribuição e última milha", body: "Telemetria mecânica em toda a frota: falhas detectadas antes de o veículo parar." },
          { icon: "chart", title: "Logística industrial", body: "Visibilidade centralizada de ativos e processos críticos, com rastreabilidade de cada evento." },
        ],
      },
      {
        type: "split",
        kicker: "Como começamos",
        title: "Configurado para sua operação, não um sistema genérico",
        body:
          "Não instalamos uma solução de molde. Configuramos os limites, zonas, processos e alertas conforme como sua operação específica funciona. Começamos com um diagnóstico gratuito de 30 minutos.",
        bullets: [
          "Diagnóstico gratuito: o que você pode monitorar hoje",
          "Integração com seu hardware e sistemas atuais",
          "Regras e limites definidos para sua operação",
          "Painel ativo para sua equipe em 5 a 10 dias",
          "Relatório de impacto mensal",
        ],
      },
    ],
  },

  recursos: {
    eyebrow: "Recursos",
    icon: "doc",
    title: "Tudo para conhecer e construir com a ModularIoT",
    subtitle: "Documentação, casos reais e comunidade. Aprenda como a plataforma funciona e junte-se ao projeto de código aberto.",
    blocks: [
      {
        type: "linkgrid",
        kicker: "Aprenda",
        title: "Documentação e conteúdo",
        links: [
          { title: "Documentação", body: "Guias, referência de API e integrações para construir sobre a ModularIoT.", href: "https://docs.modulariot.com", external: true },
          { title: "Casos reais", body: "Operações que pararam de ficar sabendo tarde: transporte, mineração e distribuição.", href: "/#clientes" },
          { title: "Perguntas frequentes", body: "O que sempre nos perguntam antes de começar, respondido.", href: "/#faq" },
        ],
      },
      {
        type: "linkgrid",
        kicker: "Comunidade",
        title: "Código aberto e contato",
        links: [
          { title: "GitHub", body: "Plataforma de código aberto sob licença Apache-2.0. Explore, contribua, dê uma estrela.", href: "https://github.com/microboxlabs", external: true },
          { title: "MicroBox Labs", body: "Conheça a empresa por trás da ModularIoT e o resto do portfólio.", href: "https://microboxlabs.com", external: true },
          { title: "Fale conosco", body: "Agende um diagnóstico gratuito de 30 minutos para sua operação.", href: "/#contacto" },
        ],
      },
      {
        type: "grid",
        kicker: "Blog",
        title: "Novidades e notas técnicas",
        subtitle: "Em breve: artigos, casos e aprendizados de operações reais. Enquanto isso, a documentação e os casos já estão disponíveis.",
        cards: [
          { icon: "radar", title: "Como funciona a Torre de Controle", body: "Um percurso pelas regras que transformam sinais em decisões." },
          { icon: "chart", title: "Os 36 sintomas, explicados", body: "O que cada regra detecta e por que importa para sua operação." },
          { icon: "shield", title: "Seus dados, sua nuvem", body: "Como a plataforma funciona sem vendor lock-in, com soberania completa." },
        ],
      },
    ],
  },
};
