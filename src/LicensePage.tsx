import { useEffect, useState } from "react";
import { Logo } from "./Logo";

type Props = {
  onBack: () => void;
  uiTheme: "light" | "dark";
  onToggleTheme: () => void;
  embedded?: boolean;
};

const ATTRIBUTION_TEXT =
  "Map data (c) OpenStreetMap contributors, licensed under the Open Database License (ODbL). Basemap (c) OpenFreeMap and OpenMapTiles. Generated with gsmap.";

const TOC: { id: string; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "tools", label: "Tools used" },
  { id: "attribution", label: "Attribution" },
  { id: "commercial-use", label: "Commercial use" },
  { id: "services", label: "Service limits" },
  { id: "disclaimer", label: "Disclaimer" },
];

export function LicensePage({ onBack, uiTheme, onToggleTheme, embedded = false }: Props) {
  const [copied, setCopied] = useState(false);
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
  }, []);

  function copyAttribution() {
    navigator.clipboard.writeText(ATTRIBUTION_TEXT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="license-page">
      {!embedded && (
        <div className="license-topbar">
          <button className="btn btn-ghost" onClick={onBack} aria-label="Back to the app">
            Back
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
              <div className="license-toc-title">On this page</div>
              <ul>
                {TOC.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={"toc-link" + (activeId === item.id ? " toc-link-active" : "")}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollTo(item.id);
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : (
          <nav className="license-toc" aria-label="Table of contents">
            <div className="license-toc-title">On this page</div>
            <ul>
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={"toc-link" + (activeId === item.id ? " toc-link-active" : "")}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo(item.id);
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="license-content">
          <h1>Licensing &amp; Commercial Use</h1>
          <p className="lede">
            This page keeps the practical parts only: what each tool in the app does,
            which license it uses, what attribution matters, and where public-service
            limits begin.
          </p>

          <div className="license-summary" id="summary" aria-label="Licensing summary">
            <table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>License / terms</th>
                  <th>Practical note</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>OpenStreetMap data</td>
                  <td>ODbL 1.0</td>
                  <td>Commercial use is allowed, but attribution is required.</td>
                </tr>
                <tr>
                  <td>OpenFreeMap themes</td>
                  <td>MIT styles + OSM-based data</td>
                  <td>Good for commercial work, but attribution still matters in published results.</td>
                </tr>
                <tr>
                  <td>Nominatim search API</td>
                  <td>Public service + usage policy</td>
                  <td>Fine for light/manual use, not for heavy production traffic.</td>
                </tr>
                <tr>
                  <td>MapLibre GL JS</td>
                  <td>BSD-3-Clause</td>
                  <td>Open-source renderer with business-friendly licensing.</td>
                </tr>
                <tr>
                  <td>gsmap app code</td>
                  <td>MIT</td>
                  <td>The app code itself is permissive and commercial-friendly.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="callout">
            <strong>Short answer:</strong> yes, you can sell work made with gsmap
            exports. The important parts are attribution and not treating public OSM
            services like unlimited production infrastructure.
          </div>

          <h2 id="tools">Tools used</h2>
          <div className="license-tool-list">
            <section className="license-tool-card">
              <h3>OpenStreetMap data</h3>
              <p>
                This is the geographic source behind the map features. Roads, water,
                buildings, and parks ultimately come from OpenStreetMap contributors.
              </p>
              <p>
                <strong>License:</strong> ODbL 1.0.
              </p>
              <p>
                <strong>What matters:</strong> commercial use is allowed, but you need
                visible attribution when publishing the result.
              </p>
              <p>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  Official copyright page
                </a>
              </p>
            </section>

            <section className="license-tool-card">
              <h3>OpenFreeMap themes</h3>
              <p>
                These are the visual map styles used for the preview, including themes
                like Positron and Liberty.
              </p>
              <p>
                <strong>License:</strong> the OpenFreeMap styles project is MIT. The
                hosted map still depends on OSM-based data and attribution obligations.
              </p>
              <p>
                <strong>What matters:</strong> the style layer is business-friendly, but
                the final map still inherits attribution duties from its underlying data.
              </p>
              <p>
                <a href="https://github.com/hyperknot/openfreemap-styles" target="_blank" rel="noreferrer">
                  OpenFreeMap styles repository
                </a>
              </p>
            </section>

            <section className="license-tool-card">
              <h3>Nominatim search API</h3>
              <p>
                This is the place-search service used when the user searches by name.
              </p>
              <p>
                <strong>License / terms:</strong> OSM data under ODbL, plus a public
                usage policy for the shared service.
              </p>
              <p>
                <strong>What matters:</strong> user-triggered light use is fine, but the
                public instance is not meant for bulk or heavy commercial traffic.
              </p>
              <p>
                <a
                  href="https://operations.osmfoundation.org/policies/nominatim/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official usage policy
                </a>
              </p>
            </section>

            <section className="license-tool-card">
              <h3>MapLibre GL JS</h3>
              <p>
                This is the rendering engine used to display and interact with the map
                in the browser.
              </p>
              <p>
                <strong>License:</strong> BSD-3-Clause.
              </p>
              <p>
                <strong>What matters:</strong> it is a permissive open-source library,
                so it is not the risky part of the stack from a commercial-use point of
                view.
              </p>
              <p>
                <a href="https://github.com/maplibre/maplibre-gl-js" target="_blank" rel="noreferrer">
                  MapLibre GL JS repository
                </a>
              </p>
            </section>

            <section className="license-tool-card">
              <h3>gsmap app code</h3>
              <p>
                This is the application code that ties the UI, export flow, and map
                behavior together.
              </p>
              <p>
                <strong>License:</strong> MIT.
              </p>
              <p>
                <strong>What matters:</strong> the app code itself is permissive. The
                obligations mostly come from the map data and public services it uses.
              </p>
            </section>
          </div>

          <h3 id="attribution" style={{ marginTop: 28 }}>
            Attribution text
          </h3>
          <div className="credit-block">
            {ATTRIBUTION_TEXT}
            <button
              type="button"
              className={"copy-btn" + (copied ? " copied" : "")}
              onClick={copyAttribution}
              aria-label="Copy attribution text"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <h2 id="commercial-use">Commercial use</h2>
          <ul>
            <li>Exports from this app can be used in paid work, marketing, print, and digital products.</li>
            <li>The practical restriction is not resale, but attribution and service usage policy.</li>
            <li>OpenStreetMap data allows commercial reuse as long as attribution rules are respected.</li>
            <li>MapLibre and the app code use permissive open-source licenses.</li>
          </ul>

          <h2 id="services">Service limits</h2>
          <ul>
            <li>This app uses the public Nominatim service for place search.</li>
            <li>That public service has limited capacity and is not intended for heavy automated traffic.</li>
            <li>If this grows into a high-volume production workflow, switch to your own geocoder or a paid provider.</li>
            <li>The preview basemap is also a hosted external service, so critical workloads should consider self-hosting.</li>
          </ul>

          <h2 id="disclaimer">Disclaimer</h2>
          <p style={{ color: "var(--text-muted)" }}>
            This page is a practical summary, not legal advice. For unusual use cases
            or large-scale deployments, read the linked licenses and service policies
            directly.
          </p>

          <button className="btn license-back" onClick={onBack}>
            Back to the app
          </button>
        </div>
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
