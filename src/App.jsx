import { lazy, Suspense } from "react";
import { TeachingProvider } from "./context/TeachingContext.jsx";
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Documents = lazy(() => import("./pages/Documents.jsx"));
const PasswordRecovery = lazy(() => import("./pages/PasswordRecovery.jsx"));
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
const Signup = lazy(() => import("./pages/Signup.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const ToolRunner = lazy(() => import("./pages/ToolRunner.jsx"));
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <AuthProvider>
      <TeachingProvider>
        <Suspense
          fallback={
            <p className="page-loading" role="status">
              Memuatkan ruang kerja…
            </p>
          }
        >
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<PasswordRecovery />} />
              <Route
                path="/reset-password"
                element={<PasswordRecovery reset />}
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <Documents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tools/:toolId"
                element={
                  <ProtectedRoute>
                    <ToolRunner />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </TeachingProvider>
    </AuthProvider>
  );
}
