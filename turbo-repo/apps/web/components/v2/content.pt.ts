// Tradução em português do conteúdo da landing. Mesma forma que content.ts (es).
// hrefs, ícones, ids, tags, snippets de código, horários e valores numéricos permanecem iguais.

export const pt = {
  nav: {
    mega: {
      label: "Produto",
      sections: [
        {
          title: "Plataforma",
          items: [
            { icon: "signal", label: "Ingestão GPS Core", href: "/producto/ingesta-gps-core", desc: "Sinais GPS e sensores em tempo real para o seu banco de dados" },
            { icon: "radar", label: "Sintomas / Torre de Controle", href: "/producto/sintomas-torre-control", desc: "Mais de 30 regras de detecção com rastreabilidade" },
            { icon: "plug", label: "Integrações", href: "/producto/integraciones", desc: "Workflows, webhooks e cofre de evidências" },
            { icon: "video", label: "Vídeo ao Vivo / HLS", href: "/producto/video-en-vivo", desc: "Streaming contínuo de câmeras e dashcams" },
          ],
        },
        {
          title: "Tecnologia",
          items: [
            { icon: "code", label: "Recursos", href: "/producto/caracteristicas", desc: "Streaming, alertas e fluxos de trabalho" },
            { icon: "stack", label: "Arquitetura", href: "/producto/arquitectura", desc: "Do dispositivo edge à sua nuvem em <56ms" },
            { icon: "cloud", label: "Implantação", href: "/producto/implementacion", desc: "Sua nuvem, gerenciado pela MBL ou edge híbrido" },
          ],
        },
        {
          title: "Explore ao vivo · dados reais",
          items: [
            { icon: "radar", label: "Torre de controle", href: "/torre", desc: "Os 36 sintomas sobre uma operação real" },
            { icon: "stack", label: "SuperProfile", href: "/superprofile", desc: "A identidade operacional viva de cada ator" },
            { icon: "plug", label: "Canais de escalonamento", href: "/canales", desc: "O alerta em e-mail, WhatsApp, Teams, Webex e SMS" },
            { icon: "signal", label: "Provedores GPS", href: "/proveedores-gps", desc: "Precisão de sinal: 12/20 pulsos por minuto" },
          ],
        },
      ],
    },
    columnMenus: [
      {
        label: "Soluções",
        columns: [
          {
            title: "Casos de uso",
            links: [
              { label: "Monitoramento de motoristas e ativos", href: "/soluciones#casos-de-uso" },
              { label: "Telemetria mecânica e manutenção", href: "/soluciones#casos-de-uso" },
              { label: "Conformidade e auditorias", href: "/soluciones#casos-de-uso" },
              { label: "Torre de controle operacional", href: "/soluciones#casos-de-uso" },
            ],
            footer: { label: "Todas as soluções", href: "/soluciones" },
          },
          {
            title: "Indústrias",
            links: [
              { label: "Transporte de carga", href: "/soluciones#industrias" },
              { label: "Mineração", href: "/soluciones#industrias" },
              { label: "Distribuição e última milha", href: "/soluciones#industrias" },
              { label: "Logística industrial", href: "/soluciones#industrias" },
            ],
            footer: { label: "Casos reais", href: "/#clientes" },
          },
        ],
      },
      {
        label: "Recursos",
        columns: [
          {
            title: "Aprenda",
            links: [
              { label: "Documentação", href: "https://docs.modulariot.com", external: true },
              { label: "Casos reais", href: "/#clientes" },
              { label: "Perguntas frequentes", href: "/#faq" },
            ],
            footer: { label: "Todos os recursos", href: "/recursos" },
          },
          {
            title: "Comunidade",
            links: [
              { label: "GitHub", href: "https://github.com/microboxlabs", external: true },
              { label: "MicroBox Labs", href: "https://microboxlabs.com", external: true },
            ],
          },
        ],
      },
    ],
    direct: [
      { label: "Docs", href: "https://docs.modulariot.com", external: true },
      { label: "Preços", href: "/precios" },
      { label: "Contato", href: "/contacto" },
    ],
    github: { label: "GitHub", href: "https://github.com/microboxlabs" },
    languages: [
      { lang: "es", country: "Chile", flag: "cl" },
      { lang: "es", country: "Peru", flag: "pe" },
      { lang: "es", country: "Colômbia", flag: "co" },
      { lang: "es", country: "México", flag: "mx" },
      { lang: "pt", country: "Brasil", flag: "br" },
      { lang: "en", country: "Global", flag: "gl" },
    ],
    cta: "Solicitar demo",
    actions: {
      demo: { label: "Agende uma demo", href: "/contacto?intent=demo" },
      login: { label: "Entrar", href: "/contacto?intent=login" },
      signup: { label: "Criar conta", href: "/contacto?intent=signup" },
    },
  },

  hero: {
    kicker: "Código Aberto · Apache-2.0",
    titlePre: "De detectar desvios a ",
    titleHighlight: "reduzi-los",
    titlePost: ", na sua operação real.",
    subtitle:
      "Não vendemos mais alertas: transformamos cada sinal em menos problemas repetidos. E os dados e as decisões são seus.",
    ctaPrimary: "Agende uma demo técnica de 20 min",
    ctaSecondary: "Ver preços",
    livePanel: {
      title: "Operação ao vivo",
      subtitle: "uma operação real, agora mesmo",
      live: "recebendo eventos…",
      done: "tudo fica na sua operação",
      events: [
        { kind: "signal", title: "Sinais chegando", detail: "2.847 ativos reportando em tempo real" },
        { kind: "symptom", title: "Sintoma detectado", detail: "Excesso de velocidade · rota interna · severidade alta" },
        { kind: "action", title: "Escalonado ao responsável", detail: "supervisor notificado por SMS, com evidência" },
        { kind: "record", title: "Fica registrado", detail: "no seu banco de dados, na sua nuvem" },
      ],
    },
  },

  stats: {
    title: "Uma operação real, rodando hoje — não uma demo",
    items: [
      { value: "55.847", label: "sintomas geridos em um mês real" },
      { value: "65%", label: "dos alertas tratados são invalidados: fechar ≠ resolver" },
      { value: "+28", label: "provedores GPS integrados" },
      { value: "1.900+", label: "ativos em operação real" },
    ],
  },

  problem: {
    kicker: "O problema",
    title: "Você trata cada alerta. Os desvios voltam do mesmo jeito.",
    subtitle:
      "Quase tudo é atendido: 97% dos sintomas recebe tratamento. Mas a maioria é invalidada — o ticket é fechado, a causa não é resolvida. Por isso os mesmos desvios se repetem mês a mês.",
    pains: [
      {
        title: "“Me avisaram no dia seguinte”",
        body: "O evento já havia ocorrido. O sistema registrou tudo. Mas ninguém viu até ser tarde demais para agir.",
      },
      {
        title: "“Temos alertas, mas são ruído”",
        body: "O sistema dispara centenas de notificações por dia. A equipe as ignora. As críticas se perdem entre as irrelevantes.",
      },
      {
        title: "“Não conseguimos provar nada”",
        body: "Quando chega uma auditoria, uma fiscalização ou uma reclamação, reconstruir o que aconteceu é um trabalho de dias. Se é que os dados existem.",
      },
    ],
  },

  steps: {
    kicker: "Como funciona na prática",
    title: "De um sinal bruto a uma decisão, em menos de um segundo",
    subtitle: "O mesmo evento que você vê no fluxo ao vivo, contado passo a passo.",
    items: [
      {
        n: "01",
        title: "O sinal é capturado",
        body: "Cada ping GPS, valor de sensor e evento do motorista entra no seu fluxo em milissegundos, não importa o fornecedor do hardware.",
        tag: "INGESTA",
      },
      {
        n: "02",
        title: "Processado em tempo real",
        body: "O motor de streaming enriquece e avalia o sinal contra mais de 30 regras, com latência mediana abaixo de 56 ms.",
        tag: "STREAM",
      },
      {
        n: "03",
        title: "O sintoma é detectado",
        body: "Se algo desvia do padrão da sua operação, um evento classificado por severidade é gerado — não apenas mais uma notificação genérica.",
        tag: "SÍNTOMA",
      },
      {
        n: "04",
        title: "A resposta é acionada",
        body: "O evento é atribuído a um responsável e dispara o fluxo que você definiu: SMS, alerta no painel, ordem de serviço ou webhook.",
        tag: "WORKFLOW",
      },
      {
        n: "05",
        title: "A evidência permanece",
        body: "Tudo é registrado com timestamp, responsável e resolução no seu próprio banco de dados. Auditoria pronta em segundos, não em dias.",
        tag: "EVIDENCIA",
      },
    ],
  },

  painOutcome: {
    kicker: "A mudança de fundo",
    title: "A diferença entre alertar e reduzir",
    left: {
      title: "Só alertar",
      items: [
        "A caixa de entrada enche de notificações que a equipe acaba ignorando",
        "O ticket é fechado, mas a causa que o gera continua ali",
        "Os mesmos desvios se repetem mês a mês",
        "Ninguém sabe se a gestão realmente reduziu o problema",
        "O dado fica preso em um sistema de terceiros",
      ],
    },
    right: {
      title: "Com ModularIoT",
      items: [
        "Cada sintoma chega com responsável, contexto e plano de ação",
        "Atacamos a causa raiz, não só o evento do dia",
        "Medimos a redução real de desvios mês a mês",
        "O SuperProfile mostra se cada ator melhora ou reincide",
        "Os dados e as decisões ficam sob seu controle",
      ],
    },
  },

  features: {
    kicker: "Recursos",
    title: "Três capacidades principais",
    subtitle: "Tudo o que você precisa para processar, analisar e agir sobre dados de frota em tempo real",
    cards: [
      {
        icon: "signal",
        title: "Processamento em tempo real",
        body: "Cada sinal GPS, sensor e evento do motorista é processado conforme chega, com latência mediana abaixo de 56 ms.",
        bullets: ["Uma única fonte para toda a telemetria", "Enriquecido e avaliado na hora", "Milhares de eventos por segundo, sem lote"],
      },
      {
        icon: "radar",
        title: "Alertas por sintoma",
        body: "Mais de 30 regras detectam o desvio —fadiga, excesso de velocidade, zonas de risco— e geram um evento classificado, não mais uma notificação genérica.",
        bullets: ["Severidade e responsável automáticos", "Exclusão inteligente de ruído", "Ação disparada: SMS, painel ou ordem de serviço"],
      },
      {
        icon: "plug",
        title: "Escalonamento por sintoma",
        body: "Cada sintoma é escalonado ao canal onde a operação vive —e-mail, WhatsApp, Teams— com conversa bidirecional, plano e responsável.",
        bullets: ["Canal conforme o tipo de sintoma", "Ciclo bidirecional, não só notificar", "Cada alerta chega com plano e responsável"],
      },
    ],
  },

  architecture: {
    kicker: "Arquitetura",
    title: "Do dispositivo edge à sua infraestrutura",
    subtitle: "Veja como seus dados fluem dos dispositivos edge até sua nuvem em tempo real",
    steps: [
      { n: "01", title: "Ingestão de dados", body: "Colete dados de GPS, sensores e eventos da sua frota em tempo real" },
      { n: "02", title: "Processamento de streams", body: "Processe e analise fluxos de dados com latência subsegundo" },
      { n: "03", title: "Sua infraestrutura", body: "Os dados fluem diretamente para seu banco de dados, análise e aplicações" },
    ],
    latency: "< 56 ms de latência mediana ponta a ponta",
    latencySubtitle: "Da leitura do sensor à resposta da sua aplicação",
  },

  useCases: {
    kicker: "Casos de uso",
    title: "Quatro caixas de processamento. Contrate só as que você precisa.",
    subtitle:
      "Arquitetura modular sem dependência de fornecedor: cada caixa é um serviço independente com preço próprio por ativo.",
    cards: [
      {
        id: "ingesta",
        icon: "signal",
        title: "Ingestão GPS Core",
        body: "Cada ping GPS, sinal de sensor e evento do motorista flui para seus sistemas em milissegundos. API de último sinal, rastreamento AVL e captura de mudanças para seus sistemas.",
        bullets: ["API de último sinal por ativo", "Rastreamento AVL em tempo real", "CDC para seus sistemas downstream"],
      },
      {
        id: "sintomas",
        icon: "radar",
        title: "Sintomas / Torre de Controle",
        body: "Mais de 30 regras de detecção: velocidade por trecho, condução contínua, zonas de risco, fadiga, telemetria mecânica. Cada evento com severidade, responsável e rastreabilidade completa.",
        bullets: ["Severidade e responsável automáticos", "Ciclo de vida: abrir → tratar → fechar", "Exclusão inteligente de ruído"],
      },
      {
        id: "integraciones",
        icon: "plug",
        title: "Integrações",
        body: "Automação de fluxos com n8n, gestor documental para evidências, API gateway e webhooks. Sua operação conectada aos sistemas que você já usa.",
        bullets: ["Workflows e webhooks (n8n)", "Cofre de evidências documental", "APIs e gateway para seus sistemas"],
      },
      {
        id: "video",
        icon: "video",
        title: "Vídeo ao Vivo / HLS",
        body: "Streams de vídeo contínuos de 24 horas das câmeras a bordo dos seus ativos. Contexto visual para cada evento detectado.",
        bullets: ["Streaming HLS 24h contínuo", "Frames de câmeras e dashcams", "Contexto visual de cada alerta"],
      },
    ],
  },

  stories: {
    kicker: "Clientes",
    title: "Operações que pararam de ficar sabendo tarde",
    metrics: [
      { value: "+1.900", label: "ativos em operação real" },
      { value: "97%", label: "dos sintomas com gestão" },
      { value: "36", label: "regras de detecção em produção" },
      { value: "5", label: "canais de escalonamento" },
    ],
    cases: [
      {
        tag: "Transporte e Mineração",
        before:
          "Empresa com frota própria em operação de mineração. Sem evidência de excessos de velocidade em rotas internas. Auditorias que levavam dias.",
        after:
          "Detecção de excessos de velocidade com severidade automática desde o primeiro mês. Limites por trecho interno, mais restritivos que o mapa oficial. Evidência pronta para qualquer fiscalização, em segundos.",
      },
      {
        tag: "Frota de Distribuição",
        before:
          "Frota de 390 veículos leves. Veículos parando na estrada sem aviso prévio. Sem dados do estado mecânico até o motorista ligar para o chefe.",
        after:
          "Telemetria mecânica ativa em toda a frota. Check Engine, bateria no limite e falha do alternador detectados antes da parada.",
      },
    ],
    quotes: [
      {
        text: "Agora quando algo acontece, a primeira coisa que minha equipe faz é abrir o sistema e buscar o evento. Antes, ligavam para o motorista.",
        author: "Chefe de Operações, Empresa de Transporte de Carga, Chile",
      },
      {
        text: "Eu tinha GPS em todos os veículos. O caminhão passou por uma zona de risco à noite e ninguém me avisou. Fiquei sabendo no dia seguinte. Isso não acontece mais.",
        author: "Gerente de Frota, Empresa de Logística, Norte do Chile",
      },
    ],
  },

  deployment: {
    kicker: "Implantação",
    title: "Implantação",
    subtitle: "Uma colocação em operação gerenciada pela MicroBox Labs sobre a sua própria nuvem: nós operamos a infraestrutura, você foca na operação. No ar em dias, não meses.",
    soonLabel: "Em breve",
    includes: [
      { title: "Configurado à sua operação", body: "Limites, zonas e regras ajustados a como você trabalha — não um modelo genérico." },
      { title: "Implantado na sua nuvem", body: "Roda na sua própria infraestrutura (AWS, Azure ou GCP); seus dados nunca saem do seu controle.", soon: true },
      { title: "Conectado aos seus sistemas", body: "Integração via API com as plataformas que você já usa (despacho, manutenção, ERP); soma-se à sua operação, não a substitui." },
      { title: "Canais da sua operação", body: "E-mail, WhatsApp, Teams, Webex e SMS conectados para que o alerta chegue onde o time vive." },
      { title: "Colocação em operação gerenciada", body: "A MicroBox Labs opera e acompanha a operação, sem overhead de DevOps do seu lado." },
      { title: "Monitoramento, suporte e atualizações", body: "A plataforma se mantém atualizada e monitorada sem que você precise se ocupar." },
    ],
  },

  pricingTeaser: {
    kicker: "Preços",
    title: "Pague por ativo, só pelo que você usa",
    subtitle:
      "Sem licenças por assento, sem custos de instalação. Cada caixa de processamento tem preço próprio por ativo/mês. Monte seu plano com a calculadora.",
    cta: "Calcule o preço da sua frota",
  },

  faq: {
    kicker: "FAQ",
    title: "Perguntas frequentes",
    items: [
      {
        q: "Qual a diferença entre ModularIoT e os provedores tradicionais de telemática?",
        a: "Os provedores tradicionais param no alerta: eles notificam e acabou. A ModularIoT interpreta cada sintoma, atribui responsável e plano, e mede se o desvio realmente cai mês a mês. Além disso, os dados e a lógica de processamento ficam sob seu controle, sem aprisionamento em tarifas por ativo. É a diferença entre alertar e reduzir.",
      },
      {
        q: "Como a ModularIoT se compara ao Apache Kafka ou Apache Pulsar?",
        a: "Kafka e Pulsar são excelentes brokers de mensagens; a ModularIoT é uma plataforma completa de processamento de dados de frota. Usamos Pulsar por baixo, mas adicionamos processadores específicos para frotas, regras de detecção e integrações prontas para usar. Streaming de nível empresarial sem construir tudo do zero.",
      },
      {
        q: "Preciso trocar minha tecnologia atual?",
        a: "Não. Integramos com os sensores, GPS, câmeras e sistemas que você já tem instalados. No diagnóstico revisamos sua tecnologia atual e confirmamos a compatibilidade.",
      },
      {
        q: "E quanto ao GDPR e à soberania de dados?",
        a: "A soberania de dados é um princípio fundamental: todo o processamento ocorre na sua região/nuvem escolhida e nunca armazenamos os dados da sua frota em nossos sistemas. Incluímos anonimização, políticas de retenção e trilhas de auditoria. Seus dados permanecem sob seu controle o tempo todo.",
      },
      {
        q: "Quão rápido podemos começar?",
        a: "Para implantações gerenciadas, você pode estar processando dados ao vivo em 48 horas. Implantações na sua nuvem geralmente levam de 1 a 2 semanas, incluindo configuração de infraestrutura e testes de integração.",
      },
      {
        q: "O sistema gera muitos alertas que a equipe acaba ignorando?",
        a: "É exatamente o que evitamos. Os alertas têm regras de exclusão inteligente: nenhuma notificação é gerada se não atender às condições configuradas para sua operação. Seus operadores veem apenas o que importa e requer ação.",
      },
      {
        q: "Que tipo de suporte vocês oferecem?",
        a: "Todos os planos incluem suporte técnico pelo nosso portal. Os planos superiores incluem um Customer Success Manager dedicado e tempos de resposta prioritários, até suporte 24/7 com SLAs garantidos.",
      },
    ],
  },

  finalCta: {
    title: "Pronto para reduzir os desvios da sua operação?",
    body: "Chega de alertas se acumulando. Transforme cada sinal em menos problemas repetidos — com seus dados e suas decisões sob seu controle. Veja funcionando em 20 minutos.",
    cta: "Agende uma chamada de onboarding",
    note: "Sem compromisso · Resposta em menos de 24 horas",
    stats: [
      { value: "48hr", label: "configuração de implantação gerenciada" },
      { value: "0%", label: "dependência de fornecedores de dados" },
      { value: "100%", label: "seus dados, seu controle" },
    ],
  },

  footer: {
    description: "Transformamos cada sinal da sua frota em menos desvios repetidos. Os dados e as decisões são seus.",
    columns: [
      {
        title: "Explorar",
        links: [
          { label: "Torre de controle", href: "/torre" },
          { label: "SuperProfile", href: "/superprofile" },
          { label: "Canais de escalonamento", href: "/canales" },
          { label: "Provedores GPS", href: "/proveedores-gps" },
          { label: "Preços", href: "/precios" },
        ],
      },
      {
        title: "Documentação",
        links: [
          { label: "Início rápido", href: "https://docs.modulariot.com" },
          { label: "Referência de API", href: "https://docs.modulariot.com" },
          { label: "Integrações", href: "https://docs.modulariot.com" },
          { label: "GitHub", href: "https://github.com/microboxlabs" },
        ],
      },
      {
        title: "Empresa",
        links: [
          { label: "Sobre a MicroBox Labs", href: "https://microboxlabs.com" },
          { label: "Contato", href: "/contacto" },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} MicroBox Labs · Todos os direitos reservados`,
  },

  pricingPage: {
    title: "Preços",
    subtitle:
      "Pague com base no uso, não em licenças por assento. Cada caixa de processamento tem preço próprio por ativo/mês e escala conforme sua frota cresce.",
    philosophy: [
      {
        title: "Pague só pelo que usa",
        body: "Você contrata caixas de processamento independentes. Se não usa vídeo ou integrações, não paga por elas.",
      },
      {
        title: "Preço por ativo, transparente",
        body: "Um preço fixo por ativo/mês para cada caixa. Sem surpresas, sem custos de instalação, sem fidelidade mínima.",
      },
      {
        title: "Baseado em custos reais",
        body: "Os preços derivam do custo real de infraestrutura por transação da plataforma, não de uma tarifa arbitrária.",
      },
    ],
    faqTitle: "Perguntas sobre preços",
    faqs: [
      {
        q: "Como o serviço é cobrado?",
        a: "Assinatura mensal por ativo monitorado, conforme as caixas de processamento que você contratar. A proposta final é entregue após o diagnóstico gratuito.",
      },
      {
        q: "Os preços da calculadora são finais?",
        a: "São indicativos, baseados em custos reais de infraestrutura. A proposta formal pode variar conforme volume, configuração de regras e modelo de implantação (sua nuvem, gerenciado ou edge híbrido).",
      },
      {
        q: "Há custos de instalação ou fidelidade mínima?",
        a: "Não. A integração com sua tecnologia atual está incluída e você pode ajustar ou cancelar as caixas contratadas mês a mês.",
      },
      {
        q: "O que cada caixa inclui?",
        a: "Cada caixa é um serviço completo: infraestrutura, processamento, painel de gestão e suporte. A caixa de Ingestão GPS Core é a base sobre a qual as demais operam.",
      },
    ],
    cta: {
      title: "Seu caso é mais complexo?",
      body: "Frotas grandes, múltiplas operações ou requisitos específicos de conformidade: vamos conversar e montar uma proposta sob medida.",
      button: "Fale conosco",
    },
  },
};
