import { SitesMobileNavigation } from "./SitesMobileNavigation";

const navigation = [
  { label: "Portfólio", href: "/portfolio" },
  { label: "Processo", href: "/#processo" },
  { label: "Dúvidas", href: "/#duvidas" },
];

export const portfolioWhatsappUrl =
  "https://wa.me/5573999305062?text=Ol%C3%A1%21%20Vi%20o%20portf%C3%B3lio%20da%20OBLIX%20e%20quero%20criar%20um%20site.";

export function PortfolioPublicHeader() {
  return (
    <header className="portfolio-public-header">
      <a className="portfolio-brand" href="/" aria-label="OBLIX Sites — início">
        <span className="portfolio-brand-symbol" aria-hidden="true">
          <img src="/brand/oblix-symbol-official.svg" alt="" />
        </span>
        <img
          className="portfolio-brand-wordmark"
          src="/brand/oblix-wordmark.png"
          alt="OBLIX"
        />
      </a>
      <nav className="portfolio-desktop-nav" aria-label="Navegação principal">
        {navigation.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
        <a
          className="portfolio-header-cta"
          href={portfolioWhatsappUrl}
          target="_blank"
          rel="noreferrer"
        >
          Falar no WhatsApp
        </a>
      </nav>
      <SitesMobileNavigation items={navigation} />
    </header>
  );
}
