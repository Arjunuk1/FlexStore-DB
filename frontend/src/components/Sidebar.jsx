import { NavLink } from "react-router-dom";
import { Activity, Braces, Database, FileJson, Gauge, Layers3, ListTree, LogOut, Menu, Search, Table2, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";

const links = [
    ["Dashboard", "/dashboard", Gauge], ["Databases", "/databases", Database], ["Collections", "/collections", Table2],
    ["Documents", "/documents", FileJson], ["Query Console", "/query", Search], ["Indexes", "/indexes", Layers3],
    ["Schema", "/schema", Braces], ["Transactions", "/transactions", Activity], ["WAL / Logs", "/logs", ListTree]
];

export default function Sidebar() {
    const [open, setOpen] = useState(false);
    const { selectedCollection } = useApp();
    return <>
        <button className="mobile-menu icon-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <aside className={`sidebar ${open ? "is-open" : ""}`}>
            <div className="brand"><div className="brand-mark">F</div><div><strong>FlexStore</strong><small>data operations</small></div><button className="mobile-close icon-button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
            <div className="scope"><small>ACTIVE COLLECTION</small><span><span className="status-dot" />{selectedCollection}</span></div>
            <nav>{links.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "active" : ""}><Icon size={17} />{label}</NavLink>)}</nav>
            <div className="sidebar-foot"><span className="status-dot" />API connected</div>
        </aside>
        {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    </>;
}
