import { createContext, useContext, useEffect, useState } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [selectedCollection, setSelectedCollection] = useState(localStorage.getItem("flexstore.collection") || "users");
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        localStorage.setItem("flexstore.collection", selectedCollection);
    }, [selectedCollection]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = window.setTimeout(() => setNotice(null), 4200);
        return () => window.clearTimeout(timer);
    }, [notice]);

    return <AppContext.Provider value={{ selectedCollection, setSelectedCollection, notice, setNotice }}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used inside AppProvider");
    return context;
}
