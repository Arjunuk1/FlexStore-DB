import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useApp } from "../context/AppContext";

export default function MainLayout() {
    const { notice } = useApp();
    return <div className="app-shell"><Sidebar /><div className="main-column"><Topbar /><main><Outlet /></main></div>{notice && <div className={`toast ${notice.type || "success"}`}>{notice.message}</div>}</div>;
}
