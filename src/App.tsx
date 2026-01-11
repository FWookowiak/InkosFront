import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectSummaryProvider } from "./contexts/ProjectSummaryContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Topbar from "./components/Topbar/Topbar";
import ProjectPage from "./pages/ProjectPage";
import AccountPage from './pages/AccountPage.tsx';
import Contact from "./pages/Contact.tsx";
import NewProject from "@/pages/NewProject";
import ApiExplorer from "@/pages/ApiExplorer.tsx";
//import DumpList from "./components/DumpList";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <ProjectSummaryProvider>
        <Topbar />
          <Routes>
              <Route path="/api-explorer" element={<ProtectedRoute><ApiExplorer /></ProtectedRoute>} />
              <Route path="/project/new" element={<NewProject />} />
              <Route path="/konto" element={<AccountPage />} />
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
              <Route path="/kontakt" element={<Contact />} />
            <Route
              path="/project/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ProjectSummaryProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
