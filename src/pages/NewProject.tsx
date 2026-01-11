import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axiosInstance from "../lib/axios";

const NewProject = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        let wspreg_value = 1
        let wspreg_name = "abbaaba"

        try {
            await axiosInstance.post("/api/projects/", {
                wspreg_name: wspreg_name,
                wspreg_value: wspreg_value,
                name,
                description
            });

            navigate("/dashboard");
        } catch (err) {
            console.error("Błąd przy dodawaniu projektu:", err);
            setError("Nie udało się dodać projektu. Spróbuj ponownie.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto mt-20 p-6 bg-white rounded-lg shadow">
            <h1 className="text-2xl font-bold mb-6">Dodaj nowy projekt</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-1 font-medium">Nazwa projektu</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Wpisz nazwę projektu"
                        required
                    />
                </div>
                <div>
                    <label className="block mb-1 font-medium">Opis</label>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Krótki opis projektu"
                        rows={4}
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/dashboard")}
                        disabled={isSubmitting}
                    >
                        Anuluj
                    </Button>
                    <Button
                        type="submit"
                        variant="default"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Zapisywanie..." : "Zapisz"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default NewProject;
