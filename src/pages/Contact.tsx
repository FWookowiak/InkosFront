import React, { useState } from "react";

const Contact = () => {
    const [acceptedRODO, setAcceptedRODO] = useState(false);
    const [sendCopy, setSendCopy] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!acceptedRODO) return; // bezpieczeństwo
        console.log("Formularz wysłany", { acceptedRODO, sendCopy });
    };

    return (
        <div className="min-h-screen bg-background py-20 px-6">
            <div className="max-w-4xl mx-auto bg-card shadow-md rounded-xl p-8 space-y-10">
                <h1 className="text-3xl font-bold text-center">Skontaktuj się z nami</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Dane kontaktowe */}
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">Dane kontaktowe</h2>
                            <p className="text-muted-foreground">Masz pytania? Napisz lub zadzwoń do nas.</p>
                        </div>
                        <div className="text-sm space-y-2">
                            <p><strong>Email:</strong> kontakt@example.com</p>
                            <p><strong>Telefon:</strong> +48 123 456 789</p>
                            <p><strong>Adres:</strong> ul. Przykładowa 1, 00-000 Warszawa</p>
                        </div>
                    </div>

                    {/* Formularz kontaktowy */}
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium mb-1">Imię i nazwisko</label>
                            <input type="text" className="w-full border px-4 py-2 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Jan Kowalski" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input type="email" className="w-full border px-4 py-2 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary" placeholder="jan@example.com" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Wiadomość</label>
                            <textarea className="w-full border px-4 py-2 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Twoja wiadomość..." rows={4} />
                        </div>

                        {/* Checkboxy */}
                        <div className="space-y-2 text-sm">
                            <label className="flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    checked={acceptedRODO}
                                    onChange={(e) => setAcceptedRODO(e.target.checked)}
                                    className="mt-1"
                                />
                                <span>
                                    Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z RODO w celu obsługi formularza kontaktowego.
                                </span>
                            </label>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={sendCopy}
                                    onChange={(e) => setSendCopy(e.target.checked)}
                                />
                                <span>Wyślij kopię wiadomości na podany adres email</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={!acceptedRODO}
                            className={`px-6 py-2 rounded-md text-white ${
                                acceptedRODO ? "bg-primary hover:bg-primary/90" : "bg-primary opacity-50 cursor-not-allowed"
                            }`}
                        >
                            Wyślij
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Contact;
