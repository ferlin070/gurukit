import { Fragment } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return <div className="page-loading">Memuatkan ruang kerja…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Fragment key={user.id}>{children}</Fragment>;
}
