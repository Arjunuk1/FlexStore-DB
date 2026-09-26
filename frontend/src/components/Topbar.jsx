import { Bell, CircleHelp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { useEffect, useState } from "react";

const titles = { "/dashboard": ["Overview", "System pulse and collection health"], "/databases": ["Databases", "Manage the storage surfaces behind your engine"], "/collections": ["Collections", "Browse the collections currently exposed by the API"], "/documents": ["Documents", "Inspect and mutate JSON records safely"], "/query": ["Query console", "Run filters and inspect the planner"], "/indexes": ["Indexes", "Tune lookup paths for your collection"], "/schema": ["Schema", "Understand validation rules before writing"], "/transactions": ["Transactions", "Stage, commit, or roll back atomic work"], "/logs": ["WAL / Logs", "Review durable write-ahead records"] };

export default function Topbar() {
    const title = titles[useLocation().pathname] || ["FlexStore", "Database management console"];
    const { databases, collections, selectedDatabase, selectedCollection, setSelectedDatabase, setSelectedCollection } = useApp();
    const [status, setStatus] = useState("...");
    useEffect(() => { api.getStatus().then(value => setStatus(value.server || "ONLINE")).catch(() => setStatus("OFFLINE")); }, []);
    return <header className="topbar"><div><div className="eyebrow">DATABASE / {selectedDatabase || "NONE"}</div><h1>{title[0]}</h1><p>{title[1]}</p></div><div className="top-actions"><select value={selectedDatabase} onChange={event => setSelectedDatabase(event.target.value)} aria-label="Select database"><option value="">Database</option>{databases.map(database => <option key={database} value={database}>{database}</option>)}</select><select value={selectedCollection} onChange={event => setSelectedCollection(event.target.value)} aria-label="Select collection"><option value="">Collection</option>{collections.map(collection => <option key={collection} value={collection}>{collection}</option>)}</select><span className="connection"><span className="status-dot" />{status}</span><button className="icon-button" title="Help" aria-label="Help"><CircleHelp size={18} /></button><button className="icon-button" title="Notifications" aria-label="Notifications"><Bell size={18} /></button></div></header>;
}
