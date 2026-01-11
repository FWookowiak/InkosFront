import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectSummary } from "@/contexts/ProjectSummaryContext";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { Link, useNavigate, useLocation, matchPath } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, X } from "lucide-react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";

const Topbar: React.FC = () => {
    const { user, logout, isAuthenticated } = useAuth();
    const { summaryData, refetchProject, openGroupSettings, openAddElement, openAddTax } = useProjectSummary();
    const navigate = useNavigate();
    const location = useLocation();

    const projectMatch = matchPath("/project/:id", location.pathname);
    const projectId = projectMatch?.params?.id;
    const [selectedQuarter, setSelectedQuarter] = useState("Wybierz kwartał");
    const [selectedWspreg, setSelectedWspreg] = useState("Wybierz WSPREG");
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const [summaryModalOpen, setSummaryModalOpen] = useState(false);
    const [isRepricing, setIsRepricing] = useState(false);
    const [quarters, setQuarters] = useState<Array<{ db_key: string; name: string }>>([]);
    const [wspregs, setWspregs] = useState<Record<string, number>>({});

    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Fetch available quarters/databases
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const fetchQuarters = async () => {
            try {
                const response = await axiosInstance.get('/api/sekocenbud/dbfs');
                setQuarters(response.data);
            } catch (error) {
                console.error('Error fetching quarters:', error);
                toast.error('Nie udało się pobrać listy kwartałów', { duration: 7000, closeButton: true });
            }
        };
        fetchQuarters();
    }, [isAuthenticated]);

    // Set the selected quarter based on sekocenbud_catalog from context
    useEffect(() => {
        if (summaryData?.sekocenbud_catalog && quarters.length > 0) {
            const matchingQuarter = quarters.find(q => q.db_key === summaryData.sekocenbud_catalog);
            if (matchingQuarter) {
                setSelectedQuarter(matchingQuarter.name);
            }
        }
    }, [summaryData?.sekocenbud_catalog, quarters]);

    // Fetch wspreg data when quarter is selected
    useEffect(() => {
        if (!summaryData?.sekocenbud_catalog) return;
        
        const fetchWspregs = async () => {
            try {
                const response = await axiosInstance.get(`/api/sekocenbud/wspreg?db_key=${summaryData.sekocenbud_catalog}`);
                setWspregs(response.data);
            } catch (error) {
                console.error('Error fetching wspreg data:', error);
                toast.error('Nie udało się pobrać listy WSPREG', { duration: 7000, closeButton: true });
            }
        };
        
        fetchWspregs();
    }, [summaryData?.sekocenbud_catalog]);

    // Set selected wspreg from project data
    useEffect(() => {
        if (summaryData?.wspreg_name && summaryData.wspreg_name !== 'Brak') {
            setSelectedWspreg(summaryData.wspreg_name);
        } else {
            setSelectedWspreg('Wybierz WSPREG');
        }
    }, [summaryData?.wspreg_name]);

    if (!isAuthenticated) return null;

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    const handleQuarterChange = async (dbKey: string, name: string) => {
        if (!projectId) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }
        
        setIsRepricing(true);
        try {            
            const repriceResponse = await axiosInstance.post(`/api/projects/${projectId}/reprice/`, {
                sekocenbud_catalog: dbKey
            });
            
            // Trigger refetch to get updated project data
            if (refetchProject) {
                await refetchProject();
            }
            
            toast.success(`Zmieniono kwartał na ${name} i zaktualizowano ceny`, { duration: 7000, closeButton: true });
        } catch (error) {
            console.error('Error updating quarter:', error);
            toast.error('Nie udało się zmienić kwartału', { duration: 7000, closeButton: true });
        } finally {
            setIsRepricing(false);
        }
    };

    const handleWspregChange = async (name: string, value: number) => {
        if (!projectId) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }
        
        try {
            // Update project with wspreg data
            await axiosInstance.patch(`/api/projects/${projectId}/`, {
                wspreg_name: name,
                wspreg_value: value
            });
            
            setSelectedWspreg(name);
            
            // Trigger refetch to get updated project data
            if (refetchProject) {
                await refetchProject();
            }
            
            toast.success(`Zastosowano WSPREG: ${name} (×${value})`, { duration: 7000, closeButton: true });
        } catch (error) {
            console.error('Error applying wspreg:', error);
            toast.error('Nie udało się zastosować WSPREG', { duration: 7000, closeButton: true });
        }
    };

    const handleResetWspreg = async () => {
        if (!projectId) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }
        
        try {
            // Reset to Brak with value 1.0
            await axiosInstance.patch(`/api/projects/${projectId}/`, {
                wspreg_name: 'Brak',
                wspreg_value: 1.0
            });
            
            setSelectedWspreg('Wybierz WSPREG');
            
            // Trigger refetch to get updated project data
            if (refetchProject) {
                await refetchProject();
            }
            
            toast.success('Zresetowano WSPREG do wartości domyślnej', { duration: 7000, closeButton: true });
        } catch (error) {
            console.error('Error resetting wspreg:', error);
            toast.error('Nie udało się zresetować WSPREG', { duration: 7000, closeButton: true });
        }
    };

    const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
        if (!projectId) {
            toast.error("Nie znaleziono ID projektu", { duration: 7000, closeButton: true });
            return;
        }

        try {
            const response = await axiosInstance.get(`/api/projects/${projectId}/export/${format}`, {
                responseType: 'blob',
            });

            // Create a download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Set filename based on format
            const extension = format === 'excel' ? 'xlsx' : format;
            link.setAttribute('download', `project-${projectId}.${extension}`);
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Plik ${format.toUpperCase()} został pobrany`, { duration: 7000, closeButton: true });
        } catch (error) {
            console.error('Export error:', error);
            toast.error(`Błąd podczas eksportu do ${format.toUpperCase()}`, { duration: 7000, closeButton: true });
        }
    };

    return (
        <>
        <header className="fixed top-0 left-0 right-0 bg-background z-50 px-6 py-3 border-b shadow-sm flex justify-between items-center">

            {/* Lewa strona: logo + przycisk powrotu */}
            <div className="flex items-center gap-4">
                <Link to='/'>
                    <div className="p-2 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                        <img src={logo} alt="Logo" className="h-10 w-auto" />
                    </div>
                </Link>
                {projectMatch && (
                    <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                        ← Wróć do projektów
                    </Button>
                )}
            </div>

            {/* Środek: dropdowny tylko na stronie projektu */}
            {projectMatch && (
                <div className="flex items-center gap-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Plik</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSummaryModalOpen(true)}>
                                Podsumowanie
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={openGroupSettings}>
                                Ustawienia Grup
                            </DropdownMenuItem>
                            <DropdownMenuItem>Zapisz Postęp</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Eksport</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('pdf')}>
                                PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('excel')}>
                                Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('csv')}>
                                CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem>Wyślij do współpracownika</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Wstaw</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={openAddElement}>
                                Wstaw własny Element
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={openAddTax}>
                                Wstaw Podatek
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">{selectedQuarter}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {quarters.map((q) => (
                                <DropdownMenuItem
                                    key={q.db_key}
                                    onClick={() => handleQuarterChange(q.db_key, q.name)}
                                >
                                    {q.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    {selectedWspreg}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
                                {Object.entries(wspregs).map(([name, value]) => (
                                    <DropdownMenuItem
                                        key={name}
                                        onClick={() => handleWspregChange(name, value)}
                                    >
                                        {name} ({value.toFixed(2)})
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {selectedWspreg !== 'Wybierz WSPREG' && (
                            <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 hover:text-destructive"
                                onClick={handleResetWspreg}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Prawa strona */}
            <div className="flex items-center gap-6">
                <span className="text-sm text-muted-foreground">
                    Zalogowano: {user?.name}
                </span>

                {/* Przycisk widoczny tylko na /dashboard */}
                {location.pathname === "/dashboard" && (
                    <Button
                        variant="default"
                        onClick={() => navigate("/project/new")}
                    >
                        ➕ Dodaj projekt
                    </Button>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate('/konto')}>Konto</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/kontakt')}>Kontakt</DropdownMenuItem>
                        {/* <DropdownMenuItem onClick={toggleTheme}>
                            {theme === "light" ? "🌙 Ciemny motyw" : "☀️ Jasny motyw"}
                        </DropdownMenuItem> */}
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            Wyloguj
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>

        {/* Summary Modal */}
        <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Podsumowanie Projektu</DialogTitle>
                    <DialogDescription>
                        Szczegółowe informacje o projekcie
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-medium">Liczba elementów:</span>
                        <span className="text-lg">{summaryData?.itemsCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-medium">Liczba podgrup:</span>
                        <span className="text-lg">{summaryData?.groupsCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-medium text-lg">Suma całkowita:</span>
                        <span className="text-xl font-bold text-primary">
                            {(summaryData?.total ?? 0).toLocaleString("pl-PL", { 
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2 
                            })} zł
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Loading Modal for Reprice */}
        <Dialog open={isRepricing} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Przeliczanie cen...</DialogTitle>
                    <DialogDescription>
                        Trwa aktualizacja cen projektów. Proszę czekać.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
};

export default Topbar;
