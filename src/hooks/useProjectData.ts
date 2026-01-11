import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@/lib/axios';

export interface ProjectElement {
    id?: string | number;
    symbol?: string;
    name: string;
    unit: string;
    price: number;
    value: number;
    quantity?: number;
    group?: number | null;
    order?: number;
    isTax?: boolean;
    taxPercentage?: number;
    taxTarget?: number | null;
}

export interface ProjectGroup {
    id: number;
    name: string;
    color?: string;
}

export interface ProjectContent {
    version?: number;
    groups?: ProjectGroup[];
    elements?: ProjectElement[];
}

export interface ProjectData {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at?: string;
    content?: ProjectContent;
    groups?: ProjectGroup[];
    elements?: ProjectElement[];
    wspreg_name?: string;
    wspreg_value?: number;
    sekocenbud_catalog?: string;
}

interface UseProjectDataReturn {
    data: ProjectData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    elements: ProjectElement[];
    groups: ProjectGroup[];
    content: ProjectContent;
}

/**
 * Centralized hook for fetching and managing project data from /api/projects/:id
 * 
 * @param projectId - The ID of the project to fetch
 * @returns Project data with convenient accessors for elements, groups, and content
 * 
 * @example
 * ```tsx
 * const { data, loading, elements, groups, refetch } = useProjectData(projectId);
 * 
 * // Access elements
 * console.log(elements); // Array of project elements
 * 
 * // Access groups
 * console.log(groups); // Array of project groups
 * 
 * // Refetch after changes
 * await refetch();
 * ```
 */
export function useProjectData(projectId: string | undefined): UseProjectDataReturn {
    const [data, setData] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjectData = useCallback(async () => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await axiosInstance.get<ProjectData>(`/api/projects/${projectId}/`);
            setData(response.data);
        } catch (err: any) {
            console.error('Error fetching project data:', err);
            setError(err?.message || 'Failed to fetch project data');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchProjectData();
    }, [fetchProjectData]);

    // Convenient accessors for common data
    const content = data?.content ?? {};
    const elements = Array.isArray(content?.elements)
        ? content.elements
        : (Array.isArray(data?.elements) ? data.elements : []);
    const groups = content.groups ?? data?.groups ?? [];

    return {
        data,
        loading,
        error,
        refetch: fetchProjectData,
        elements,
        groups,
        content,
    };
}
