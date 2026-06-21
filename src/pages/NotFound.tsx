import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-gradient-hero" aria-hidden />
      <div className="relative text-center">
        <div className="flex justify-center mb-8"><BrandMark size="md" /></div>
        <h1 className="font-display text-7xl md:text-8xl font-bold tracking-tight bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">
          404
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-md mx-auto">
          This page took a different career path.
        </p>
        <Link to="/" className="inline-block mt-6">
          <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
