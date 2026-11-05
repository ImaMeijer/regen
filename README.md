# Regen · prototype

Smartphone-prototype van een buienapp op basis van fijnmazige weermodellen. Drie bestanden, geen build-stap:

- `index.html` – schermopbouw, tabbar, locatiepaneel
- `app.css` – ontwerp (licht en donker, telefoonkader op desktop)
- `app.js` – datalaag, grafiekmotor, vier tabs, zelftests

## Starten

Open `index.html` via een lokale webserver (bijvoorbeeld `..\buienalarm\serve.ps1 -Root .. -Port 8765` en dan `http://localhost:8765/regenapp/`). Rechtstreeks openen als bestand werkt in Chrome ook, omdat beide API's externe aanroepen toestaan.

Zelftests: `index.html?test=1` toont een paneel met alle zelftests (56 bij versie 14). Donker thema forceren: `?theme=dark`.

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

De 2,5-daagse grafieken delen één horizon-instelling: "nu t/m x uur vooruit". Het begin staat altijd op het huidige uur; zoomen verandert alleen het einde. Instellen kan met twee vingers op een grafiek (knijpen = uitzoomen, uit elkaar = inzoomen) of met ctrl+scroll of trackpad-pinch op desktop. Er zijn geen knoppen meer (sinds versie 18); de kaarttitel ("Komende 24 uur") laat zien hoeveel uur je ziet. Bereik 6 uur tot de modelhorizon. De keuze wordt in `localStorage` bewaard (`regen.horizon`) en is de volgende keer de standaard.

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

## Versie 5: metingen, kanslijn, nu-label, grijze bewolking

- **Actuele meting in de hero-tegels.** Temperatuur en wind komen van het dichtstbijzijnde KNMI-station met temperatuurmeting, via de Buienradar-feed (`data.buienradar.nl/2.0/feed/json`, 10-minutenwaarden, CORS open). De tegel noemt meettijd, station en afstand, en daarnaast de HARMONIE-waarde van dit uur. Kuststations zonder temperatuur (IJmuiden, Texelhors, Houtribdijk, Wijdenes, Rotterdam Geulhaven) worden overgeslagen. De KNMI EDR-API is niet bruikbaar vanuit de browser (anonieme sleutel geweigerd).
- **Kans op regen** staat nu in dezelfde kaart als de HARMONIE-staven, als lage sub-grafiek (92 px) met dezelfde tijdas en zoom: een vloeiende lijn via monotone kubieke interpolatie (Fritsch–Carlson, geen overshoot), elk uurpunt in het midden van zijn uur.
- **Nu-label.** Onder de gestippelde nu-lijn staat de huidige tijd vet; reguliere tijdlabels binnen 30 px ervan vervallen (op de 2-uurs grafiek ≈ 12 minuten, op 48 uur ≈ 2 uur). Het "nu"-label bovenin is weg.
- **Bewolking in grijs.** De bedekkingslijn kleurt langs zijn lengte van lichtgrijs (0%) naar donkergrijs (100%) (in donker thema omgekeerd), met grijs vlak en grijze ensembleband. Bovendien trekt bewolking in álle grafieken de dagtint 70 % naar grijs, zodat een bewolkte dag grijs is en een heldere dag warm; de nacht blijft onveranderd.

## Versie 7: overzicht, boom, info, scrub, 48 uur

- **Overzicht-tab** (tweede tab): temperatuur per uur als staven, gekleurd van blauw (koud) via amber naar rood (warm), met boven elk uur een weericoontje (zon of maan, half bewolkt, bewolkt, regen) uit dezelfde regels als de zonnetjes; 's nachts een maan. Daaronder een lage neerslaggrafiek met dezelfde tijdas. Icoontjes worden uitgedund als er minder dan 18 px per uur is.
- **Boom op de windpagina**, onder de pijlen: zwaai-amplitude, scheefstand en zwaaiperiode per Beaufort (KNMI-tabel "uitwerking op land"), leunend in de richting waarheen de wind waait; vanaf 5 Bft vliegen bladeren weg. Standaard de gemeten wind van nu; sleep over de grafiek en de boom toont het uur onder je vinger.
- **Info-pagina** als verborgen tab (knop onderaan elke pagina), met alles over werking, bronnen, leesinstructie, de Beaufort-tabel en licenties. Modelnamen zijn uit de gewone schermen verdwenen: daar staat "verwacht", "gemeten", "kans op regen" en "onzekerheid".
- **Schuiven met de vinger**: de stippellijn volgt je vinger, met de tijd eronder; botsende tijdlabels verdwijnen; gekoppelde grafieken in dezelfde kaart bewegen mee; na loslaten springt de lijn na 1,8 s terug naar nu. Oorzaak van de oude bug: de knijp-handler nam elke aanraking in beslag (pointer capture), ook met één vinger; nu pas bij de tweede vinger.
- **Maximaal 48 uur** vooruit; presets 6 / 12 / 24 / 48 u; de tegel "Tot horizon" is weg.

## Versie 8: temperatuurlijn, boompjesrij, nieuwe boom met rook

- **Overzicht:** temperatuur als vloeiende lijn met vlak, gekleurd langs de lijn (blauw → amber → rood). Tussen de temperatuurgrafiek en de neerslag een rij boompjes die de wind van dat uur tonen: één per weericoontje als er minstens 26 px tussen zit, anders één per twee icoontjes.
- **Boommodel** (één SVG-model, groot op de windpagina en klein in de rij): gebogen stam, vijf takken, lancetvormige blaadjes in twee groentinten aan de toppen en halverwege de takken. Stam en takken zwaaien met amplitude en tempo per Beaufort, de boom leunt naar de kant waarheen de wind waait, en vanaf 5 Bft vliegen blaadjes weg.
- **Rook** op de windpagina: een schoorsteentje met pluim die bij windstilte recht omhoog gaat en met meer wind steeds platter wegwaait in de windrichting, naar de KNMI-omschrijving voor 0 en 1 Bft.

## Versie 9: zachtere lijnen, cartoonboom met windveld, boompjes per wolkje

- **Lijnen:** temperatuur, gevoelstemperatuur, wind en windstoten gebruiken nu een Catmull-Rom-spline (spanning 0,5): zachter dan de monotone interpolatie, met een klein beetje overshoot dat als natuurlijke curve leest. De kanslijn houdt de monotone variant, zodat die nooit buiten 0–100% komt.
- **Boom:** bruine stam en takken met donkere rand; blaadjes als druppelvorm met nerf in twee groentinten, aan de toppen en halverwege de takken. Plaatsing en animatie zitten in gescheiden groepen (de CSS-animatie overschreef anders de SVG-transform). Ook bij windstilte een minimale beweging van 0,5°, zodat de boom nooit bevriest. Bij regen in dat uur vallen druppels schuin met de wind mee.
- **Windveld** op de windpagina in plaats van rook: zestien streken die in de windrichting stromen, met snelheid, lengte en dekking die oplopen met Beaufort; wind naar het noorden (van de kijker af) laat ze licht stijgen, naar het zuiden licht dalen.
- **Boompjesrij** in het overzicht: onder elk weericoontje een boompje op dezelfde uren, geschaald naar de ruimte (0,2–0,3), met regen waar het regent.

## Versie 10: windveld in 3D, scènes in het overzicht, minder tekst

- **Windveld** rekent nu met de volledige windvector. Oost/west is links/rechts; het noord/zuid-deel wordt diepte: wind naar de kijker toe (uit het noorden) komt van boven, beweegt omlaag en wordt groter; wind van de kijker af (uit het zuiden) begint laag, beweegt omhoog en krimpt. Elke streek is langs zijn eigen bewegingsrichting gedraaid en begint een halve reis stroomopwaarts van zijn strooipunt.
- **Overzicht:** onder de wolkjes staan nu dezelfde scènes als op de windpagina (boom + windveld + regen) als geneste SVG's van 40–56 px, op de uren van de wolkjes, zo veel als er met minstens 44 px tussenruimte passen (meestal één per twee wolkjes).
- **Tekst:** alle uitleg onder titels en onder de zoomknoppen is weg, en de legenda van het overzicht ook; de info-pagina legt alles uit. Zoompresets: 12, 24, 48 uur. De tegel van het overzicht gebruikt hetzelfde wolkje als Regen en Bewolking.

## Versie 11: boom van schuin boven

De boom wordt nu van iets boven bekeken: een ronde kruin van zes uitwaaierende takken met blaadjes, een korte stam naar de stamvoet en een schaduw op de grond. Daarmee valt het kompas samen met het scherm: noord is omhoog, oost is rechts (noord-zuid iets verkort, factor 0,6). Wind schuift de kruin van de voet af in de richting waarheen hij waait; de stam volgt de kruin. De streken van het windveld stromen in dezelfde schermrichting zonder diepte-truc; regen is te zien als spattende druppels op de grond. Een kompasje rechtsboven markeert het noorden. Dezelfde scène staat verkleind onder de wolkjes in het overzicht.

## Versie 12: icoontjes

Het tab-icoontje van Overzicht gebruikt onderin hetzelfde wolkje als Bewolking, verkleind, zonder de uitstulping linksonder. De tegel bovenin het overzicht toont het weerbeeld van nu met dezelfde icoontjes als de uurrij (zon of maan, half bewolkt, bewolkt, regen).

## Versie 13: eerlijkere kop, temperatuur uit ICON-D2, verouderde data zichtbaar

Eerste ronde verbeteringen na de audit van 1 november 2026.

- **Eerstvolgende neerslag:** eerst de radar, ook het slot waar je nu in zit ("Nu"). Na het radarvenster telt een modeluur alleen als nat bij minstens 0,2 mm (0,1 mm is spoortjes) én een ensemblekans van minstens 30 %; een uur dat de radar half dekt telt vanaf het einde van de radar. Anders "Droog" t/m 48 uur vooruit, met de hoogste kans in die periode. Voorheen pakte de kop het eerste uur met 0,1 mm, ook binnen het droge radarvenster en ook bij een kans van 0 %.
- **Kansen** staan overal op dezelfde manier: in stappen van 5 % (twintig leden), met "< 5%" en "> 95%" in plaats van 0 % en 100 %.
- **Temperatuur uit ICON-D2** (DWD, via Open-Meteo), op Temperatuur en Overzicht. In de eigen verificatie was HARMONIE +0,3 tot +0,6 °C te warm en significant slechter. De band komt uit het ICON-D2-ensemble en hoort nu bij hetzelfde model als de lijn; valt ICON-D2 weg, dan toont de app HARMONIE zonder band. Neerslag, wind en bewolking blijven HARMONIE.
- **Verouderde data:** de service worker cachet alleen nog de app-schil. Elke databron wordt na een geslaagde aanroep met ophaaltijd in `localStorage` bewaard (`regen.data.*`); zonder verbinding toont de app die kopie met een melding "Geen verbinding. Je ziet de gegevens van …" en in de kop "offline · gegevens van …". Radarslots die voorbij zijn en stationsmetingen van meer dan een uur oud worden weggelaten. Bij terugkeer van de verbinding ververst de app meteen.
- **Middernacht:** raintext-regels krijgen de dag die het dichtst bij het ophaalmoment ligt. Een reeks die om 23:55 begint terwijl het al 00:02 is, belandde eerst een dag later.
- **Wisselen van plaats** tijdens het laden: een trager antwoord van de vorige plaats overschrijft de nieuwe niet meer.
- **Radar in de uurgrafiek:** de uren die de radar dekt halen hun neerslag uit de radar (intensiteit × 5 min over het overlappende deel), het uur waarin de radar stopt vult de rest pro rata aan met het model, en van het lopende uur telt alleen wat nog komt. Dat geldt overal: staven, tabel, tegels 24 u / 48 u, weericoontjes, boompjes en de kop. Voor uren die de radar helemaal dekt staat er geen kans en begint de kanslijn pas na de radar. Zo kan de uurgrafiek nooit regen tonen waar de radar droog is.
- **Wind bij de boom per Beaufort:** vaste tabellen in plaats van lineaire formules. Windveld: 0 Bft geen streken, vanaf 1 Bft 8 vage, trage streken (genoeg om de richting te lezen), vanaf 5 Bft alle 16, en daarna steeds langer, dikker (tot 3) en sneller. Blaadjes hebben een eigen uitslag en tempo, naar de KNMI-omschrijvingen: bijna stil bij 0–1 Bft (±1–2°), ritselen bij 2 Bft (±5°, snel), en daarna steeds wijder en sneller (±20° bij 5 Bft, ±32° bij 7 Bft, ±42° bij 9 Bft). Dezelfde tabellen sturen de kleine scènes in Overzicht.
- **Verouderd-melding:** een bewaarde kopie van minder dan 10 minuten oud telt als actueel, zodat één haperende bron geen alarm geeft. Faalt alles, dan staat er "Geen verbinding"; faalt een deel, dan "Niet alles kon worden bijgewerkt".
- **Dagstrook gelijkgetrokken:** op alle tabbladen staan de dagnamen op dezelfde hoogte (14 px) met direct daaronder één rij: de weericoontjes in Overzicht, de zonnetjes bij op- en ondergang op de andere tabbladen (32 px), en de grafiek begint op 46 px. In Overzicht scheelt dat 20 px lege ruimte; daar is de temperatuurgrafiek bovendien 240 px hoog in plaats van 210, waardoor het plotvlak groeit van 58 naar 108 px.
- Zelftests: 56.

## Versie 14: kop alleen op HARMONIE, geen oude radar meer

- **Eerstvolgende neerslag** beslist alleen nog op HARMONIE: na het radarvenster is het eerste uur met minstens 0,5 mm de eerstvolgende neerslag (gemeten aan de staaf zoals je die in de uurgrafiek ziet). De ensemblekans staat er nog bij, maar beslist niet meer. Voorheen kon een lage ICON-kans een duidelijk nat HARMONIE-uur wegfilteren, waardoor er "Droog" stond boven een grafiek met regen. Onder de drempel staat er "geen regen van betekenis … · hooguit x mm" met het natste uur.
- **Geen oude radar meer:** een bewaarde radarkopie wordt nog maar tot 30 minuten oud gebruikt (was 2 uur). Bij het heropenen van de app op de telefoon faalde soms de eerste aanroep; dan bleef van een oude kopie na het weglaten van wat voorbij was een stompje van een kwartier over, en kwam het uur daarna in de uurgrafiek grotendeels uit HARMONIE terwijl "Komende 2 uur" droog leek.
- **Snel opnieuw proberen:** faalt een bron, dan probeert de app het na 30 seconden opnieuw in plaats van na 5 minuten.
- **Tekst bij een korte radarreeks:** "Droog tot 20:15" in plaats van "Droog in de komende 2 uur" als de radar minder dan ongeveer 2 uur dekt.
- **Lopend uur vóór de radar:** begint de radar precies op het hele uur, dan hield het lopende uur eerst de volle HARMONIE-waarde. Nu telt dat uur als voorbij (0, bron radar).
- **As van de uurgrafiek** heet nu "mm" in plaats van "mm/u": de staven zijn hoeveelheden per uur, de radar toont intensiteit. Een bui van een kwartier van 0,4 mm/u is in de uurgrafiek 0,1 mm.
- **Radarregen nooit weg:** de drempel van 0,05 mm geldt alleen nog voor het modeldeel na de radar; regen die de radar toont blijft in de uurstaaf staan, hoe weinig ook. Elke staaf groter dan 0 is minstens 2 px hoog, en hoeveelheden onder 0,05 mm heten "< 0,1" in plaats van "0,0".
- Zelftests: 56 (twee kop-tests herschreven voor de nieuwe regel).

## Versie 15: weerbeeld overdag uit de zon, gladdere bewolking

- **Weerbeeld overdag uit de zon:** HARMONIE geeft bewolking als momentopname van één vakje van 2 km op het hele uur. Bij losse stapelwolken springt die per uur tussen 0 en 100%, en één wolkje op het hele uur maakte zo een zonnig uur "bewolkt" (2 nov: 100% bewolking om 09:00 terwijl het model zelf volop zon rekende, en de satelliet de hele ochtend 80–95% van een heldere hemel gaf). Nu haalt de app ook `shortwave_radiation` op, een uurgemiddelde, en deelt die door de straling bij een heldere hemel (Haurwitz, gemiddeld over het uur, met de zonsstand uit de app). 0,9 daarvan of meer telt als 0% bedekking, 0,3 of minder als 100% (satelliet haalt bij heldere hemel ≈ 0,9). Dit bepaalt overdag de weericoontjes, de tegel, de zonnetjes en de grijstint van de lucht. Onder ongeveer 6° zonshoogte en 's nachts beslist de bewolking.
- **Bewolking gladgemaakt:** elk uur van totaal, laag, midden en hoog is een gewogen gemiddelde 1-2-1 met het uur ervoor en erna. 0/100/0 wordt zo 50% (half bewolkt) in plaats van een zaagtand. Een verkeerd model (zoals 1 nov, toen HARMONIE de lage bewolking vasthield en ICON-D2 wel klopte) lost dit niet op; daarvoor is verificatie tegen de satelliet nodig.
- **Tegel volgt de metingen:** de tegel zei "Gemeten 15:00 · Schiphol · bewolkt", maar alleen de temperatuur was gemeten; het woord kwam uit HARMONIE, dat het wolkenveld van de avond te vroeg liet komen terwijl Schiphol "vrijwel onbewolkt" meldde. Nu komt het weerbeeld van nu uit de stations: per station `sunpower` (10-minutengemiddelde) gedeeld door de straling bij een heldere hemel in die 10 minuten, met dezelfde schaal als hierboven, gewogen met 1/afstand over de stations binnen 40 km. Dat middelt over de ruimte wat de feed niet over de tijd geeft (er zit geen historie in). Op 2 nov 14:55 lag dat bij heldere stations op 1,0 en bij bewolkte op 0,2–0,4, in lijn met hun omschrijving; om 13:30 meldde Schiphol "zwaar bewolkt" bij 1,2× een heldere hemel (zon tussen stapelwolken), wat de straling terecht zonnig noemt. Regen komt uit de omschrijving of het lopende uur (met radar). Bij lage zon en 's nachts telt de omschrijving van het dichtstbijzijnde station; zonder meting het model.
- Zelftests: 62 (nieuw: gladmaken, zon %, overzicht volgt de zon, stationsbedekking, omschrijving, tegel).

## Versie 16: verouderd-melding noemt de bron

- **Melding zegt wat verouderd is:** bij een haperende bron stond er "Niet alles kon worden bijgewerkt. Een deel van wat je ziet is van 15:11." (2 nov: de verwachtings-API van Open-Meteo gaf `503 The service is overloaded`, de rest was vers). Nu noemt de melding de bron: "De verwachting kon niet worden bijgewerkt en is van 15:11.", bij meer bronnen "De verwachting en de radar konden …", met per bron een tijd als die verschillen. De ondertitel zegt bij één bron "verwachting van 15:11" in plaats van "deels verouderd". Bronnen: verwachting, kans en onzekerheidsband, radar, metingen. Zonder verbinding blijft "Geen verbinding".
- Zelftests: 63.

## Versie 17: ontbrekende waarden breken geen tabel meer

- **Temperatuur-tab:** ICON-D2 levert voor de laatste uren van zijn run geen gevoelstemperatuur. De tabel liep daarop vast (`fmtNum(null)`), waardoor de tabel ontbrak en er een fout in de console kwam. `fmtNum` toont een ontbrekende waarde nu als "–"; dat geldt voor alle tabellen en tooltips.
- Zelftests: 63.

## Versie 18: elke tab past op één iPhone-scherm

- **Geen zoomknoppen meer:** de balk "Vooruit · 48 u · t/m za 17:00" met 12 u · 24 u · 48 u is weg; zoomen gaat met twee vingers op een grafiek. De kaarttitel ("Komende 24 uur") loopt mee tijdens het knijpen.
- **Info-knop in de kop:** "Info en bronnen" stond onderaan elke tab en kostte de ruimte die een tab nodig had. Het is nu een i-icoontje rechts naast de plaatsnaam.
- **Ruimte onder de inhoud** is precies de tabbalk plus 8 px, zodat een tab die past niet meer een stukje scrolt.
- **Wind:** de legenda staat op één regel ("Wind", "Stoten", onzekerheid; de pijlen staan uitgelegd onder Info), de kop noemt geen graden meer (die staan in tabel en tooltip), de boom is 120 px en de grafiek 200 px.
- **Temperatuur en Bewolking** gebruiken de vrijgekomen ruimte: grafiek 260 px.
- **Tab wisselen begint bovenaan.** Het scherm scrolt soepel (`scroll-behavior: smooth`); bij een tabwissel begon die animatie naar boven, waarna het opnieuw opbouwen de halve scrollpositie terugzette. Nu springt het scherm direct naar boven.
- Gemeten op 393 × 852 (iPhone 15/16) met de veilige marges van de iPhone nagebootst: Overzicht, Temperatuur, Wind en Bewolking passen zonder scrollen. Regen scrolt nog, zoals bedoeld.
- Zelftests: 64.
