import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [databases, setDatabases] = useState([]);
    const [collections, setCollections] = useState([]);
    const [selectedDatabase, setSelectedDatabase] = useState(localStorage.getItem("flexstore.database") || "");
    const [selectedCollection, setSelectedCollection] = useState(localStorage.getItem("flexstore.collection") || "");
    const [loadingScope, setLoadingScope] = useState(true);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        localStorage.setItem("flexstore.database", selectedDatabase);
        localStorage.setItem("flexstore.collection", selectedCollection);
    }, [selectedDatabase, selectedCollection]);

    const refreshDatabases = async () => {
        const data = await api.getDatabases();
        setDatabases(data.databases || []);
        const database = (data.databases || []).includes(selectedDatabase) ? selectedDatabase : data.databases?.[0] || "";
        setSelectedDatabase(database);
        return data;
    };

    useEffect(() => {
        refreshDatabases().catch(error => setNotice({ type: "error", message: error.message })).finally(() => setLoadingScope(false));
    }, []);

    useEffect(() => {
        if (!selectedDatabase) { setCollections([]); setSelectedCollection(""); return; }
        api.getCollections(selectedDatabase).then(data => {
            const values = data.collections || [];
            setCollections(values);
            if (!values.includes(selectedCollection)) setSelectedCollection(values[0] || "");
        }).catch(error => setNotice({ type: "error", message: error.message }));
    }, [selectedDatabase]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(null), 4200);
        return () => window.clearTimeout(timer);
    }, [notice]);

    return <AppContext.Provider value={{ databases, setDatabases, collections, setCollections, selectedDatabase, setSelectedDatabase, selectedCollection, setSelectedCollection, refreshDatabases, loadingScope, notice, setNotice }}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used inside AppProvider");
    return context;
}
