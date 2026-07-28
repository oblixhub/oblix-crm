import { useEffect, type ImgHTMLAttributes } from "react";
import { FeaturedPortfolioSection } from "./FeaturedPortfolioSection";
import { SitesMobileNavigation } from "./SitesMobileNavigation";
import "../sites-landing.css";

type AssetImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  fill?: boolean;
  priority?: boolean;
};

function AssetImage({ fill, priority, style, ...props }: AssetImageProps) {
  return (
    <img
      {...props}
      style={
        fill
          ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
          : style
      }
    />
  );
}

const navigation = [
  { label: "Portfólio", href: "/portfolio" },
  { label: "Processo", href: "#processo" },
  { label: "Entrega", href: "#entrega" },
  { label: "Dúvidas", href: "#duvidas" },
];

const sitesWhatsappUrl =
  "https://wa.me/5573999305062?text=Ol%C3%A1%21%20Vi%20o%20site%20da%20OBLIX%20e%20quero%20criar%20um%20site%20para%20meu%20neg%C3%B3cio.";

const directions = [
  {
    number: "01",
    title: "Identidade que vira presença.",
    description: "Uma direção visual que começa no seu trabalho, não em um modelo pronto.",
    image: "/media/direction-identity.png",
    alt: "Estudo arquitetônico monocromático com luz e concreto",
  },
  {
    number: "02",
    title: "Conteúdo que organiza valor.",
    description: "Serviços, diferenciais e história apresentados com clareza e intenção.",
    image: "/media/direction-content.png",
    alt: "Luminária preta minimalista sob luz natural",
  },
  {
    number: "03",
    title: "Contato que acontece.",
    description: "Uma experiência simples que conduz a visita até a conversa.",
    image: "/media/direction-conversion.png",
    alt: "Estrutura circular monocromática vista de baixo",
  },
];

const processSteps = [
  {
    number: "01",
    title: "Conte o que você precisa",
    description:
      "Enviamos uma direção simples para reunir fotos, serviços e informações.",
  },
  {
    number: "02",
    title: "Receba o preview",
    description:
      "Criamos o site e entregamos um link privado para você navegar.",
  },
  {
    number: "03",
    title: "Ajuste com a gente",
    description:
      "Refinamos conteúdo e detalhes visuais durante a aprovação.",
  },
  {
    number: "04",
    title: "Coloque no ar",
    description:
      "Depois da aprovação, configuramos domínio e publicação.",
  },
];

const deliveryItems = [
  "Design personalizado",
  "Responsivo",
  "WhatsApp e redes sociais",
  "Domínio e publicação",
];

const faqs = [
  {
    question: "Preciso pagar antes de ver o site?",
    answer:
      "Não. Primeiro você recebe um preview completo para navegar e avaliar. A publicação acontece somente depois da sua aprovação.",
  },
  {
    question: "Posso pedir alterações?",
    answer:
      "Sim. Durante a etapa de aprovação, refinamos conteúdo e detalhes visuais para que o resultado faça sentido para você.",
  },
  {
    question: "O site funciona no celular?",
    answer:
      "Sim. Cada página é preparada para funcionar bem em celular e computador, com leitura confortável e contato fácil.",
  },
  {
    question: "Vocês cuidam do domínio e da publicação?",
    answer:
      "Sim. Depois da aprovação, podemos configurar o domínio, publicar o projeto e deixar o site pronto para receber visitas.",
  },
  {
    question: "O que preciso enviar para começar?",
    answer:
      "Fotos, logotipo se tiver, principais serviços, informações de contato e o que você considera importante apresentar. Ajudamos a organizar o restante.",
  },
];

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={diagonal ? "arrow-icon arrow-icon--diagonal" : "arrow-icon"}
      viewBox="0 0 24 24"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`}>
      <span className="brand-symbol-frame" aria-hidden="true">
        <AssetImage
          className="brand-symbol"
          src="/brand/oblix-symbol-official.svg"
          width={96}
          height={48}
          alt=""
          priority
        />
      </span>
      <AssetImage
        className="brand-wordmark"
        src="/brand/oblix-wordmark.png"
        width={1918}
        height={313}
        alt="OBLIX"
        priority
      />
    </span>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="header-brand" href="/" aria-label="OBLIX Sites — início">
        <Brand inverse />
      </a>

      <nav className="desktop-navigation" aria-label="Navegação principal">
        {navigation.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <SitesMobileNavigation items={navigation} />
      </div>
    </header>
  );
}

function ScreenChrome({ light = false }: { light?: boolean }) {
  return (
    <div className={`showcase-chrome${light ? " showcase-chrome--light" : ""}`}>
      <span />
      <span />
      <span />
    </div>
  );
}

function HeroShowcase() {
  return (
    <div className="hero-showcase" aria-hidden="true">
      <article className="showcase-screen showcase-screen--technology">
        <ScreenChrome />
        <div className="technology-content">
          <small>ALTA</small>
          <p>
            Tecnologia
            <br />
            com propósito.
          </p>
          <span>Soluções inteligentes para empresas que escalam.</span>
        </div>
      </article>

      <article className="showcase-screen showcase-screen--strategy">
        <ScreenChrome light />
        <div className="strategy-content">
          <small>DRA. CLARA MEDEIROS</small>
          <p>
            Estratégia
            <br />
            financeira.
          </p>
          <span>Plano, foco e crescimento para o seu negócio.</span>
          <div className="strategy-portrait" />
        </div>
      </article>

      <article className="showcase-screen showcase-screen--architecture">
        <ScreenChrome />
        <div className="architecture-intro">
          <small>ESTÚDIO ÂMBAR</small>
          <p>
            Arquitetura
            <br />
            que transforma
            <br />
            espaços e rotinas.
          </p>
          <span>Projetos autorais para viver melhor.</span>
        </div>
        <div className="architecture-image">
          <AssetImage
            src="/media/hero-architecture-v2.png"
            width={1672}
            height={940}
            alt=""
            priority
            sizes="(max-width: 760px) 88vw, 42vw"
          />
        </div>
        <div className="architecture-services">
          <small>SERVIÇOS</small>
          <p>Soluções completas, do projeto à entrega.</p>
          <ul>
            <li>Projetos arquitetônicos <span>+</span></li>
            <li>Interiores <span>+</span></li>
            <li>Acompanhamento de obra <span>+</span></li>
          </ul>
        </div>
      </article>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Header />
      <div className="hero-grid">
        <div className="hero-copy">
          <h1
            id="hero-title"
            aria-label="Seu trabalho já é profissional. Seu site precisa mostrar isso."
          >
            <span className="hero-title-desktop" aria-hidden="true">
              <span>Seu trabalho já é</span>
              <span>profissional. Seu site</span>
              <span>precisa mostrar isso.</span>
            </span>
            <span className="hero-title-mobile" aria-hidden="true">
              <span>Seu trabalho</span>
              <span>já é profissional.</span>
              <span>Seu site precisa</span>
              <span>mostrar isso.</span>
            </span>
          </h1>
          <p>
            Sites sob medida para profissionais e pequenos negócios — pensados
            para transformar visitas em conversas.
          </p>
          <div className="hero-actions">
            <a
              className="button button--accent"
              href={sitesWhatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              Quero meu site
              <ArrowIcon diagonal />
            </a>
            <a className="text-link text-link--light" href="#processo">
              Ver como funciona
              <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="hero-media" aria-hidden="true">
          <HeroShowcase />
        </div>
      </div>
    </section>
  );
}

function DirectionSheet({
  direction,
}: {
  direction: (typeof directions)[number];
}) {
  return (
    <article className="direction-sheet">
      <div className="sheet-chrome">
        <span>OBLIX / DIREÇÃO {direction.number}</span>
        <span>Menu</span>
      </div>
      <div className="sheet-copy">
        <h3>{direction.title}</h3>
        <p>{direction.description}</p>
      </div>
      <div className="sheet-media">
        <AssetImage
          src={direction.image}
          fill
          sizes="(max-width: 760px) 82vw, 33vw"
          alt={direction.alt}
        />
      </div>
      <div className="sheet-footer">
        <span>{direction.number} / 03</span>
        <span>Feito sob medida</span>
      </div>
    </article>
  );
}

function DirectionSection() {
  return (
    <section className="projects section-light" id="direcao">
      <div className="section-heading-grid">
        <h2>Sites que começam por você.</h2>
        <p>
          Sua identidade, seus serviços e a forma como você quer ser percebido
          orientam cada decisão.
        </p>
      </div>

      <div className="direction-rail">
        <span className="direction-axis" aria-hidden="true">
          <span />
        </span>
        <div className="direction-track">
          {directions.map((direction) => (
            <DirectionSheet key={direction.number} direction={direction} />
          ))}
        </div>
      </div>

      <div className="manifesto-row">
        <p>Não trocamos apenas cores. Construímos presença.</p>
        <a className="text-link" href="#processo">
          Conheça o processo
          <ArrowIcon />
        </a>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="process" id="processo">
      <div className="process-intro">
        <h2>Você vê antes. Aprova depois.</h2>
        <p>
          O projeto ganha forma primeiro. Você avalia com calma, pede ajustes e
          só então decide publicar.
        </p>
      </div>

      <ol className="process-track">
        {processSteps.map((step) => (
          <li key={step.number}>
            <span className="process-marker" aria-hidden="true" />
            <span className="process-number">{step.number}</span>
            <div>
              <h3>
                {step.number} — {step.title}
              </h3>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DeliverySection() {
  return (
    <section className="delivery section-light" id="entrega">
      <h2>
        Pronto para celular.
        <span>Pensado para conversa.</span>
      </h2>
      <ul>
        {deliveryItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="faq section-light" id="duvidas">
      <h2>Sem letra miúda.</h2>
      <div className="faq-list">
        {faqs.map((faq, index) => (
          <details key={faq.question} open={index === 0}>
            <summary>
              <span>{faq.question}</span>
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalContact() {
  return (
    <section className="final-contact" id="contato">
      <div className="final-symbol" aria-hidden="true">
        <AssetImage
          src="/brand/oblix-symbol-official.svg"
          width={96}
          height={48}
          alt=""
        />
      </div>
      <div className="final-contact-copy">
        <h2>Vamos colocar seu trabalho no lugar que ele merece?</h2>
        <p>
          Conte o que você faz. A gente transforma isso em uma presença digital
          clara, bonita e pronta para conversar com seus clientes.
        </p>
        <div className="final-actions">
          <a
            className="button button--accent"
            href={sitesWhatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            Quero conversar
            <ArrowIcon diagonal />
          </a>
          <a className="contact-email" href="mailto:studio.oblixhub@gmail.com">
            studio.oblixhub@gmail.com
          </a>
        </div>
      </div>
      <footer className="site-footer">
        <Brand inverse />
        <p>Sites sob medida</p>
        <p>© 2026</p>
      </footer>
    </section>
  );
}

export function PortalHome() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "OBLIX Sites — Sites sob medida para negócios";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="marketing-page">
      <Hero />
      <FeaturedPortfolioSection />
      <DirectionSection />
      <ProcessSection />
      <DeliverySection />
      <FaqSection />
      <FinalContact />
    </main>
  );
}
