import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import axiosInstance from '../lib/axios';
import { MoreHorizontal, LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const LAYOUT_STORAGE_KEY = 'dashboard:layout';

type LayoutType = 'grid' | 'list';

const readLayout = (): LayoutType => {
  try {
    if (typeof window === 'undefined') return 'grid';
    const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return saved === 'list' || saved === 'grid' ? saved : 'grid';
  } catch {
    return 'grid';
  }
};

const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ⬇️ Lazy initializer – od razu bierzemy wartość z localStorage
  const [layout, setLayout] = useState<LayoutType>(() => readLayout());

  const navigate = useNavigate();

  // Zapisuj do localStorage przy każdej zmianie layoutu
  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {}
  }, [layout]);

  // (Opcjonalnie) synchronizacja między kartami/przeglądarkami
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAYOUT_STORAGE_KEY) {
        const next = e.newValue === 'list' || e.newValue === 'grid' ? (e.newValue as LayoutType) : 'grid';
        setLayout(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/api/projects');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching protected data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const deleteProject = async (projectId: string) => {
    const delProject = confirm("Czy jesteś pewien, że chcesz usunąć ten projekt?");
    if (!delProject) return;
    try {
      await axiosInstance.delete(`/api/projects/${projectId}/`);
      setData((prev: any) => prev?.filter((project: any) => project.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Twoje projekty</h1>
          </div>

          {isLoading ? (
              <p className="text-muted-foreground">Ładowanie projektów...</p>
          ) : data && data.length > 0 ? (
              layout === 'grid' ? (
                  /* --- GRID --- */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.map((project: any) => (
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
                              {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </CardContent>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <MoreHorizontal
                                size={18}
                                className="text-muted-foreground hover:text-destructive ml-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(project.id);
                                }}
                            />
                          </div>
                        </Card>
                    ))}
                  </div>
              ) : (
                  /* --- LISTA (kompakt) --- */
                  <div className="divide-y divide-border border rounded-md bg-card">
                    {data.map((project: any) => (
                        <div
                            key={project.id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-accent cursor-pointer"
                            onClick={() => navigate(`/project/${project.id}`)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                            <span className="font-medium">{project.name}</span>
                            <span className="text-sm text-muted-foreground">{project.description}</span>
                          </div>
                          <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                            <MoreHorizontal
                                size={18}
                                className="text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(project.id);
                                }}
                            />
                          </div>
                        </div>
                    ))}
                  </div>
              )
          ) : (
              <p className="text-muted-foreground">Nie znaleziono projektów</p>
          )}
        </div>

        {/* Floating toggle w prawym dolnym rogu */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-2">
          <Button
              variant={layout === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setLayout('grid')}
              aria-label="Widok siatki"
              title="Widok siatki"
          >
            <LayoutGrid className="h-5 w-5" />
          </Button>
          <Button
              variant={layout === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setLayout('list')}
              aria-label="Widok listy"
              title="Widok listy"
          >
            <List className="h-5 w-5" />
          </Button>
        </div>
      </div>
  );
};

export default Dashboard;
