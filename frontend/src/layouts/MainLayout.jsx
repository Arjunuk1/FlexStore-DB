import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function MainLayout() {
    const { notice } = useApp();
    const navigate = useNavigate();
    useEffect(() => { api.me().catch(() => navigate("/login", { replace: true })); }, [navigate]);
    return <div className="app-shell"><Sidebar /><div className="main-column"><Topbar /><main><Outlet /></main></div>{notice && <div className={`toast ${notice.type || "success"}`}>{notice.message}</div>}</div>;
}
