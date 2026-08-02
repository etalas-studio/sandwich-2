import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TicketList from "./components/TicketList";
import "./tailwind.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");

createRoot(container).render(
  <StrictMode>
    <TicketList />
  </StrictMode>,
);
