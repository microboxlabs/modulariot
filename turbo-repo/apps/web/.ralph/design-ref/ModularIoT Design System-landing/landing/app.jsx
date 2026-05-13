// app.jsx — main Modular IoT landing
const { useState: useApp, useEffect: useAppE } = React;

function Header({ lang, setLang, theme, setTheme, t }) {
  return (
    <>
      <div className="promo">
        <span className="promo-pill">{t.promo.tag}</span>
        <span>{t.promo.text}</span>
        <a href="#community">{t.promo.cta}</a>
      </div>
      <header className="header">
        <div className="header-inner">
          <a href="#" className="brand">
            <span className="brand-mark"/>
            modulariot
          </a>
          <nav className="nav">
            <a href="#features">{t.nav.features}</a>
            <a href="#symptom">{t.nav.architecture}</a>
            <a href="#showcase">{t.nav.showcase}</a>
            <a href="#quickstart">{t.nav.quickstart}</a>
            <a href="#community">{t.nav.community}</a>
          </nav>
          <div className="header-actions">
            <button className="lang-toggle" onClick={() => setLang(lang === 'en' ? 'es' : 'en')} title="Toggle language">
              <span className={lang === 'en' ? 'lang-active' : 'lang-inactive'}>EN</span>
              <span className="lang-sep">/</span>
              <span className={lang === 'es' ? 'lang-active' : 'lang-inactive'}>ES</span>
            </button>
            <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'light' ? <I.moon/> : <I.sun/>}
            </button>
            <a className="gh-btn" href="https://github.com" target="_blank" rel="noopener">
              <I.github/> <span>GitHub</span> <span className="star-count">2.4k</span>
            </a>
            <a className="header-cta" href="#final">{t.cta.demo}</a>
          </div>
        </div>
      </header>
    </>
  );
}

function Hero({ t, lang }) {
  return (
    <section className="hero">
      <div className="hero-bg"/>
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot"/>{t.hero.eyebrow}</span>
            <h1 className="display" style={{ marginTop: 18 }}>
              {t.hero.title[0]}<br/>
              <span style={{ color: "var(--ink-3)" }}>{t.hero.title[1]}</span>
            </h1>
            <p className="lede">{t.hero.lede}</p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#final">{t.cta.demo} <I.arrow/></a>
              <a className="btn btn-secondary btn-lg" href="https://github.com" target="_blank" rel="noopener">
                <I.github/> {t.cta.repo}
              </a>
            </div>
            <div className="hero-meta">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="live-dot"/>{t.hero.meta[0]}
              </span>
              <span className="meta-dot"/>
              <span>{t.hero.meta[1]}</span>
              <span className="meta-dot"/>
              <span>{t.hero.meta[2]}</span>
            </div>
          </div>
          <div>
            <HeroVisual lang={lang}/>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee({ t }) {
  const items = ["MINTRAL", "GAMA", "SQM", "CCU", "MELÓN", "SITRANS", "ULTRAMAR", "FLOTA NORTE", "MICROBOXLABS"];
  const doubled = [...items, ...items];
  return (
    <div className="marquee-strip">
      <div className="marquee-label">{t.marquee.label}</div>
      <div className="marquee-track">
        {doubled.map((m, i) => (
          <span key={i} className="marquee-item">
            {m}
            <span className="marquee-tag">/ tenant</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SymptomNarrative({ t }) {
  return (
    <section id="symptom">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow"><span className="eyebrow-dot"/>{t.symptom.eyebrow}</span>
          <h2 className="display" style={{ marginTop: 18 }}>{t.symptom.title}</h2>
          <p className="lede">{t.symptom.lede}</p>
        </div>
        <div className="symptom-stage">
          {t.symptom.steps.map((step, i) => (
            <div key={i} className="symptom-step">
              <div className="step-eyebrow">{step.eyebrow}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-meta">{step.body}</div>
              <div className="step-body">
                {step.rows.map((r, ri) => (
                  <div key={ri} className="row" style={{ animationDelay: `${ri * 0.15}s` }}>
                    <span className="row-dot" style={{
                      background: ["#3F83F8", "#76A9FA", "#F59E0B", "#0E9F6E", "#6B7280"][i]
                    }}/>
                    {r}
                  </div>
                ))}
              </div>
              {i < t.symptom.steps.length - 1 && (
                <div className="flow-arrow"><I.arrow/></div>
              )}
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 32, padding: "16px 20px", background: "var(--surface-2)",
          border: "1px solid var(--hairline)", borderRadius: 10,
          display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: "var(--ink-2)"
        }}>
          <span style={{
            display: "inline-flex", padding: "2px 8px", borderRadius: 999,
            background: "var(--accent-soft)", color: "var(--accent)",
            fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase"
          }}>Insight</span>
          <span>{t.symptom.footnote}</span>
        </div>
      </div>
    </section>
  );
}

function Bento({ t }) {
  const cards = t.bento.cards;
  const layouts = ["b-3", "b-3", "b-2", "b-2", "b-2", "b-6"];
  const visuals = [SymptomVisual, IngestVisual, OrchestVisual, DashVisual, EvidenceVisual, OssVisual];
  return (
    <section id="features" className="alt">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow"><span className="eyebrow-dot"/>{t.bento.eyebrow}</span>
          <h2 className="display" style={{ marginTop: 18 }}>{t.bento.title}</h2>
          <p className="lede">{t.bento.lede}</p>
        </div>
        <div className="bento">
          {cards.map((c, i) => {
            const V = visuals[i];
            return (
              <div key={i} className={`bento-card ${layouts[i]}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="bento-title">{c.title}</div>
                    <div className="bento-body">{c.body}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--ink-3)", background: "var(--surface-2)", padding: "3px 8px", borderRadius: 999,
                    border: "1px solid var(--hairline)"
                  }}>{c.tag}</span>
                </div>
                <div className="bento-visual"><V/></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Bento mini visuals
function SymptomVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {[
        { name: "Driver fatigue", sev: 2, color: "#F59E0B", state: "open" },
        { name: "Geofence exit", sev: 3, color: "#E11D48", state: "open" },
        { name: "Engine overheat", sev: 1, color: "#3F83F8", state: "watch" },
      ].map(s => (
        <div key={s.name} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 8
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }}/>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-1)", flex: 1 }}>{s.name}</span>
          <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "ui-monospace, monospace" }}>{s.state} · sev {s.sev}</span>
        </div>
      ))}
    </div>
  );
}
function IngestVisual() {
  return (
    <div style={{ marginTop: 8, padding: 14, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
      <div><span style={{ color: "var(--ink-4)" }}>POST</span> /v1/signals</div>
      <div><span style={{ color: "var(--accent)" }}>{`{ device: "T-04", lat: 23.6438,`}</span></div>
      <div style={{ paddingLeft: 16 }}><span style={{ color: "var(--accent)" }}>{`speed: 87, ts: 1730932... }`}</span></div>
      <div style={{ marginTop: 8, color: "var(--ink-3)" }}>→ behavior.detected · 47ms</div>
    </div>
  );
}
function OrchestVisual() {
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      {["sms → supervisor", "task → tower", "trip.hold ack"].map(x => (
        <div key={x} style={{
          padding: "8px 10px", background: "var(--surface-2)", border: "1px solid var(--hairline)",
          borderRadius: 6, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-2)",
          display: "flex", justifyContent: "space-between"
        }}>
          <span>{x}</span><span style={{ color: "var(--action)" }}>ok</span>
        </div>
      ))}
    </div>
  );
}
function DashVisual() {
  return (
    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, height: 130 }}>
      {[1, 2, 3, 4].map(n => (
        <div key={n} style={{
          background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6,
          padding: 8, display: "flex", flexDirection: "column", justifyContent: "space-between"
        }}>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", fontFamily: "ui-monospace, monospace" }}>VJ-48{20 - n}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-1)", fontVariantNumeric: "tabular-nums" }}>{(94 - n * 7)}%</div>
        </div>
      ))}
    </div>
  );
}
function EvidenceVisual() {
  return (
    <div style={{ marginTop: 8, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-2)" }}>
      {["14:32:08 sms.sent", "14:32:11 task.created", "14:32:14 ack.O.Mendoza", "14:32:21 hold.released"].map(l => (
        <div key={l} style={{ padding: "4px 0", borderBottom: "1px dashed var(--hairline)" }}>
          <span style={{ color: "var(--ink-4)" }}>›</span> {l}
        </div>
      ))}
    </div>
  );
}
function OssVisual() {
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--ink-2)", padding: "8px 12px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
          $ helm install modulariot modulariot/platform
        </div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--action)", padding: "8px 12px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
          ✓ deployed in 3m 14s · your cluster
        </div>
      </div>
      <div style={{
        width: 64, height: 64, borderRadius: 12, background: "var(--ink-1)",
        display: "grid", placeItems: "center", color: "var(--page-bg)", flexShrink: 0
      }}>
        <I.github/>
      </div>
    </div>
  );
}

function Framework({ t }) {
  const iconFor = (kind) => ({
    protocol: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    stream: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M3 6c4 0 4 4 8 4s4-4 8-4M3 14c4 0 4 4 8 4s4-4 8-4"/></svg>,
    store: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>,
    workflow: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 7.5l3 8M16.5 7.5l-3 8"/></svg>,
    cloud: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M17 19a4 4 0 100-8 5 5 0 00-9.6 1.4A3.5 3.5 0 008 19h9z"/></svg>,
  })[kind];
  return (
    <section className="framework compact">
      <div className="wrap" style={{ textAlign: "center" }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--ink-1)", letterSpacing: "-0.01em" }}>{t.framework.title}</h3>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 8, marginBottom: 0 }}>{t.framework.lede}</p>
        <div className="framework-grid">
          {t.framework.items.map((it, i) => (
            <div key={i} className="framework-item">
              {iconFor(it.kind)}
              <span className="fw-label">{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase({ t, lang }) {
  return (
    <section id="showcase">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow"><span className="eyebrow-dot"/>{t.showcase.eyebrow}</span>
          <h2 className="display" style={{ marginTop: 18 }}>{t.showcase.title}</h2>
          <p className="lede">{t.showcase.lede}</p>
        </div>
        <div className="showcase">
          <KanbanShowcase lang={lang}/>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <MapShowcase lang={lang}/>
            <ul className="showcase-list" style={{ padding: 0, margin: 0 }}>
              {t.showcase.bullets.map((b, i) => (
                <li key={i}>
                  <span className="check"><I.check/></span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-1)" }}>{b.t}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>{b.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickStart({ t }) {
  const iconFor = { helm: <I.helm/>, n8n: <I.flow/>, api: <I.api/> };
  return (
    <section id="quickstart" className="alt">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow"><span className="eyebrow-dot"/>{t.quickstart.eyebrow}</span>
          <h2 className="display" style={{ marginTop: 18 }}>{t.quickstart.title}</h2>
          <p className="lede">{t.quickstart.lede}</p>
        </div>
        <div className="qs-grid">
          {t.quickstart.cards.map((c, i) => (
            <a key={i} className="qs-card" href="#">
              <div className="qs-icon">{iconFor[c.icon]}</div>
              <div className="qs-title">{c.title}</div>
              <div className="qs-body">{c.body}</div>
              <div className="qs-meta">
                <span>{c.meta}</span>
                <I.arrow/>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Community({ t }) {
  return (
    <section id="community">
      <div className="wrap">
        <div className="community-card">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <span className="eyebrow"><span className="eyebrow-dot"/>{t.community.eyebrow}</span>
              <h2 className="display" style={{ marginTop: 14, fontSize: "clamp(28px, 3.4vw, 38px)" }}>{t.community.title}</h2>
              <p className="lede" style={{ fontSize: 16, marginTop: 12 }}>{t.community.lede}</p>
              <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                <a className="btn btn-primary" href="https://github.com" target="_blank" rel="noopener">
                  <I.github/> {t.community.cta}
                </a>
                <a className="btn btn-secondary" href="#">{t.cta.arch}</a>
              </div>
            </div>
            <div className="community-grid" style={{ flex: "0 0 auto", minWidth: 380 }}>
              {t.community.items.map((it, i) => (
                <div key={i} className="community-item">
                  <div className="ci-stat">{it.stat}</div>
                  <div className="ci-label">{it.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ t }) {
  return (
    <section id="final" className="compact">
      <div className="wrap">
        <div className="final-cta">
          <h2 className="display" style={{ fontSize: "clamp(32px, 4.4vw, 52px)" }}>{t.final.title}</h2>
          <p className="lede" style={{ marginTop: 16, fontSize: 17 }}>{t.final.lede}</p>
          <div style={{ display: "inline-flex", gap: 12, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
            <a className="btn btn-primary btn-lg" href="#">{t.cta.demo} <I.arrow/></a>
            <a className="btn btn-secondary btn-lg" href="https://github.com" target="_blank" rel="noopener"><I.github/> {t.cta.repo}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ t }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a href="#" className="brand" style={{ fontSize: 16 }}>
              <span className="brand-mark"/>modulariot
            </a>
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 14, maxWidth: 280, lineHeight: 1.6 }}>{t.foot.tag}</p>
            <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
              <a className="gh-btn" href="https://github.com" target="_blank" rel="noopener">
                <I.github/> 2.4k
              </a>
            </div>
          </div>
          <div><h4>Product</h4><ul>{t.foot.product.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul></div>
          <div><h4>Developers</h4><ul>{t.foot.developers.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul></div>
          <div><h4>Company</h4><ul>{t.foot.company.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul></div>
          <div><h4>Resources</h4><ul>{t.foot.resources.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul></div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 MicroboxLabs · Apache-2.0</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot"/> All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "lang": "en",
  "density": "comfortable",
  "showPromo": true,
  "accent": "#1C64F2"
}/*EDITMODE-END*/;

function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const t = useT(tw.lang);

  useAppE(() => {
    document.documentElement.setAttribute('data-theme', tw.theme);
    document.documentElement.setAttribute('data-density', tw.density);
    document.documentElement.style.setProperty('--accent', tw.accent);
    // derive accent-soft as a translucent version
    const r = parseInt(tw.accent.slice(1,3),16);
    const g = parseInt(tw.accent.slice(3,5),16);
    const b = parseInt(tw.accent.slice(5,7),16);
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.10)`);
  }, [tw.theme, tw.density, tw.accent]);

  return (
    <>
      {tw.showPromo && (
        <div className="promo">
          <span className="promo-pill">v0.9 Alpha</span>
          <span>{tw.lang === 'es' ? 'Modular IoT se suma al CNCF Sandbox' : 'Modular IoT joins the CNCF Sandbox track'}</span>
          <a href="#community">{tw.lang === 'es' ? 'Lee el anuncio →' : 'Read the announcement →'}</a>
        </div>
      )}
      <header className="header">
        <div className="header-inner">
          <a href="#" className="brand">
            <span className="brand-mark"/>
            modulariot
          </a>
          <nav className="nav">
            <a href="#features">{t.nav.features}</a>
            <a href="#symptom">{t.nav.architecture}</a>
            <a href="#showcase">{t.nav.showcase}</a>
            <a href="#quickstart">{t.nav.quickstart}</a>
            <a href="#community">{t.nav.community}</a>
          </nav>
          <div className="header-actions">
            <button className="lang-toggle" onClick={() => setTweak('lang', tw.lang === 'en' ? 'es' : 'en')}>
              <span className={tw.lang === 'en' ? 'lang-active' : 'lang-inactive'}>EN</span>
              <span className="lang-sep">/</span>
              <span className={tw.lang === 'es' ? 'lang-active' : 'lang-inactive'}>ES</span>
            </button>
            <button className="theme-toggle" onClick={() => setTweak('theme', tw.theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme">
              {tw.theme === 'light' ? <I.moon/> : <I.sun/>}
            </button>
            <a className="gh-btn" href="https://github.com" target="_blank" rel="noopener">
              <I.github/> <span>GitHub</span> <span className="star-count">2.4k</span>
            </a>
            <a className="header-cta" href="#final">{t.cta.demo}</a>
          </div>
        </div>
      </header>
      <main>
        <Hero t={t} lang={tw.lang}/>
        <Marquee t={t}/>
        <SymptomNarrative t={t}/>
        <Bento t={t}/>
        <Framework t={t}/>
        <Showcase t={t} lang={tw.lang}/>
        <QuickStart t={t}/>
        <Community t={t}/>
        <FinalCTA t={t}/>
      </main>
      <Footer t={t}/>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakRadio label="Theme" value={tw.theme} onChange={(v)=>setTweak('theme', v)} options={[{label:'Light',value:'light'},{label:'Dark',value:'dark'}]}/>
          <TweakRadio label="Language" value={tw.lang} onChange={(v)=>setTweak('lang', v)} options={[{label:'English',value:'en'},{label:'Español',value:'es'}]}/>
          <TweakRadio label="Density" value={tw.density} onChange={(v)=>setTweak('density', v)} options={[{label:'Comfortable',value:'comfortable'},{label:'Compact',value:'compact'}]}/>
        </TweakSection>
        <TweakSection title="Brand">
          <TweakColor label="Accent" value={tw.accent} onChange={(v)=>setTweak('accent', v)} options={['#1C64F2','#FFB017','#0E9F6E','#E11D48']}/>
        </TweakSection>
        <TweakSection title="Layout">
          <TweakToggle label="Show promo ribbon" value={tw.showPromo} onChange={(v)=>setTweak('showPromo', v)}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
