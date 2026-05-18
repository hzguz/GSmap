import { useEffect, useMemo, useState } from "react";
import { Logo } from "./Logo";
import { useLocale } from "./i18n";

type Props = {
  onBack: () => void;
  uiTheme: "light" | "dark";
  onToggleTheme: () => void;
  embedded?: boolean;
};

export function PrivacyPage({ onBack, uiTheme, onToggleTheme, embedded = false }: Props) {
  const { resolved } = useLocale();
  const isBR = resolved === "pt-BR";

  const TOC = useMemo(
    () =>
      isBR
        ? [
            { id: "summary", label: "Resumo" },
            { id: "data-collected", label: "Dados coletados" },
            { id: "external-services", label: "Serviços externos" },
            { id: "local-storage", label: "Armazenamento local" },
            { id: "your-rights", label: "Seus direitos" },
          ]
        : [
            { id: "summary", label: "Summary" },
            { id: "data-collected", label: "Data collected" },
            { id: "external-services", label: "External services" },
            { id: "local-storage", label: "Local storage" },
            { id: "your-rights", label: "Your rights" },
          ],
    [isBR],
  );

  const [activeId, setActiveId] = useState<string>(TOC[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [TOC]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const tocNav = (
    <ul>
      {TOC.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={"toc-link" + (activeId === item.id ? " toc-link-active" : "")}
            onClick={(e) => { e.preventDefault(); scrollTo(item.id); }}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="license-page">
      {!embedded && (
        <div className="license-topbar">
          <button className="btn btn-ghost" onClick={onBack} aria-label="Back to the app">
            {isBR ? "Voltar" : "Back"}
          </button>
          <Logo size={20} />
          <button
            className="icon-btn"
            type="button"
            onClick={onToggleTheme}
            aria-label={uiTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={uiTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            {uiTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      )}

      <div className={"license-layout" + (embedded ? " license-layout-embedded" : "")}>
        {embedded ? (
          <div className="license-toc-embedded-wrap">
            <nav className="license-toc license-toc-embedded" aria-label="Table of contents">
              <div className="license-toc-title">{isBR ? "Nesta página" : "On this page"}</div>
              {tocNav}
            </nav>
          </div>
        ) : (
          <nav className="license-toc" aria-label="Table of contents">
            <div className="license-toc-title">{isBR ? "Nesta página" : "On this page"}</div>
            {tocNav}
          </nav>
        )}

        <div className="license-content">
          {isBR ? <ContentPtBR onBack={onBack} /> : <ContentEnUS onBack={onBack} />}
        </div>
      </div>
    </div>
  );
}

function ContentPtBR({ onBack }: { onBack: () => void }) {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p className="lede">
        O gsmap é uma ferramenta client-side para designers. Esta página explica de forma
        direta quais dados trafegam durante o uso do app e onde eles vão.
      </p>

      <div className="callout" id="summary">
        <strong>Resumo:</strong> não coletamos nenhum dado pessoal. Nenhum servidor
        próprio recebe suas informações. O app roda inteiramente no seu navegador.
      </div>

      <h2 id="data-collected">Dados coletados</h2>
      <p>O gsmap <strong>não coleta, armazena nem transmite dados pessoais</strong> para nenhum servidor próprio.</p>
      <p>Não há:</p>
      <ul>
        <li>Cadastro ou autenticação</li>
        <li>Rastreamento de uso ou analytics</li>
        <li>Cookies de terceiros</li>
        <li>Identificadores de usuário</li>
      </ul>

      <h2 id="external-services">Serviços externos</h2>
      <p>
        Para funcionar, o app faz requisições a três serviços públicos. Em cada caso,
        apenas o mínimo necessário é enviado.
      </p>

      <div className="license-tool-list">
        <section className="license-tool-card">
          <h3>Nominatim — busca por nome</h3>
          <p>
            Quando você pesquisa um local por nome, o texto digitado é enviado ao
            Nominatim, o geocoder público da OpenStreetMap Foundation.
          </p>
          <p><strong>Dado enviado:</strong> o texto da busca (ex: "Avenida Paulista").</p>
          <p><strong>Quem opera:</strong> OpenStreetMap Foundation.</p>
          <p>
            <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">
              Política de uso do Nominatim
            </a>
          </p>
        </section>

        <section className="license-tool-card">
          <h3>Overpass API — dados vetoriais</h3>
          <p>
            Quando você exporta em SVG, o app consulta a Overpass API para obter os
            dados geográficos da área selecionada (ruas, água, parques, edifícios).
          </p>
          <p><strong>Dado enviado:</strong> as coordenadas da área selecionada (bounding box).</p>
          <p><strong>Quem opera:</strong> overpass-api.de (serviço público da comunidade OSM).</p>
          <p>
            <a href="https://overpass-api.de" target="_blank" rel="noreferrer">
              overpass-api.de
            </a>
          </p>
        </section>

        <section className="license-tool-card">
          <h3>OpenFreeMap — tiles do mapa</h3>
          <p>
            O mapa visual exibido na tela é carregado do OpenFreeMap, que serve os
            tiles (blocos de imagem/vetor) conforme você navega.
          </p>
          <p><strong>Dado enviado:</strong> a posição e o zoom da câmera do mapa (comportamento padrão de qualquer app de mapas).</p>
          <p><strong>Quem opera:</strong> OpenFreeMap (projeto open-source).</p>
          <p>
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
              openfreemap.org
            </a>
          </p>
        </section>
      </div>

      <h2 id="local-storage">Armazenamento local</h2>
      <p>O app salva duas coisas no <code>localStorage</code> do seu navegador:</p>
      <ul>
        <li>
          <strong>Histórico de locais:</strong> coordenadas e nomes de buscas recentes,
          para facilitar revisitar locais. Esses dados ficam apenas no seu dispositivo e
          nunca saem dele.
        </li>
        <li>
          <strong>Preferência de tema:</strong> se você usa o modo claro ou escuro.
        </li>
      </ul>
      <p>
        Você pode limpar o histórico a qualquer momento pelo botão "Limpar histórico"
        na aba de Histórico, ou limpando o localStorage do navegador.
      </p>

      <h2 id="your-rights">Seus direitos</h2>
      <p>
        Como não coletamos nenhum dado pessoal, não há nada a solicitar de nós.
        Todos os dados armazenados estão no seu próprio dispositivo e você tem
        controle total sobre eles.
      </p>
      <p>
        O código-fonte do app é aberto e pode ser auditado a qualquer momento em{" "}
        <a href="https://github.com/hzguz/gsmap" target="_blank" rel="noreferrer">
          github.com/hzguz/gsmap
        </a>.
      </p>

      <button className="btn license-back" onClick={onBack}>
        Voltar ao app
      </button>
    </>
  );
}

function ContentEnUS({ onBack }: { onBack: () => void }) {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="lede">
        gsmap is a client-side tool for designers. This page explains straightforwardly
        which data flows during app usage and where it goes.
      </p>

      <div className="callout" id="summary">
        <strong>Summary:</strong> we collect no personal data. No server of ours
        receives your information. The app runs entirely in your browser.
      </div>

      <h2 id="data-collected">Data collected</h2>
      <p>gsmap <strong>does not collect, store, or transmit personal data</strong> to any server we operate.</p>
      <p>There is no:</p>
      <ul>
        <li>Registration or authentication</li>
        <li>Usage tracking or analytics</li>
        <li>Third-party cookies</li>
        <li>User identifiers</li>
      </ul>

      <h2 id="external-services">External services</h2>
      <p>
        To function, the app makes requests to three public services. In each case,
        only the minimum necessary data is sent.
      </p>

      <div className="license-tool-list">
        <section className="license-tool-card">
          <h3>Nominatim — place search</h3>
          <p>
            When you search for a location by name, the typed text is sent to
            Nominatim, the public geocoder run by the OpenStreetMap Foundation.
          </p>
          <p><strong>Data sent:</strong> the search text (e.g. "Brooklyn Bridge").</p>
          <p><strong>Operated by:</strong> OpenStreetMap Foundation.</p>
          <p>
            <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">
              Nominatim usage policy
            </a>
          </p>
        </section>

        <section className="license-tool-card">
          <h3>Overpass API — vector data</h3>
          <p>
            When you export as SVG, the app queries the Overpass API to fetch
            geographic data for the selected area (streets, water, parks, buildings).
          </p>
          <p><strong>Data sent:</strong> the coordinates of the selected area (bounding box).</p>
          <p><strong>Operated by:</strong> overpass-api.de (public OSM community service).</p>
          <p>
            <a href="https://overpass-api.de" target="_blank" rel="noreferrer">
              overpass-api.de
            </a>
          </p>
        </section>

        <section className="license-tool-card">
          <h3>OpenFreeMap — map tiles</h3>
          <p>
            The visual map displayed on screen is loaded from OpenFreeMap, which
            serves tiles as you navigate.
          </p>
          <p><strong>Data sent:</strong> the map camera position and zoom level (standard behaviour for any map app).</p>
          <p><strong>Operated by:</strong> OpenFreeMap (open-source project).</p>
          <p>
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
              openfreemap.org
            </a>
          </p>
        </section>
      </div>

      <h2 id="local-storage">Local storage</h2>
      <p>The app saves two things to your browser's <code>localStorage</code>:</p>
      <ul>
        <li>
          <strong>Location history:</strong> coordinates and names from recent searches,
          to make revisiting places easier. This data stays on your device only and
          never leaves it.
        </li>
        <li>
          <strong>Theme preference:</strong> whether you use light or dark mode.
        </li>
      </ul>
      <p>
        You can clear the history at any time using the "Clear history" button in the
        History tab, or by clearing your browser's localStorage.
      </p>

      <h2 id="your-rights">Your rights</h2>
      <p>
        Since we collect no personal data, there is nothing to request from us.
        All stored data lives on your own device and you have full control over it.
      </p>
      <p>
        The app's source code is open and can be audited at any time at{" "}
        <a href="https://github.com/hzguz/gsmap" target="_blank" rel="noreferrer">
          github.com/hzguz/gsmap
        </a>.
      </p>

      <button className="btn license-back" onClick={onBack}>
        Back to the app
      </button>
    </>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
