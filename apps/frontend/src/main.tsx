import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { initTheme } from "./lib/theme";

initTheme();

createRoot(document.getElementById("root")!).render(<App />);
