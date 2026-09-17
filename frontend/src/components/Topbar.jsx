import { Bell, CircleHelp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

const titles = { "/dashboard": ["Overview", "System pulse and collection health"], "/databases": ["Databases", "Manage the storage surfaces behind your engine"], "/collections": ["Collections", "Browse the collections currently exposed by the API"], "/documents": ["Documents", "Inspect and mutate JSON records safely"], "/query": ["Query console", "Run filters and inspect the planner"], "/indexes": ["Indexes", "Tune lookup paths for your collection"], "/schema": ["Schema", "Understand validation rules before writing"], "/transactions": ["Transactions", "Stage, commit, or roll back atomic work"], "/logs": ["WAL / Logs", "Review durable write-ahead records"] };

export default function Topbar() {
    const title = titles[useLocation().pathname] || ["FlexStore", "Database management console"];
    const { selectedCollection } = useApp();
    return <header className="topbar"><div><div className="eyebrow">COLLECTION / {selectedCollection.toUpperCase()}</div><h1>{title[0]}</h1><p>{title[1]}</p></div><div className="top-actions"><span className="connection"><span className="status-dot" />Connected</span><button className="icon-button" title="Help" aria-label="Help"><CircleHelp size={18} /></button><button className="icon-button" title="Notifications" aria-label="Notifications"><Bell size={18} /></button></div></header>;
}
