// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axiosInstance from "../lib/axios";
import { MoreHorizontal, LayoutGrid, List, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const LAYOUT_STORAGE_KEY = "dashboard:layout";

type LayoutType = "grid" | "list";

const readLayout = (): LayoutType => {
  try {
    if (typeof window === "undefined") return "grid";
    const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return saved === "list" || saved === "grid" ? saved : "grid";
  } catch {
    return "grid";
  }
};

type Project = {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
};

const Dashboard = () => {
  const [data, setData] = useState<Project[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [layout, setLayout] = useState<LayoutType>(() => readLayout());

  const navigate = useNavigate();

  // --- DELETE MODAL STATE ---
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Zapisuj do localStorage przy każdej zmianie layoutu
  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {}
  }, [layout]);

  // synchronizacja między kartami
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAYOUT_STORAGE_KEY) {
        const next = e.newValue === "list" || e.newValue === "grid" ? (e.newValue as LayoutType) : "grid";
        setLayout(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/api/projects");
      setData(response.data);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Nie udało się pobrać projektów", { duration: 7000, closeButton: true });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openDeleteModal = (project: Project) => {
    setDeleteTarget(project);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return; // nie zamykaj w trakcie requestu
    setDeleteOpen(false);
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await axiosInstance.delete(`/api/projects/${deleteTarget.id}/`);

      setData((prev) => (prev ?? []).filter((p) => p.id !== deleteTarget.id));
      toast.success("Projekt został usunięty", { duration: 5000, closeButton: true });

      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Nie udało się usunąć projektu", { duration: 7000, closeButton: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const projects = useMemo(() => data ?? [], [data]);

  return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
          <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">Twoje projekty</h1>
            </div>

            {isLoading ? (
                <p className="text-muted-foreground">Ładowanie projektów...</p>
            ) : projects.length > 0 ? (
                layout === "grid" ? (
                    /* --- GRID --- */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {projects.map((project) => (
                          <Card
                              key={project.id}
                              className="relative bg-muted hover:bg-accent transition-colors group cursor-pointer"
                              onClick={() => navigate(`/project/${project.id}`)}
                          >
                            <CardHeader>
                              <CardTitle>{project.name}</CardTitle>
                              <CardDescription>{project.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <p>
                                <strong>Created:</strong>{" "}
                                {project.created_at ? new Date(project.created_at).toLocaleDateString() : "—"}
                              </p>
                            </CardContent>

                            {/* Ikonka usuwania */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Usuń projekt"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteModal(project);
                                  }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </Card>
                      ))}
                    </div>
                ) : (
                    /* --- LISTA --- */
                    <div className="divide-y divide-border border rounded-md bg-card">
                      {projects.map((project) => (
                          <div
                              key={project.id}
                              className="flex items-center justify-between px-4 py-3 hover:bg-accent cursor-pointer"
                              onClick={() => navigate(`/project/${project.id}`)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                              <span className="font-medium">{project.name}</span>
                              <span className="text-sm text-muted-foreground">{project.description}</span>
                            </div>

                            <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {project.created_at ? new Date(project.created_at).toLocaleDateString() : "—"}
                      </span>

                              <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Usuń projekt"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteModal(project);
                                  }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                      ))}
                    </div>
                )
            ) : (
                <p className="text-muted-foreground">Nie znaleziono projektów</p>
            )}
          </div>

          {/* Floating toggle */}
          <div className="fixed bottom-6 right-6 flex flex-col gap-2">
            <Button
                variant={layout === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setLayout("grid")}
                aria-label="Widok siatki"
                title="Widok siatki"
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button
                variant={layout === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setLayout("list")}
                aria-label="Widok listy"
                title="Widok listy"
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* ✅ MODAL POTWIERDZENIA USUWANIA */}
        <Dialog open={deleteOpen} onOpenChange={(open) => (open ? setDeleteOpen(true) : closeDeleteModal())}>
          <DialogContent
              onPointerDownOutside={(e) => {
                if (isDeleting) e.preventDefault();
              }}
              onInteractOutside={(e) => {
                if (isDeleting) e.preventDefault();
              }}
          >
            <DialogHeader>
              <DialogTitle>Usunąć projekt?</DialogTitle>
              <DialogDescription>
                {deleteTarget ? (
                    <>
                      Projekt <span className="font-medium">„{deleteTarget.name}”</span> zostanie usunięty na stałe.
                      Tej operacji nie da się cofnąć.
                    </>
                ) : (
                    "Tej operacji nie da się cofnąć."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={closeDeleteModal} disabled={isDeleting}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={!deleteTarget || isDeleting}>
                {isDeleting ? "Usuwanie..." : "Usuń"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
  );
};

export default Dashboard;