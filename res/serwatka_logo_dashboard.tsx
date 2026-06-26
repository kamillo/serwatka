import React, { useState } from 'react';

const COLOR_PRESETS = [
  {
    id: 'emerald-gold',
    name: 'Serwatka Aurum (Złoty Szmaragd)',
    primary: '#10B981',   // Emerald
    secondary: '#F59E0B', // Amber/Gold
    accent: '#06B6D4',    // Cyan
    bg: '#064E3B',        // Deep forest green
    text: '#ECFDF5'
  },
  {
    id: 'cyan-blue',
    name: 'Liquid Tech (Neonowy Błękit)',
    primary: '#06B6D4',   // Cyan
    secondary: '#3B82F6', // Blue
    accent: '#8B5CF6',    // Purple
    bg: '#0F172A',        // Slate 900
    text: '#F8FAFC'
  },
  {
    id: 'nordic-whey',
    name: 'Nordic Clean (Minimalistyczny Beż/Szary)',
    primary: '#D97706',   // Ochre
    secondary: '#78350F', // Warm brown
    accent: '#10B981',    // Emerald
    bg: '#FAFAF9',        // Warm white
    text: '#1C1917'       // Dark stone
  },
  {
    id: 'modern-dark',
    name: 'Phantom Orchid (Abstrakcyjny Fiolet)',
    primary: '#8B5CF6',   // Purple
    secondary: '#EC4899', // Pink
    accent: '#3B82F6',    // Blue
    bg: '#030712',        // Gray 950
    text: '#F3F4F6'
  }
];

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState(COLOR_PRESETS[0]);
  const [showTypography, setShowTypography] = useState(true);
  const [typographyStyle, setTypographyStyle] = useState('modern'); // 'modern' | 'serif' | 'minimal'
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [customPrimary, setCustomPrimary] = useState(COLOR_PRESETS[0].primary);
  const [customSecondary, setCustomSecondary] = useState(COLOR_PRESETS[0].secondary);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'mockups' | 'code'

  // Sync custom colors when preset changes
  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setCustomPrimary(preset.primary);
    setCustomSecondary(preset.secondary);
  };

  const generateSVGCode = (isDownload = false) => {
    const fontStyle = typographyStyle === 'serif' 
      ? "font-family: 'Playfair Display', Georgia, serif; font-weight: 700;" 
      : typographyStyle === 'minimal'
      ? "font-family: 'Courier New', monospace; font-weight: 400; letter-spacing: 0.25em;"
      : "font-family: 'Inter', system-ui, -apple-system, sans-serif; font-weight: 800; letter-spacing: -0.02em;";

    const subFont = "font-family: 'Inter', system-ui, sans-serif; font-weight: 500; letter-spacing: 0.15em;";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${showTypography ? '500 160' : '160 160'}" width="100%" height="100%">
  <defs>
    <!-- Gradient dla głównej dynamicznej pętli płynu (Serwatki) -->
    <linearGradient id="serwatkaFluidGrad" x1="10%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="${customPrimary}" />
      <stop offset="60%" stop-color="${customSecondary}" />
      <stop offset="100%" stop-color="${selectedPreset.accent}" />
    </linearGradient>
    
    <!-- Gradient dla wewnętrznej czystej kropli / rdzenia wartości -->
    <linearGradient id="pureCoreGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${selectedPreset.accent}" stop-opacity="0.8" />
      <stop offset="100%" stop-color="${customPrimary}" stop-opacity="0.2" />
    </linearGradient>

    <!-- Filtr poświaty dla nowoczesnego, płynnego wyglądu (Neon Glow) -->
    <filter id="wheyGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- TŁO (opcjonalne, w eksporcie przezroczyste, tu dla podglądu) -->
  <!-- <rect width="100%" height="100%" fill="transparent" /> -->

  <!-- GRUPA SYMBOLU (LOGOMARK) -->
  <g transform="translate(10, 10)">
    ${glowEnabled ? `
    <!-- Efekt delikatnego neonu w tle dla nowoczesności -->
    <g filter="url(#wheyGlow)" opacity="0.45">
      <!-- Zewnętrzna abstrakcyjna kropla tworząca pętlę 'S' -->
      <path d="M 70 20 
               C 105 20, 125 50, 125 80 
               C 125 115, 95 135, 70 135 
               C 40 135, 20 110, 25 80 
               C 28 62, 42 45, 58 35
               C 62 32, 68 35, 65 40
               C 55 55, 48 70, 50 85
               C 53 105, 72 118, 90 110
               C 105 102, 110 80, 100 65
               C 90 50, 75 35, 70 20 Z" 
            fill="url(#serwatkaFluidGrad)" />
      
      <!-- Wewnętrzny, wznoszący rdzeń (czysta esencja / Net Worth) -->
      <path d="M 70 45
               C 85 60, 95 75, 90 92
               C 86 105, 72 112, 60 102
               C 50 92, 58 75, 70 45 Z" 
            fill="url(#pureCoreGrad)" />
    </g>` : ''}

    <!-- GŁÓWNY SYMBOL (OSTRY I CZYSTY) -->
    <!-- Zewnętrzna abstrakcyjna kropla tworząca pętlę 'S' -->
    <path d="M 70 20 
             C 105 20, 125 50, 125 80 
             C 125 115, 95 135, 70 135 
             C 40 135, 20 110, 25 80 
             C 28 62, 42 45, 58 35
             C 62 32, 68 35, 65 40
             C 55 55, 48 70, 50 85
             C 53 105, 72 118, 90 110
             C 105 102, 110 80, 100 65
             C 90 50, 75 35, 70 20 Z" 
          fill="url(#serwatkaFluidGrad)" />
    
    <!-- Wewnętrzny, wznoszący rdzeń (czysta esencja / Net Worth) -->
    <path d="M 70 45
             C 85 60, 95 75, 90 92
             C 86 105, 72 112, 60 102
             C 50 92, 58 75, 70 45 Z" 
          fill="url(#pureCoreGrad)" />
          
    <!-- Minimalistyczny akcent - punkt szczytowy płynu -->
    <circle cx="70" cy="20" r="3" fill="${selectedPreset.accent}" />
  </g>

  ${showTypography ? `
  <!-- TYPOGRAFIA (Nazwa aplikacji i slogan) -->
  <g transform="translate(175, 0)">
    <!-- Nazwa główna -->
    <text x="0" y="85" fill="${selectedPreset.text}" style="${fontStyle}" font-size="44">SERWATKA</text>
    
    <!-- Slogan pod spodem -->
    <text x="3" y="112" fill="${selectedPreset.text}" opacity="0.6" style="${subFont}" font-size="11.5">NET WORTH TRACKER</text>
  </g>
  ` : ''}
</svg>`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateSVGCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSVG = () => {
    const svgContent = generateSVGCode(true);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'serwatka_logo.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center font-bold text-slate-950 text-xs">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Serwatka Studio</h1>
            <p className="text-xs text-slate-400">Interaktywny projektant logo Net Worth</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={handleCopyCode} 
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm font-medium transition flex items-center space-x-2"
          >
            <span>{copied ? 'Copied! ✅' : 'Kopiuj SVG'}</span>
          </button>
          <button 
            onClick={handleDownloadSVG}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition flex items-center space-x-2"
          >
            <span>Pobierz .SVG</span>
          </button>
        </div>
      </header>

      {}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Control Panel */}
        <section className="lg:col-span-5 bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col space-y-6 backdrop-blur">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Wybierz motyw kolorystyczny</h2>
            <div className="space-y-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset)}
                  className={`w-full text-left p-3 rounded-xl transition border flex items-center justify-between ${
                    selectedPreset.id === preset.id 
                      ? 'bg-slate-800/80 border-slate-700' 
                      : 'bg-transparent border-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-slate-200">{preset.name}</span>
                    <span className="text-xs text-slate-500">Styl płynny</span>
                  </div>
                  <div className="flex space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primary }} />
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.secondary }} />
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.accent }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-800" />

          {}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Dostosuj barwy (Live)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Główny gradient</label>
                <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <input 
                    type="color" 
                    value={customPrimary} 
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded"
                  />
                  <span className="text-xs font-mono">{customPrimary.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Wznoszący akcent</label>
                <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <input 
                    type="color" 
                    value={customSecondary} 
                    onChange={(e) => setCustomSecondary(e.target.value)}
                    className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded"
                  />
                  <span className="text-xs font-mono">{customSecondary.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Stylizacja i kompozycja</h2>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-300">Dodaj logotyp (Tekst)</span>
              <button 
                onClick={() => setShowTypography(!showTypography)}
                className={`w-12 h-6 rounded-full transition-colors relative ${showTypography ? 'bg-emerald-500' : 'bg-slate-800'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-slate-950 transition-transform ${showTypography ? 'transform translate-x-6' : ''}`} />
              </button>
            </div>

            {showTypography && (
              <div className="mt-3 space-y-2">
                <label className="text-xs text-slate-500">Styl czcionki dla "SERWATKA"</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'modern', label: 'Tech Bold' },
                    { id: 'serif', label: 'Classic Elegance' },
                    { id: 'minimal', label: 'Space Mono' }
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setTypographyStyle(style.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                        typographyStyle === style.id 
                          ? 'bg-slate-800 border-slate-700 text-slate-100' 
                          : 'bg-transparent border-slate-900 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2 mt-2">
              <span className="text-sm text-slate-300">Poświata (Fluid Glow)</span>
              <button 
                onClick={() => setGlowEnabled(!glowEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${glowEnabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-slate-950 transition-transform ${glowEnabled ? 'transform translate-x-6' : ''}`} />
              </button>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Concept explanation */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
            <h3 className="font-bold text-slate-300">🧬 Filozofia tego designu:</h3>
            <p>
              <strong>Serwatka</strong> to ultra-przefiltrowana faza płynna powstała z mleka. Ta sama zasada przyświeca aplikacji finansowej: 
              odrzucamy zbędny szum i skomplikowanie, zostawiając użytkownikowi to, co najcenniejsze i czyste – jego <strong>prawdziwą wartość netto</strong>.
            </p>
            <p>
              Zamiast oklepanych wykresów giełdowych, logo wykorzystuje nowoczesną, organiczną geometrię. Płynna kropla tworzy dynamiczną, wznoszącą się pętlę w kształcie litery <strong>S</strong>.
            </p>
          </div>
        </section>

        {/* Right Preview/Mockup Display Area */}
        <section className="lg:col-span-7 flex flex-col space-y-6">
          
          {/* Tabs header */}
          <div className="flex border-b border-slate-900 bg-slate-900/20 p-1 rounded-xl">
            {[
              { id: 'preview', label: 'Podgląd Logo' },
              { id: 'mockups', label: 'Wizualizacja (Mockup)' },
              { id: 'code', label: 'Kod SVG' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-slate-100 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {}
          {activeTab === 'preview' && (
            <div className="flex-1 bg-slate-900/30 border border-slate-900 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden" style={{ backgroundColor: selectedPreset.bg }}>
              {/* Abstract decorative grid */}
              <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
              
              <div className="w-full max-w-md aspect-video flex items-center justify-center z-10 transition-transform duration-300 hover:scale-105">
                <div dangerouslySetInnerHTML={{ __html: generateSVGCode() }} />
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-[10px] text-slate-500 z-10 uppercase tracking-widest">
                <span>Skala 100% (Wektor)</span>
                <span>Renderowanie przeglądarkowe</span>
              </div>
            </div>
          )}

          {}
          {activeTab === 'mockups' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Mockup 1: Mobile App Icon */}
              <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 mb-4 uppercase">Ikona App Store / Google Play</span>
                
                {/* Simulated Phone Screen Element */}
                <div className="w-24 h-24 rounded-2xl bg-slate-950 p-4 shadow-2xl border border-slate-800 flex items-center justify-center relative group overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-gradient-to-tr from-emerald-500 to-transparent"></div>
                  {/* Dynamic Logo rendering inside (just icon) */}
                  <div className="w-16 h-16 z-10" dangerouslySetInnerHTML={{ 
                    __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
                      <defs>
                        <linearGradient id="m1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="${customPrimary}" />
                          <stop offset="100%" stop-color="${customSecondary}" />
                        </linearGradient>
                      </defs>
                      <path d="M 80 20 C 115 20, 135 50, 135 80 C 135 115, 105 135, 80 135 C 50 135, 30 110, 35 80 C 38 62, 52 45, 68 35 C 72 32, 78 35, 75 40 C 65 55, 58 70, 60 85 C 63 105, 82 118, 100 110 C 115 102, 120 80, 110 65 C 100 50, 85 35, 80 20 Z" fill="url(#m1)" />
                    </svg>` 
                  }} />
                  <span className="absolute bottom-1 right-2 text-[8px] font-bold text-slate-400">1.0</span>
                </div>
                <span className="text-xs text-slate-300 mt-4 font-semibold">serwatka.app</span>
              </div>

              {/* Mockup 2: Premium Credit Card */}
              <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 mb-4 uppercase">Karta płatnicza (Metal Edition)</span>
                
                {/* Premium Credit Card Element */}
                <div className="w-72 h-44 rounded-xl bg-gradient-to-br from-slate-900 to-black p-5 shadow-2xl border border-slate-800/80 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                  
                  <div className="flex justify-between items-start">
                    {/* Tiny chip */}
                    <div className="w-8 h-6 rounded bg-amber-400/20 border border-amber-400/40"></div>
                    {/* Logo (Icon only) */}
                    <div className="w-10 h-10" dangerouslySetInnerHTML={{ 
                      __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
                        <path d="M 80 20 C 115 20, 135 50, 135 80 C 135 115, 105 135, 80 135 C 50 135, 30 110, 35 80 C 38 62, 52 45, 68 35 C 72 32, 78 35, 75 40 C 65 55, 58 70, 60 85 C 63 105, 82 118, 100 110 C 115 102, 120 80, 110 65 C 100 50, 85 35, 80 20 Z" fill="${customPrimary}" />
                      </svg>` 
                    }} />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 tracking-wider">NET WORTH ELITE</span>
                    <div className="text-xs font-mono tracking-widest text-slate-300">•••• •••• •••• 9924</div>
                    <div className="text-[9px] text-slate-400 font-medium">JAN KOWALSKI</div>
                  </div>
                </div>
              </div>

              {/* Mockup 3: Premium Landing Page Header */}
              <div className="md:col-span-2 bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] relative overflow-hidden">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 mb-3 uppercase">Pulpit nawigacyjny aplikacji webowej</span>
                
                {/* Header preview */}
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
                  <div className="w-36">
                    <div dangerouslySetInnerHTML={{ __html: generateSVGCode() }} />
                  </div>
                  <div className="flex items-center space-x-4 text-xs">
                    <span className="text-emerald-400 font-semibold">Dashboard</span>
                    <span className="text-slate-400">Aktywa</span>
                    <span className="text-slate-400">Analizy</span>
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700"></div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col bg-slate-900/60 border border-slate-900 rounded-2xl p-6 relative">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-400 font-semibold font-mono">Format: SVG (XML Vector Document)</span>
                <button 
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 transition"
                >
                  {copied ? 'Skopiowano!' : 'Kopiuj kod'}
                </button>
              </div>
              <textarea
                readOnly
                value={generateSVGCode()}
                className="flex-1 w-full bg-slate-950 text-slate-300 font-mono text-xs p-4 rounded-xl border border-slate-800 resize-none h-[300px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

        </section>

      </main>

      {}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 Serwatka. Wszelkie prawa do wektorów zastrzeżone. Zaprojektowano dla aplikacji FinTech Net Worth.</p>
      </footer>

    </div>
  );
}