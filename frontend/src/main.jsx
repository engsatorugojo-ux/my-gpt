import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// Keep --app-height in sync with the visual viewport (handles mobile keyboard)
function setAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}
setAppHeight();
window.visualViewport?.addEventListener("resize", setAppHeight);
window.addEventListener("resize", setAppHeight);
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>
);
