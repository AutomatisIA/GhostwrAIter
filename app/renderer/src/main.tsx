// La feuille de base est importee AVANT `App` a dessein. Chaque ecran importe
// desormais sa propre feuille, et Vite injecte les styles dans l ordre du
// graphe de modules : en important `App` d abord, les feuilles d ecran
// arriveraient AVANT la base et perdraient toute egalite de specificite. Cet
// ordre garantit la cascade voulue, palette puis jetons puis base puis ecrans.
import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
