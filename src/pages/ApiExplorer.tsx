import { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OpenAPISchema = {
    openapi?: string;
    swagger?: string;
    info?: any;
    paths?: Record<string, any>;
};

const JSON_CANDIDATES = [
    "/api/schema/",
    "/api/schema/?format=openapi-json",
    "/api/schema.json",
    "/api/openapi.json",
    "/openapi.json",
    "/swagger.json",
    "/schema/",
    "/schema/?format=openapi-json",
    "/schema.json",
    "/api/docs.json",
    "/v1/openapi.json",
    "/api/v1/openapi.json",
];
const HTML_CANDIDATES = ["/swagger/", "/swagger", "/api/docs/", "/docs/", "/redoc/", "/api/redoc/"];

export default function ApiExplorer() {
    const [schemaUrl, setSchemaUrl] = useState<string>("");
    const [customUrl, setCustomUrl] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [schema, setSchema] = useState<OpenAPISchema | null>(null);
    const [error, setError] = useState<string | null>(null);

    const setSchemaOk = (data: any, from: string) => {
        if (!data?.paths) throw new Error("Brak pola `paths` w schemacie.");
        setSchema(data as OpenAPISchema);
        setSchemaUrl(from);
        setError(null);
    };

    const fetchJsonSchema = async (url: string) => {
        const { data } = await axiosInstance.get(url);
        setSchemaOk(data, url);
        return true;
    };

    // 1) SwaggerUI z URL: szukamy url: "/openapi.json" itp.
    const parseSwaggerHtmlForUrl = (html: string) => {
        const m =
            html.match(/url:\s*["']([^"']+)["']/) ||
            html.match(/"url"\s*:\s*["']([^"']+)["']/);
        return m?.[1] || null;
    };

    // 2) SwaggerUI z wstrzykniętym spec: {...}
    const parseSwaggerHtmlForInlineSpec = (html: string): any | null => {
        // złap blok "spec: { ... }" w konfiguracji SwaggerUIBundle
        const specBlockMatch = html.match(/spec\s*:\s*\{[\s\S]*?\}\s*,\s*\n/);
        if (!specBlockMatch) return null;

        let jsonLike = specBlockMatch[0];

        // usuń leading "spec:" i trailing przecinki/znaczniki
        jsonLike = jsonLike.replace(/^\s*spec\s*:\s*/, "");
        jsonLike = jsonLike.replace(/,\s*$/m, "");

        // próba parsowania jako JSON — najpierw prymitywna normalizacja
        // 1) usuń trailing przecinki w obiektach/tabl.
        jsonLike = jsonLike.replace(/,\s*([}\]])/g, "$1");

        try {
            // jeśli to poprawny JSON
            const parsed = JSON.parse(jsonLike);
            return parsed;
        } catch {
            // czasem spec jest JS-em (komentarze/pojedyncze cudzysłowy). Spróbuj ostrożnie evalnąć
            try {
                // ważne: sandbox minimalny — tworzymy nową funkcję, która zwraca literał
                // eslint-disable-next-line no-new-func
                const fn = new Function(`return (${jsonLike});`);
                const obj = fn();
                return obj && typeof obj === "object" ? obj : null;
            } catch {
                return null;
            }
        }
    };

    const fetchFromHtmlPage = async (pageUrl: string) => {
        const { data } = await axiosInstance.get(pageUrl, { responseType: "text" as any });
        const html: string = data;

        // A) spróbuj znaleźć URL do JSON-a
        const discovered = parseSwaggerHtmlForUrl(html);
        if (discovered) {
            try {
                await fetchJsonSchema(discovered);
                return true;
            } catch {
                // może brak wiodącego slasha
                if (!discovered.startsWith("/")) {
                    await fetchJsonSchema(`/${discovered}`);
                    return true;
                }
            }
        }

        // B) spróbuj inline "spec: {...}"
        const inlineSpec = parseSwaggerHtmlForInlineSpec(html);
        if (inlineSpec) {
            setSchemaOk(inlineSpec, `${pageUrl}#inline-spec`);
            return true;
        }

        return false;
    };

    const autoDiscover = async () => {
        setLoading(true);
        setError(null);
        setSchema(null);
        setSchemaUrl("");

        // JSON
        for (const url of JSON_CANDIDATES) {
            try {
                await fetchJsonSchema(url);
                setLoading(false);
                return;
            } catch {}
        }
        // HTML
        for (const page of HTML_CANDIDATES) {
            try {
                const ok = await fetchFromHtmlPage(page);
                if (ok) {
                    setLoading(false);
                    return;
                }
            } catch {}
        }

        setError("Nie znaleziono schematu na standardowych ścieżkach. Podaj adres ręcznie (np. /swagger).");
        setLoading(false);
    };

    useEffect(() => {
        autoDiscover();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sekocenbudPaths = useMemo(() => {
        if (!schema?.paths) return [];
        return Object.keys(schema.paths).filter((p) => p.toLowerCase().includes("sekocenbud"));
    }, [schema]);

    const handleFetchCustom = async () => {
        if (!customUrl) return;
        setLoading(true);
        setError(null);
        setSchema(null);
        try {
            if (
                customUrl.endsWith("/") ||
                /swagger|redoc|docs/i.test(customUrl)
            ) {
                const ok = await fetchFromHtmlPage(customUrl);
                if (!ok) throw new Error("Nie udało się znaleźć openapi ani inline spec na tej stronie.");
            } else {
                await fetchJsonSchema(customUrl);
            }
        } catch (e: any) {
            setError(e?.message ?? "Błąd pobierania schematu");
        } finally {
            setLoading(false);
        }
    };

    const candidates = [...JSON_CANDIDATES, ...HTML_CANDIDATES];

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 pt-24">
            <div className="container mx-auto p-6 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>API Explorer (Swagger/OpenAPI)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1">
                                <label className="text-sm text-muted-foreground">Znaleziony schemat</label>
                                <Input value={schemaUrl || "(nic)"} readOnly />
                            </div>
                            <div className="flex gap-2 items-end">
                                <Button onClick={autoDiscover} disabled={loading}>
                                    {loading ? "Skanuję…" : "Skanuj standardowe adresy"}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1">
                                <label className="text-sm text-muted-foreground">Własny adres (np. /swagger)</label>
                                <Input
                                    placeholder="/swagger lub /openapi.json"
                                    value={customUrl}
                                    onChange={(e) => setCustomUrl(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 items-end">
                                <Button onClick={handleFetchCustom} disabled={!customUrl || loading}>
                                    Pobierz
                                </Button>
                            </div>
                        </div>

                        {error && <p className="text-destructive">{error}</p>}

                        {schema && (
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    Ścieżki zawierające <code>sekocenbud</code>:
                                </p>
                                <div className="rounded border divide-y">
                                    {sekocenbudPaths.length > 0 ? (
                                        sekocenbudPaths.map((p) => (
                                            <details key={p} className="p-3">
                                                <summary className="cursor-pointer font-mono text-sm">{p}</summary>
                                                <pre className="mt-2 text-xs overflow-auto">
{JSON.stringify(schema.paths?.[p], null, 2)}
                        </pre>
                                            </details>
                                        ))
                                    ) : (
                                        <div className="p-3 text-sm text-muted-foreground">Brak ścieżek z „sekocenbud”.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-sm text-muted-foreground">Szybkie propozycje do kliknięcia:</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {candidates.map((u) => (
                                    <Button key={u} variant="outline" size="sm" onClick={() => setCustomUrl(u)}>
                                        {u}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
