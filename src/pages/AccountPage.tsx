import React from "react";
import { useAuth } from "@/contexts/AuthContext";

const AccountPage = () => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-background py-20 px-6">
            <div className="max-w-xl mx-auto bg-card shadow-md rounded-xl p-8">
                <h1 className="text-2xl font-bold mb-6">DANE KONTA:</h1>

                <div className="space-y-6">
                    <div>
                        <p className="text-muted-foreground text-sm">Nazwa</p>
                        <p className="text-lg font-medium">{user?.name ?? "Brak danych"}</p>
                    </div>

                    <div>
                        <p className="text-muted-foreground text-sm">Rodzaj licencji</p>
                        <p className="text-lg font-medium">Placeholder</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;
