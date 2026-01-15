<div align="center">

# Resmus 🚌🚋
### *Din moderna resekamrat för Västtrafik*

[![Deploy to GitHub Pages](https://github.com/rastatrollet/Resmus/actions/workflows/deploy.yml/badge.svg)](https://github.com/rastatrollet/Resmus/actions/workflows/deploy.yml)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Vite](https://img.shields.io/badge/Vite-5.2-purple.svg)

[**🔗 Gå till appen (Live)**](https://rastatrollet.github.io/Resmus/)

![Resmus Banner](https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2069&auto=format&fit=crop)

</div>

---

## 🌟 Om Projektet

**Resmus** är en webbapplikation byggd för att göra kollektivtrafiken i Västra Götaland överskådlig, snabb och vacker. Istället för krångliga listor får du en levande karta och en smart avgångstavla som anpassar sig efter dig.

### Nyckelfunktioner

| Ikon | Funktion | Beskrivning |
| :---: | :--- | :--- |
| 🗺️ | **Live Map 2.0** | Följ bussar, tåg och spårvagnar i realtid på en modern karta (CartoDB). |
| ⏱️ | **Smart Avgångstavla** | Ser nästa avgång direkt utan onödiga klick. |
| ⚠️ | **Trafikstörningar** | Vartningar om förseningar och inställda turer, direkt från Västtrafik. |
| 🌤️ | **Väderdata** | Ser vädret vid din hållplats så du vet om du behöver paraply. |

---

## 🛠️ Teknikstack

Projektet är utvecklat med moderna webbtekniker för maximal prestanda och utvecklarglädje.

-   **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool:** [Vite](https://vitejs.dev/)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **Kartor:** [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
-   **Data:** [Västtrafik Open API v4](https://developer.vasttrafik.se/)

---

## 🚀 Kom igång (För utvecklare)

Vill du köra projektet på din egen dator? Följ stegen nedan.

### 1. Klona och Installera

```bash
git clone https://github.com/rastatrollet/Resmus.git
cd Resmus
npm install
```

### 2. Konfigurera API-nycklar

För att appen ska kunna hämta data behöver du skapa en `.env`-fil i roten av projektet.
Kopiera `.env.example` (om den finns) eller skapa en ny:

**Fil:** `.env`
```env
# Västtrafik API (Base64-kodad Client ID:Secret)
VITE_VASTTRAFIK_AUTH=DIN_VASTTRAFIK_NYCKEL_HÄR

# (Valfritt) Trafiklab API-nycklar om du vill bygga ut funktionaliteten
VITE_TRAFIKLAB_API_KEY=DIN_TRAFIKLAB_KEY
VITE_TRAFIKLAB_STATIC_KEY=DIN_STATIC_KEY
```

### 3. Starta servern

```bash
npm run dev
```

Appen öppnas på `http://localhost:5173`.

---

## 📦 Deployment

Detta projekt deployas automatiskt till **GitHub Pages** via GitHub Actions när du pushar till `main`.

1.  GitHub bygger projektet (`npm run build`).
2.  Nycklar injiceras säkert via **GitHub Secrets**.
3.  Webbplatsen publiceras live.

---

<div align="center">
  <i>Skapad med ❤️ och ☕ av Rasmus Lundin</i>
</div>
