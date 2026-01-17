
<div align="center">

# Resmus 2026 🚌
### *Framtidens reskamrat för Västtrafik & ResRobot*

[![Deploy to GitHub Pages](https://github.com/rastatrollet/Resmus/actions/workflows/deploy.yml/badge.svg)](https://github.com/rastatrollet/Resmus/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/badge/Version-2026.2.0-blue.svg)](https://github.com/rastatrollet/Resmus)
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)

[**🚀 Öppna Appen (Live)**](https://rastatrollet.github.io/Resmus/)

<br />

<img src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2069&auto=format&fit=crop" alt="Resmus Banner" width="100%" style="border-radius: 10px; max-height: 300px; object-fit: cover;" />

</div>

<br />

## 🌟 Om Projektet

**Resmus** är mer än bara en tidtabell. Det är en modern, snabb och vacker webbapplikation designad för pendlare i Sverige. Med fokus på **Västtrafik** och integration mot **ResRobot** (för hela Sverige) får du en sömlös upplevelse oavsett var du reser.

Appen är byggd för **2026** – med modern design, mörkt läge, och en "app-känsla" direkt i webbläsaren (PWA).

### ✨ Nyckelfunktioner

| Ikon | Funktion | Beskrivning |
| :---: | :--- | :--- |
| 🗺️ | **Live Map 3.0** | Följ bussar, tåg och spårvagnar i *realtid* på en interaktiv 3D-karta. Filtrera på operatör och se fordonen röra sig live. |
| ⏱️ | **Smart Avgångstavla** | Ser nästa avgång direkt. Färgkodade linjer baserat på operatör (t.ex. SL Röd, Västtrafik Blå, Skåne Grön). |
| 🌍 | **Hela Sverige** | Byt enkelt mellan **Västtrafik** och **ResRobot** för att söka resor i hela landet. |
| 🛠️ | **Anpassningsbar** | Välj mellan **Ljust**, **Mörkt** eller **System**-tema, och ställ in din personliga accentfärg. |
| ⚠️ | **Trafikstörningar** | Full koll på förseningar, inställda turer och banarbeten direkt i vyn. |
| 📲 | **Installera som App** | Lägg till på hemskärmen (PWA) för en native-upplevelse utan nedladdning från App Store. |

---

## 🛠️ Teknikstack & Arkitektur

Projektet är ett **State-of-the-Art** exempel på modern webbutveckling:

*   **Core:** [React 18](https://react.dev/) med Hooks & Context API.
*   **Språk:** [TypeScript](https://www.typescriptlang.org/) för typsäkerhet och robusthet.
*   **Build System:** [Vite](https://vitejs.dev/) - Blixtsnabb HMR och optimerad produktion.
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) med custom design system och dark mode stöd.
*   **Kartmotor:** [Leaflet](https://leafletjs.com/) med [React-Leaflet](https://react-leaflet.js.org/) och anpassade tiles.
*   **Realtime Data:** Integrationer mot Västtrafik Open API v4 (Oauth2) och Trafiklab GTFS-RT (PBF/Protobuf).
*   **State Management:** React Context + LocalStorage optimering.

---

## 🚀 Kom Igång (Utveckling)

Vill du köra projektet lokalt?

1.  **Klona repot:**
    ```bash
    git clone https://github.com/rastatrollet/Resmus.git
    cd Resmus
    ```

2.  **Installera beroenden:**
    ```bash
    npm install
    ```

3.  **Starta utvecklingsservern:**
    ```bash
    npm run dev
    ```

4.  Öppna `http://localhost:5173` i din webbläsare.

---

## 🤝 Bidra & Kontakt

Detta är ett öppen källkods-projekt. Har du idéer eller hittar buggar? Skapa gärna en [Issue](https://github.com/rastatrollet/Resmus/issues) eller en Pull Request.

**Utvecklare:** Rasmus Lundin
**Licens:** MIT

<div align="center">
  <br />
  <i>Built with ❤️ using Open Data from Västtrafik & Samtrafiken (ResRobot/Trafiklab).</i>
</div>
