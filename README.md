# Regen · prototype

Smartphone-prototype van een buienapp op basis van fijnmazige weermodellen. Drie bestanden, geen build-stap:

- `index.html` – schermopbouw, tabbar, locatiepaneel
- `app.css` – ontwerp (licht en donker, telefoonkader op desktop)
- `app.js` – datalaag, grafiekmotor, vier tabs, zelftests

## Starten

Open `index.html` via een lokale webserver (bijvoorbeeld `..\buienalarm\serve.ps1 -Root .. -Port 8765` en dan `http://localhost:8765/regenapp/`). Rechtstreeks openen als bestand werkt in Chrome ook, omdat beide API's externe aanroepen toestaan.

Zelftests: `index.html?test=1` toont een paneel met 22 tests (parsen, vergelijkingslogica, schaalverdeling, grafiekmotor). Donker thema forceren: `?theme=dark`.

## Databronnen

| Laag | Bron | Resolutie | Horizon |
|---|---|---|---|
| Nowcast neerslag | Buienradar raintext (radar) | 5 min | 2 uur |
| Hoofdmodel | KNMI UWC-West HARMONIE-AROME Cy43, NL-domein | 2 km, per uur | ±58 uur |
| Vergelijking | DWD ICON-D2 | 2,2 km, per uur | ±48 uur |
| Vergelijking | Météo-France AROME France HD | 1,5 km, per uur | ±48 uur |

Modellen komen via Open-Meteo in één aanroep (`models=knmi_harmonie_arome_netherlands,icon_d2,meteofrance_arome_france_hd`). Open-Meteo is gratis voor niet-commercieel gebruik; de data zelf is CC BY 4.0.

## Wetenschappelijke keuzes

- **Neerslag per uur is een som over het voorafgaande uur.** Open-Meteo labelt de waarde op het eind van het uur; de app verschuift de staaf naar het begin, zodat "14:00" betekent 14:00–15:00. De eerste staaf is het lopende uur.
- **Radarwaarden zijn intensiteiten** (mm/u op dat moment). De som over 2 uur is Σ intensiteit / 12.
- **Raintext-formule:** mm/u = 10^((waarde − 109) / 32); 0 betekent droog.
- **Geen kansen.** Alle drie de modellen zijn deterministisch. Een kans vereist een ensemble.
- **Toepasbaarheid per locatie:** een model telt mee als het vanaf nu minstens 12 uur met waarden levert. Buiten zijn domein geeft Open-Meteo `null`.
- **Afwijking tussen modellen (regen-tab):** vergeleken over maximaal 48 uur.
  - *Hoeveelheid:* som verschilt ≥ 1 mm én verhouding ≥ 1,5.
  - *Timing:* ≥ 0,5 mm in een uur waar het andere model in dat uur en beide buururen < 0,1 mm geeft. Een bui die één uur verschoven is, geeft dus geen melding.
- **AROME levert geen totale bewolking.** Die wordt afgeleid uit laag/midden/hoog met random overlap: 1 − (1−L)(1−M)(1−H), en zo gemarkeerd in de legenda.
- **Windrichting** is meteorologisch (waar de wind vandaan komt); de pijlen in de grafiek wijzen waar de wind heen waait. Beaufort volgt uit de uursnelheid in km/u.
- **Tijdzone:** Buienradar levert Nederlandse tijd zonder zone-aanduiding; de browser wordt in Nederlandse tijd verondersteld.

## Ontwerp

Apple-achtige opbouw: grote titel, kaarten, segmented control, onderste tabbar met blur, locatie als bottom sheet. Grafieken volgen vaste regels: één y-as, dunne staven met 2 px tussenruimte en ronde top, legenda zodra er twee reeksen zijn, één direct label op de piek, tekst nooit in de reekskleur. Modelkleuren zijn vast: HARMONIE blauw, ICON-D2 oranje, AROME groen (kleurenblind-veilig gevalideerde set).

## Zon en schemer

De achtergrond van elke grafiek volgt de zonshoogte, lokaal berekend met het NOAA-algoritme (Meeus) voor de gekozen locatie; er is geen extra API nodig. Kleurverloop per zonshoogte: dag boven +8°, gouden uur rond de horizon, dan burgerlijke (tot −6°), nautische (tot −12°) en astronomische schemer (tot −18°), daarna nacht. Zonsopkomst en -ondergang (−0,833°, met refractie) staan als zonnetjes boven de grafiek; de regel onder de titel geeft op, onder en de burgerlijke schemer van vandaag. De tooltip noemt de fase en de zonshoogte.

Controle: de berekende tijden voor Amsterdam, Groningen en Maastricht liggen binnen 3 minuten van de Open-Meteo-waarden voor 31 oktober 2026 (zelftest). De tests bewaken ook dat de burgerlijke schemer in juni langer is dan in oktober (op 52° NB is de schemer het langst rond midzomer en het kortst rond de equinoxen) en dat de daglengte juni > oktober > december is.

## Verificatie (map `verificatie/`)

`fetch.sh` haalt uitgegeven verwachtingen uit het Open-Meteo-archief (HARMONIE NL, ICON-D2, AROME HD) en KNMI-uurwaarnemingen (RH, DR, T, FH) voor negen stations; `index.html` + `verify.js` berekenen de scores in de browser. Opzet: vier seizoensperiodes van 30 dagen (nov 2025, jan, apr, jul 2026) op kortste aanlooptijd, plus de laatste 92 dagen op 0–24 u én 24–48 u vooruit. Scores: MAE/bias per uur en per dagsom, correlatie, trefkans/loos alarm/ETS strikt en met ±1 uur tolerantie, temperatuur- en wind-MAE. Significantie via blok-bootstrap per station-dag (1000 herhalingen, 95%-BI) op het verschil met HARMONIE.

Conclusies (31 oktober 2026):
- **Kortste aanlooptijd is oneerlijk voor HARMONIE-neerslag:** het archief bevat van het uurlijks draaiende HARMONIE vrijwel alleen de eerste uren van elke run, met spin-up-neerslag (verwacht ÷ gemeten 1,2–2,1 in deel A, maar 1,05 op 24–48 u).
- **24–48 u vooruit (de horizon van de app):** HARMONIE heeft de kleinste dagsomfout (6,0 mm tegen 9,0–9,1 mm) en de beste regen-ja/nee-score; het verschil met AROME is significant, met ICON-D2 niet. ICON-D2 verslechtert het snelst met aanlooptijd.
- **Temperatuur:** HARMONIE heeft een warme bias (+0,3 tot +0,6 °C) en een significant grotere fout dan ICON-D2 en AROME bij elke aanlooptijd. Voor de temperatuurtab is ICON-D2 het beste model.
- **Wind:** verschillen klein (0,85–1,0 m/s); ICON-D2 iets te zwak, AROME iets te sterk.
- **Zomerbuien (jul 2026):** alle modellen zwak (ETS ±1 u ≈ 0,15 strikt); ICON-D2 gaf maar 38% van de gemeten hoeveelheid, AROME 127%.

## Zoomen op de tijdschaal

De 2,5-daagse grafieken delen één horizon-instelling: "nu t/m x uur vooruit". Het begin staat altijd op het huidige uur; zoomen verandert alleen het einde. Instellen kan met twee vingers op een grafiek (knijpen = uitzoomen, uit elkaar = inzoomen), met ctrl+scroll of trackpad-pinch op desktop, of met de presets 12 u · 24 u · 48 u · Alles. Bereik 6 uur tot de modelhorizon. De keuze wordt in `localStorage` bewaard (`regen.horizon`) en is de volgende keer de standaard.

## Installeren op je telefoon

De app is statisch: zet de map `regenapp/` op een HTTPS-host (GitHub Pages, Cloudflare Pages, Netlify) en open de link in Safari of Chrome. Kies "Zet op beginscherm". `manifest.json` zorgt voor naam, icoon (`icon.svg`) en schermvullende weergave; `sw.js` cachet de app-schil en het laatste API-antwoord, zodat de app zonder netwerk opent met de laatst opgehaalde data. De service worker registreert alleen op HTTPS. iOS gebruikt geen SVG als beginschermicoon en valt terug op een schermafbeelding; voor een strak icoon op iPhone is een 180×180 PNG als `apple-touch-icon` nodig. Bij een nieuwe versie: verhoog `CACHE` in `sw.js`.

Open-Meteo is gratis voor niet-commercieel gebruik tot 10.000 aanroepen per dag; een paar gebruikers die elke 5 minuten verversen blijven daar ruim onder.

## Zonnetjes met weer

De zonnetjes bij zonsopkomst en -ondergang tonen het HARMONIE-weer van dat moment: bewolking van het dichtstbijzijnde uur en neerslag van het lopende uur. Vier varianten: helder (alleen zon), half bewolkt (30–70% bedekking, kleine wolk), bewolkt (≥ 70%, wolk voor de zon) en regen (≥ 0,1 mm in dat uur, wolk met vallende druppels). De zon komt eenmalig op van achter een horizonlijntje of zakt er deels achter; bij "verminder beweging" staat alles stil. De titel van het glyph (lang indrukken) noemt tijd en weerwoord.

## Ensemble (kans en spreiding)

Sinds versie 4 toont de app geen vergelijking met ICON-D2 en AROME meer. In plaats daarvan komt de onzekerheid uit het ICON-D2-ensemble (DWD, 20 leden, 2,2 km, ±48 uur) via de Open-Meteo ensemble-API:

- **Regen:** een aparte grafiek "Kans op regen" onder de HARMONIE-staven: per uur het aandeel leden met ≥ 0,1 mm in dat uur. De tooltip van de HARMONIE-staaf noemt diezelfde kans; de hero-tegel ook.
- **Temperatuur, wind, bewolking:** een 10–90%-band van de leden achter de HARMONIE-lijn, met de bandbreedte in de tooltip.
- HARMONIE blijft de verwachting; het ensemble zegt alleen hoe zeker die is. Beide bronnen staan in de legenda en voettekst. Zodra er een backend is, kan hier het KNMI HARMONIE-ensemble onder (zelfde interface).

Technisch: `parseEnsemble` leest `precipitation`, `precipitation_member01…` enzovoort, kapt af waar minder dan 5 leden data hebben, en koppelt de neerslag aan het begin van het uur, net als HARMONIE. Bij één model in de aanvraag laat Open-Meteo de modelnaam uit de veldnamen weg; `parseForecast` valt daarop terug.

## Zoom en tijdas

Knijpen tekent de grafieken in place opnieuw (de bezig-aanraking blijft op hetzelfde element via pointer capture), zodat je kunt blijven knijpen; pas bij loslaten wordt het hele scherm ververst en de keuze opgeslagen. De tijdas kiest de labelstap (1, 2, 3, 6 of 12 uur) zo dat labels minstens 44 px uit elkaar staan, met verticale stippellijnen op elk label; middernacht houdt zijn eigen daglijn.
