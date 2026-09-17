import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Databases from "./pages/Databases";
import Collections from "./pages/Collections";
import Documents from "./pages/Documents";
import QueryConsole from "./pages/QueryConsole";
import Indexes from "./pages/Indexes";
import Schema from "./pages/Schema";
import Transactions from "./pages/Transactions";
import Logs from "./pages/Logs";

function App() {
    return <BrowserRouter><AppProvider><Routes><Route path="/login" element={<Login />} /><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route element={<MainLayout />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/databases" element={<Databases />} /><Route path="/collections" element={<Collections />} /><Route path="/documents" element={<Documents />} /><Route path="/query" element={<QueryConsole />} /><Route path="/indexes" element={<Indexes />} /><Route path="/schema" element={<Schema />} /><Route path="/transactions" element={<Transactions />} /><Route path="/logs" element={<Logs />} /></Route><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></AppProvider></BrowserRouter>;
}

export default App
