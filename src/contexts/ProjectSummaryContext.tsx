import React, { createContext, useContext, useState, ReactNode } from "react";

export interface GroupCostLine {
    id: number;
    name: string;
    total: number;
}

export interface ProjectSummaryData {
    // zachowujemy total dla kompatybilności (ustawiamy = totalInclTax)
    total: number;
    itemsCount: number;
    groupsCount: number;

    projectId?: string;
    projectName?: string;
    sekocenbud_catalog?: string;
    wspreg_name?: string;
    wspreg_value?: number;

    // ✅ NOWE: rozbicie na “z podatkami” i “bez podatków”
    totalInclTax?: number;
    totalExclTax?: number;

    subgroupCostsInclTax?: GroupCostLine[];
    subgroupCostsExclTax?: GroupCostLine[];

    ungroupedTotalInclTax?: number; // grupa 0 ("Brak podgrupy")
    ungroupedTotalExclTax?: number;
}

interface ProjectSummaryContextType {
    summaryData: ProjectSummaryData | null;
    setSummaryData: (data: ProjectSummaryData | null) => void;

    refetchProject: (() => Promise<void>) | null;
    setRefetchProject: (fn: (() => Promise<void>) | null) => void;

    openGroupSettings: () => void;
    groupSettingsOpenTrigger: number;

    openAddElement: () => void;
    addElementOpenTrigger: number;

    openAddTax: () => void;
    addTaxOpenTrigger: number;
}

const ProjectSummaryContext = createContext<ProjectSummaryContextType | undefined>(undefined);

export const ProjectSummaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [summaryData, setSummaryData] = useState<ProjectSummaryData | null>(null);
    const [refetchProject, setRefetchProject] = useState<(() => Promise<void>) | null>(null);
    const [groupSettingsOpenTrigger, setGroupSettingsOpenTrigger] = useState(0);
    const [addElementOpenTrigger, setAddElementOpenTrigger] = useState(0);
    const [addTaxOpenTrigger, setAddTaxOpenTrigger] = useState(0);

    const openGroupSettings = () => setGroupSettingsOpenTrigger((prev) => prev + 1);
    const openAddElement = () => setAddElementOpenTrigger((prev) => prev + 1);
    const openAddTax = () => setAddTaxOpenTrigger((prev) => prev + 1);

    return (
        <ProjectSummaryContext.Provider
            value={{
                summaryData,
                setSummaryData,
                refetchProject,
                setRefetchProject,
                openGroupSettings,
                groupSettingsOpenTrigger,
                openAddElement,
                addElementOpenTrigger,
                openAddTax,
                addTaxOpenTrigger,
            }}
        >
            {children}
        </ProjectSummaryContext.Provider>
    );
};

export const useProjectSummary = () => {
    const context = useContext(ProjectSummaryContext);
    if (context === undefined) {
        throw new Error("useProjectSummary must be used within a ProjectSummaryProvider");
    }
    return context;
};