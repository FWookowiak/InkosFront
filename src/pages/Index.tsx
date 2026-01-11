
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20" style={{marginTop: '20px'}}>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">INKOS 24 - wersja testowa</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Pierwsza na rynku, aplikacja webowa do tworzenia kosztorysów uproszczonych, w oparciu o wiodące bazy SEKOCENBUD
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {isAuthenticated ? (
            <Card>
              <CardHeader>
                <CardTitle>Witaj, {user?.name}!</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button asChild>
                  <Link to="/dashboard">Twoje projekty</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Masz juz konto?</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to="/login">Zaloguj się!</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Jakieś inne marketingowe pitu pitu</CardTitle>
              </CardHeader>
              <CardContent>
                Lorem ipsum dolor sit, amet consectetur adipisicing elit. Ducimus, animi! Quam perferendis vel tenetur ipsum soluta? Dolorum temporibus, saepe aliquam quibusdam nesciunt iusto facilis repellendus nemo repellat itaque natus iste.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chcesz otrzymać konto do testów?</CardTitle>
              </CardHeader>
              <CardContent>
                <p> Skontaktuj się z naszym przedstawicielem poprzez inkos@komako.eu</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
